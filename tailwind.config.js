/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Dogs outdoors" palette — sunny day at the park.
        // brand = warm sand/stone neutrals (backgrounds, text, borders)
        brand: {
          50: '#faf6ef',
          100: '#f1e8d8',
          200: '#e4d3b4',
          300: '#d2b888',
          400: '#bd9a5e',
          500: '#a37e44',
          600: '#856538',
          700: '#6a4f2d',
          800: '#4f3b23',
          900: '#382818',
          950: '#241a0f',
        },
        // sky = clear-day blue (primary actions, links)
        sky: {
          50: '#eef7ff',
          100: '#d7ecff',
          200: '#b3dbff',
          300: '#82c3ff',
          400: '#4ea6f7',
          500: '#2589e0',
          600: '#1a6fc0',
          700: '#195a9b',
          800: '#1a4b7e',
          900: '#1b4068',
        },
        // sun = golden-hour amber (highlights, badges)
        sun: {
          50: '#fff8ea',
          100: '#fdecc4',
          200: '#fbd989',
          300: '#f8c04d',
          400: '#f4a623',
          500: '#e3850f',
          600: '#bd6709',
          700: '#974f0c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
