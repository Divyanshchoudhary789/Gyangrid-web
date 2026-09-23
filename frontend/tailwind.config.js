/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['Lexend', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f1f0ff', 100: '#e5e2ff', 200: '#cdc8ff', 300: '#aaa1ff', 400: '#8a7cfd',
          500: '#6d5dfc', 600: '#5b45f0', 700: '#4c36d4', 800: '#3e2eab', 900: '#352b87', 950: '#1f1850',
        },
        ink: {
          50: '#f7f8fb', 100: '#eef0f6', 200: '#dde1ec', 300: '#c1c7d8', 400: '#8e96ae',
          500: '#667089', 600: '#4b546c', 700: '#394157', 800: '#232a3d', 900: '#141a2b', 950: '#0b0f1c',
        },
        gold: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde58a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
        flame: { 50: '#fff4ed', 100: '#ffe6d4', 400: '#ff8a4c', 500: '#f86a1f', 600: '#e14f0b' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,26,43,.04), 0 4px 16px -4px rgba(20,26,43,.08)',
        lift: '0 10px 30px -10px rgba(76,54,212,.35)',
        glow: '0 0 0 4px rgba(109,93,252,.18)',
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        wiggle: { '0%,100%': { transform: 'rotate(-6deg)' }, '50%': { transform: 'rotate(6deg)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        shimmer: 'shimmer 1.4s infinite',
        float: 'float 5s ease-in-out infinite',
        wiggle: 'wiggle 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
