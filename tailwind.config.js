/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark-green brand palette
        brand: {
          50: '#eefbf3',
          100: '#d6f5e1',
          200: '#b0e9c7',
          300: '#7dd6a6',
          400: '#46bb80',
          500: '#229f63',
          600: '#15804f',
          700: '#116541',
          800: '#114f35',
          900: '#0f422e',
          950: '#06251a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
