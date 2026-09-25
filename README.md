# KlusterZ

A time-slot booking app for the BDA cluster, so student groups don't all hit
Hadoop/Spark/YARN at the same moment. Backed by Supabase (Postgres, auth,
row-level security, live updates).

## What's already done

The database (`klusterz_schema.sql`) is set up and seeded with the Gaborone
and Francistown clusters, the BDA module, and the day/night session windows.
`.env` already points at that Supabase project, so this app works out of the
box locally.

## Run it locally

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`).

## First-time admin setup

1. In the running app, sign up with your own email and password.
2. In Supabase → SQL Editor, run (with your real email):
   ```sql
   update profiles set role = 'admin'
    where user_id = (select id from auth.users where email = 'you@example.com');
   ```
3. Sign out and back in. You'll land on **Live view** instead of the student
   screens.
4. Go to **Settings** and click **Generate slots** for each cluster to create
   the first weeks of bookable time.
5. Import your groups: Supabase → Table Editor → `groups` → Insert rows (or
   Import CSV) with `cluster_id`, `module_id`, and `name`. Each group gets a
   random `join_code` automatically — that's what you hand out to students.

## Student flow

1. Sign up with an email and password.
2. Enter the join code for their group.
3. Fill in their timetable (click a cell to mark a lesson or a personal
   block; click again to clear it) and turn night sessions on if they want
   them.
4. Book a slot. Slots that clash with their timetable, are full, or are
   night slots they haven't opted into are simply not shown.

Only one login can hold a group's join code at a time — the whole group
shares that one account.

## Deploying for real (free)

1. Push this folder to a GitHub repo (`.env` is gitignored on purpose —
   don't commit real keys to a public repo).
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, and import
   the repo. It auto-detects Vite.
3. Before the first deploy, add two environment variables in Vercel's
   project settings (**Settings → Environment Variables**):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (same two values as in your local `.env`)
4. Deploy. You'll get a free `your-project.vercel.app` URL — share that with
   students.

## Notes and honest limits

- This controls who is *supposed* to be on the cluster. It doesn't
  technically block a group from logging into YARN/Spark outside its slot —
  that would need the lecturer to tie cluster access itself to the
  schedule, which is separate from this app.
- The anon key in `.env` is meant to be public — it can only do what the
  database's row-level security rules allow. Never put the `service_role`
  key (from Supabase settings) into this app.
- To reuse this for another module (not just BDA), add a row to `modules`
  and clusters/groups that reference it — the schema was built to support
  more than one subject from day one.
