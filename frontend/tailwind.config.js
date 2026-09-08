/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        ocean: {
          950: '#02050e',
          900: '#030816',
          850: '#050d22',
          800: '#08132e',
          750: '#0c1b3f',
          700: '#102452',
          600: '#173678',
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 16px -2px rgba(56, 189, 248, 0.35)',
        'glow-cyan-sm': '0 0 8px 0 rgba(56, 189, 248, 0.25)',
        'glow-blue': '0 0 18px -2px rgba(14, 165, 233, 0.4)',
        'glow-emerald': '0 0 14px -2px rgba(52, 211, 153, 0.35)',
        'glow-amber': '0 0 14px -2px rgba(251, 191, 36, 0.35)',
        'panel-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.55)',
      },
    },
  },
  plugins: [],
}

