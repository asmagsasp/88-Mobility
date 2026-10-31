/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          amber: '#F59E0B',
          'amber-light': '#FCD34D',
          'amber-dark': '#D97706',
          dark: '#0F172A',         // slate-900
          'dark-card': '#1E293B',  // slate-800
          'dark-border': '#334155', // slate-700
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
