/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#12161C',
        panel: '#1A2029',
        panel2: '#212833',
        line: '#2A313D',
        ink: '#E7ECF2',
        mute: '#8B95A3',
        open: '#4FD1C5',
        filling: '#F2B84B',
        full: '#E2574C',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
