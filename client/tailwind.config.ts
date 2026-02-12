import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        th: {
          'bg-primary': 'var(--bg-primary)',
          'bg-secondary': 'var(--bg-secondary)',
          'bg-tertiary': 'var(--bg-tertiary)',
          'bg-accent': 'var(--bg-accent)',
          'bg-floating': 'var(--bg-floating)',
          'bg-card': 'var(--bg-card)',
          'bg-message-hover': 'var(--bg-message-hover)',
          'text-primary': 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-tertiary': 'var(--text-tertiary)',
          'text-muted': 'var(--text-muted)',
          'text-link': 'var(--text-link)',
          'border': 'var(--border)',
          'border-strong': 'var(--border-strong)',
          'brand': 'var(--brand)',
          'brand-hover': 'var(--brand-hover)',
          'green': 'var(--status-green)',
          'green-hover': 'var(--status-green-hover)',
          'yellow': 'var(--status-yellow)',
          'red': 'var(--status-red)',
          'red-hover': 'var(--status-red-hover)',
          'disabled': 'var(--disabled)',
          'role-default': 'var(--role-default)',
        },
      },
      fontFamily: {
        sans: ['var(--font-family)'],
      },
    },
  },
  plugins: [],
} satisfies Config;
