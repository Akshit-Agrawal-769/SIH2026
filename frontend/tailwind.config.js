/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        ocean: {
          bg: '#090b0d',
          'bg-secondary': '#101316',
          panel: 'rgba(18, 21, 22, 0.94)',
          solid: '#15191b',
          elevated: '#1b2022',
          border: 'rgba(255, 255, 255, 0.10)',
          'border-strong': 'rgba(255, 255, 255, 0.16)',
          text: '#f5f5f0',
          'text-secondary': '#c4c7c5',
          muted: '#858b89',
          accent: '#14b8a6',
          'accent-hover': '#2dd4bf',
          'accent-active': '#0f766e',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444'
        }
      },
      fontFamily: {
        mono: ['SF Mono', 'Roboto Mono', 'Fira Code', 'monospace']
      },
      transitionTimingFunction: {
        'nasa': 'cubic-bezier(0, 0.2, 0, 1)',
        'nasa-slow': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      }
    },
  },
  plugins: [],
}
