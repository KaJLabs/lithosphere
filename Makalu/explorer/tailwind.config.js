/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        litho: {
          50: '#eef5fd',
          100: '#d4e4f9',
          200: '#a9c9f3',
          300: '#7eaeec',
          400: '#4a90d9',
          500: '#2c6fba',
          600: '#235a96',
          700: '#1a4471',
          800: '#122e4d',
          900: '#091728',
        },
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
