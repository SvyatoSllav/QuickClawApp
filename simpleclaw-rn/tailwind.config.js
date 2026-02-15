/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#07080A',
        'card-bg': '#18181B',
        'card-bg-alt': '#27272A',
        'modal-bg': '#0A0B0D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        inter: ['Inter'],
      },
    },
  },
  plugins: [],
};
