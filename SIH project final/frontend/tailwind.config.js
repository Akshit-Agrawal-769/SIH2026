/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          dark: '#030b14',
          panel: '#071524',
          border: '#102a45',
          accent: '#00e5ff',
          muted: '#527999',
          glow: 'rgba(0, 229, 255, 0.2)'
        }
      },
      fontFamily: {
        mono: ['SF Mono', 'Roboto Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
