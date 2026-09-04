/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        terminal: {
          950: '#0a0e17',
          900: '#0d1320',
          850: '#111826',
          800: '#161e2e',
          750: '#1b2435',
          700: '#222c40',
          600: '#2d3a52',
          500: '#3b4a66',
        },
        accent: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        steel: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        bull: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
        },
        bear: {
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        warn: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset',
      },
    },
  },
  plugins: [],
};
