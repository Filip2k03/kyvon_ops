import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#08090B',
        surface: '#0E1014',
        elevated: '#14171C',
        border: '#252A32',
        primary: '#F1F3F5',
        secondary: '#8B929D',
        healthy: '#10b981',
        warning: '#f59e0b',
        critical: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;