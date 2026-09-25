-- =====================================================================
-- KlusterZ: database schema (Supabase / Postgres)
-- Run this whole file once in Supabase > SQL Editor > New query > Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

create table campuses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  timezone   text not null default 'Africa/Gaborone',
  created_at timestamptz not null default now()
);

-- A module is a subject (BDA today; anything else later).
create table modules (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

-- A cluster is one shared resource at one campus, with its own rules.
create table clusters (
  id                    uuid primary key default gen_random_uuid(),
  campus_id             uuid not null references campuses(id) on delete cascade,
  name                  text not null,
  default_capacity      int  not null default 5   check (default_capacity >= 0),  -- max groups per slot
  slot_length_minutes   int  not null default 180 check (slot_length_minutes between 30 and 720),
  max_sessions_per_week int  not null default 3   check (max_sessions_per_week > 0),
  cancel_cutoff_minutes int  not null default 60  check (cancel_cutoff_minutes >= 0),
  unique (campus_id, name)
);

-- When a cluster is open. end_time earlier than start_time means "ends the next morning".
-- open_days: 1 = Monday ... 7 = Sunday, and the day is the day the session STARTS.
create table session_windows (
  id           uuid primary key default gen_random_uuid(),
  cluster_id   uuid not null references clusters(id) on delete cascade,
  session_type text not null check (session_type in ('day','night')),
  start_time   time not null,
  end_time     time not null,
  open_days    int[] not null
);

create table groups (
  id           uuid primary key default gen_random_uuid(),
  cluster_id   uuid not null references clusters(id) on delete restrict,
  module_id    uuid not null references modules(id)  on delete restrict,
  name         text not null,
  members      text[] not null default '{}',   -- optional student numbers, useful for the gradebook later
  night_opt_in boolean not null default false,
  join_code    text not null unique
               default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_at   timestamptz not null default now(),
  unique (cluster_id, module_id, name)
);

-- Links a login (auth.users) to a role and, for students, a group.
create table profiles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  role     text not null default 'group' check (role in ('group','admin')),
  group_id uuid unique references groups(id) on delete set null
);

-- Times a group cannot work. Weekly, repeating. Minutes counted from Monday 00:00.
-- Example: Tuesday 10:00-12:00 = start_min 1440+600 = 2040, end_min 2160.
create table unavailability (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references groups(id) on delete cascade,
  kind      text not null check (kind in ('lesson','personal')),
  start_min int  not null check (start_min >= 0),
  end_min   int  not null check (end_min <= 10080),
  label     text,
  check (end_min > start_min)
);
create index on unavailability (group_id);

-- Concrete bookable slots (created by generate_slots below).
create table slots (
  id                uuid primary key default gen_random_uuid(),
  cluster_id        uuid not null references clusters(id) on delete cascade,
  session_type      text not null check (session_type in ('day','night')),
  start_at          timestamptz not null,
  end_at            timestamptz not null,
  week_of           date not null,         -- Monday of that week (campus local date)
  week_start_min    int  not null,         -- minutes from Monday 00:00, campus local time
  week_end_min      int  not null,
  capacity_override int  check (capacity_override >= 0),   -- null = use the cluster default
  booked_count      int  not null default 0,
  unique (cluster_id, start_at)
);
create index on slots (cluster_id, start_at);

create table bookings (
  id           uuid primary key default gen_random_uuid(),
  slot_id      uuid not null references slots(id)  on delete cascade,
  group_id     uuid not null references groups(id) on delete cascade,
  status       text not null default 'booked' check (status in ('booked','cancelled')),
  attended     boolean,                    -- for attendance / gradebook later
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz
);
create unique index bookings_one_active on bookings (slot_id, group_id) where status = 'booked';
create index on bookings (group_id);

-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS
-- ---------------------------------------------------------------------

create function current_group_id() returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from profiles where user_id = auth.uid();
$$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'admin');
$$;

-- Every new signup gets a plain "group" profile. Promote yourself to admin manually (see bottom).
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keeps slots.booked_count correct no matter how bookings change.
create function refresh_booked_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_slot uuid;
begin
  v_slot := coalesce(new.slot_id, old.slot_id);
  update slots
     set booked_count = (select count(*) from bookings where slot_id = v_slot and status = 'booked')
   where id = v_slot;
  return null;
end $$;

create trigger bookings_count
  after insert or update or delete on bookings
  for each row execute function refresh_booked_count();

-- ---------------------------------------------------------------------
-- 3. STUDENT-FACING FUNCTIONS
-- ---------------------------------------------------------------------

-- A student signs up, then enters the join code the admin gave their group.
create function claim_group(p_join_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  select id into v_group from groups where join_code = upper(trim(p_join_code));
  if not found then raise exception 'Invalid join code'; end if;
  if exists (select 1 from profiles where group_id = v_group and user_id <> auth.uid()) then
    raise exception 'This group already has an account';
  end if;
  update profiles set group_id = v_group where user_id = auth.uid();
  return v_group;
end $$;

create function set_night_opt_in(p_value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if current_group_id() is null then raise exception 'No group linked to this account'; end if;
  update groups set night_opt_in = p_value where id = current_group_id();
end $$;

-- Free slots for my group: no clash with lessons or personal unavailability,
-- not full, respects my night opt-in. Quietest slots first.
create function get_available_slots(
  p_from timestamptz,
  p_to timestamptz,
  p_session_type text default null
) returns table (
  slot_id      uuid,
  session_type text,
  start_at     timestamptz,
  end_at       timestamptz,
  capacity     int,
  booked_count int,
  seats_left   int,
  load_pct     int
)
language sql stable security definer set search_path = public as $$
  select s.id, s.session_type, s.start_at, s.end_at,
         eff.cap, s.booked_count, eff.cap - s.booked_count,
         (100 * s.booked_count / greatest(eff.cap, 1))::int
    from groups g
    join slots s on s.cluster_id = g.cluster_id
    cross join lateral (
      select coalesce(s.capacity_override, c.default_capacity) as cap
        from clusters c where c.id = s.cluster_id
    ) eff
   where g.id = current_group_id()
     and s.start_at >= greatest(p_from, now())
     and s.start_at <  p_to
     and (p_session_type is null or s.session_type = p_session_type)
     and (s.session_type = 'day' or g.night_opt_in)
     and s.booked_count < eff.cap
     and not exists (
           select 1 from unavailability u
            where u.group_id = g.id
              and u.start_min < s.week_end_min
              and u.end_min   > s.week_start_min)
     and not exists (
           select 1 from bookings b
            where b.slot_id = s.id and b.group_id = g.id and b.status = 'booked')
   order by (100 * s.booked_count / greatest(eff.cap, 1)), s.start_at;
$$;

-- The booking itself. The slot row is locked, so two groups can never take the last seat.
create function book_slot(p_slot_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_group   groups;
  v_slot    slots;
  v_cluster clusters;
  v_cap     int;
  v_week    int;
  v_id      uuid;
begin
  select * into v_group from groups where id = current_group_id();
  if not found then raise exception 'No group linked to this account'; end if;

  select * into v_slot from slots where id = p_slot_id for update;   -- the lock
  if not found then raise exception 'Slot not found'; end if;
  if v_slot.cluster_id <> v_group.cluster_id then
    raise exception 'That slot belongs to a different cluster';
  end if;

  select * into v_cluster from clusters where id = v_slot.cluster_id;

  if v_slot.start_at <= now() then
    raise exception 'That slot has already started';
  end if;
  if v_slot.session_type = 'night' and not v_group.night_opt_in then
    raise exception 'Turn on night sessions first';
  end if;
  if exists (select 1 from unavailability u
              where u.group_id = v_group.id
                and u.start_min < v_slot.week_end_min
                and u.end_min   > v_slot.week_start_min) then
    raise exception 'That slot clashes with your timetable or unavailable times';
  end if;
  if exists (select 1 from bookings
              where slot_id = v_slot.id and group_id = v_group.id and status = 'booked') then
    raise exception 'You already booked this slot';
  end if;

  v_cap := coalesce(v_slot.capacity_override, v_cluster.default_capacity);
  if v_slot.booked_count >= v_cap then
    raise exception 'That slot is full';
  end if;

  select count(*) into v_week
    from bookings b join slots s on s.id = b.slot_id
   where b.group_id = v_group.id and b.status = 'booked' and s.week_of = v_slot.week_of;
  if v_week >= v_cluster.max_sessions_per_week then
    raise exception 'You have reached the limit of % sessions for that week', v_cluster.max_sessions_per_week;
  end if;

  insert into bookings (slot_id, group_id) values (v_slot.id, v_group.id) returning id into v_id;
  return v_id;
end $$;

create function cancel_booking(p_booking_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b bookings; v_slot slots; v_cutoff int;
begin
  select * into v_b from bookings where id = p_booking_id and group_id = current_group_id() for update;
  if not found then raise exception 'Booking not found'; end if;
  if v_b.status <> 'booked' then raise exception 'Booking is already cancelled'; end if;

  select * into v_slot from slots where id = v_b.slot_id;
  select cancel_cutoff_minutes into v_cutoff from clusters where id = v_slot.cluster_id;
  if v_slot.start_at - make_interval(mins => v_cutoff) <= now() then
    raise exception 'Too late to cancel this booking';
  end if;

  update bookings set status = 'cancelled', cancelled_at = now() where id = v_b.id;
end $$;

-- ---------------------------------------------------------------------
-- 4. ADMIN FUNCTIONS
-- ---------------------------------------------------------------------

-- Creates slots from the cluster's session windows for a date range. Safe to re-run.
create function generate_slots(p_cluster_id uuid, p_from date, p_to date) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_cluster clusters;
  v_tz      text;
  w         session_windows;
  d         date;
  v_dow     int;
  v_len     int;
  v_n       int;
  v_startmin int;
  k         int;
  v_local   timestamp;
  v_rows    int;
  v_total   int := 0;
begin
  -- auth.uid() is null when you run this from the Supabase SQL Editor; app users must be admins.
  if auth.uid() is not null and not is_admin() then raise exception 'Admins only'; end if;

  select * into v_cluster from clusters where id = p_cluster_id;
  if not found then raise exception 'Cluster not found'; end if;
  select timezone into v_tz from campuses where id = v_cluster.campus_id;

  for d in select generate_series(p_from, p_to, interval '1 day')::date loop
    v_dow := extract(isodow from d)::int;
    for w in select * from session_windows where cluster_id = p_cluster_id loop
      continue when not (v_dow = any (w.open_days));

      v_len := ((extract(epoch from (w.end_time - w.start_time)) / 60)::int + 1440) % 1440;
      if v_len = 0 then v_len := 1440; end if;
      v_n := v_len / v_cluster.slot_length_minutes;
      v_startmin := (v_dow - 1) * 1440
                    + extract(hour from w.start_time)::int * 60
                    + extract(minute from w.start_time)::int;

      for k in 0 .. v_n - 1 loop
        v_local := d + w.start_time + make_interval(mins => k * v_cluster.slot_length_minutes);
        insert into slots (cluster_id, session_type, start_at, end_at, week_of,
                           week_start_min, week_end_min)
        values (p_cluster_id, w.session_type,
                v_local at time zone v_tz,
                (v_local + make_interval(mins => v_cluster.slot_length_minutes)) at time zone v_tz,
                d - (v_dow - 1),
                v_startmin + k * v_cluster.slot_length_minutes,
                v_startmin + (k + 1) * v_cluster.slot_length_minutes)
        on conflict (cluster_id, start_at) do nothing;
        get diagnostics v_rows = row_count;
        v_total := v_total + v_rows;
      end loop;
    end loop;
  end loop;
  return v_total;
end $$;

-- How many groups could attend each slot (free of lessons/unavailability, and night-eligible).
-- Use this to see where demand is squeezed.
create function admin_slot_demand(p_cluster_id uuid, p_from timestamptz, p_to timestamptz)
returns table (slot_id uuid, session_type text, start_at timestamptz, groups_free int, booked_count int, capacity int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
  select s.id, s.session_type, s.start_at,
         (select count(*)::int from groups g
           where g.cluster_id = s.cluster_id
             and (s.session_type = 'day' or g.night_opt_in)
             and not exists (select 1 from unavailability u
                              where u.group_id = g.id
                                and u.start_min < s.week_end_min
                                and u.end_min   > s.week_start_min)),
         s.booked_count,
         coalesce(s.capacity_override, c.default_capacity)
    from slots s join clusters c on c.id = s.cluster_id
   where s.cluster_id = p_cluster_id and s.start_at >= p_from and s.start_at < p_to
   order by s.start_at;
end $$;

-- Live admin view: who is in which slot. Respects the security rules below.
create view admin_live with (security_invoker = true) as
select s.id as slot_id, s.start_at, s.end_at, s.session_type,
       coalesce(s.capacity_override, c.default_capacity) as capacity,
       s.booked_count,
       g.id as group_id, g.name as group_name, b.id as booking_id, b.attended
  from slots s
  join clusters c on c.id = s.cluster_id
  left join bookings b on b.slot_id = s.id and b.status = 'booked'
  left join groups g on g.id = b.group_id;

-- ---------------------------------------------------------------------
-- 5. SECURITY (Row Level Security)
-- ---------------------------------------------------------------------

alter table campuses         enable row level security;
alter table modules          enable row level security;
alter table clusters         enable row level security;
alter table session_windows  enable row level security;
alter table groups           enable row level security;
alter table profiles         enable row level security;
alter table unavailability   enable row level security;
alter table slots            enable row level security;
alter table bookings         enable row level security;

-- Admins can do everything everywhere.
do $$
declare t text;
begin
  foreach t in array array['campuses','modules','clusters','session_windows','groups',
                           'profiles','unavailability','slots','bookings'] loop
    execute format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())',
                   t || '_admin', t);
  end loop;
end $$;

-- Any logged-in user may read reference data.
create policy campuses_read        on campuses        for select to authenticated using (true);
create policy modules_read         on modules         for select to authenticated using (true);
create policy clusters_read        on clusters        for select to authenticated using (true);
create policy session_windows_read on session_windows for select to authenticated using (true);

-- Groups see only their own group, profile, timetable and bookings.
create policy groups_own   on groups   for select to authenticated using (id = current_group_id());
create policy profiles_own on profiles for select to authenticated using (user_id = auth.uid());
create policy bookings_own on bookings for select to authenticated using (group_id = current_group_id());

create policy unavailability_own on unavailability for all to authenticated
  using (group_id = current_group_id()) with check (group_id = current_group_id());

-- Groups see slots (with the booked count, but not who booked) for their own cluster.
create policy slots_own_cluster on slots for select to authenticated
  using (cluster_id = (select cluster_id from groups where id = current_group_id()));

-- Lock the functions to logged-in users (Supabase leaves them open by default).
revoke execute on all functions in schema public from public, anon;
grant execute on function current_group_id(), is_admin(), claim_group(text), set_night_opt_in(boolean),
  get_available_slots(timestamptz, timestamptz, text), book_slot(uuid), cancel_booking(uuid),
  generate_slots(uuid, date, date), admin_slot_demand(uuid, timestamptz, timestamptz)
  to authenticated;

-- Live updates for the admin dashboard (and slot counts for students).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table slots, bookings;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. STARTER DATA (Gaborone + Francistown, BDA)
-- Sunday is closed. Session windows: day 08:00-17:00, night 17:00-05:00, Mon-Sat.
-- Slot length is 180 minutes so both windows divide evenly (3 day slots, 4 night slots).
-- ---------------------------------------------------------------------

insert into campuses (name) values ('Gaborone'), ('Francistown');
insert into modules  (code, name) values ('BDA', 'Big Data Analytics');

insert into clusters (campus_id, name)
select id, name || ' BDA Cluster' from campuses;

insert into session_windows (cluster_id, session_type, start_time, end_time, open_days)
select c.id, 'day',   time '08:00', time '17:00', array[1,2,3,4,5,6] from clusters c
union all
select c.id, 'night', time '17:00', time '05:00', array[1,2,3,4,5,6] from clusters c;

-- ---------------------------------------------------------------------
-- AFTER RUNNING (do these once):
--  1. Sign up in the app with your own email.
--  2. Make yourself admin (replace the email):
--       update profiles set role = 'admin'
--        where user_id = (select id from auth.users where email = 'you@example.com');
--  3. Generate slots (as admin, e.g. 8 weeks from a Monday):
--       select generate_slots(id, '2026-09-28', '2026-11-22') from clusters;
--  4. Import your groups (Table Editor > groups > Import CSV). Each gets a join code.
-- ---------------------------------------------------------------------
