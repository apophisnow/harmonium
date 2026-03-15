import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Existing Harmonium theme tokens
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
        // shadcn/ui semantic tokens — mapped to Harmonium theme variables
        border: 'var(--border)',
        input: 'var(--border)',
        ring: 'var(--brand)',
        background: 'var(--bg-primary)',
        foreground: 'var(--text-primary)',
        primary: {
          DEFAULT: 'var(--brand)',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'var(--bg-secondary)',
          foreground: 'var(--text-primary)',
        },
        destructive: {
          DEFAULT: 'var(--status-red)',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'var(--bg-tertiary)',
          foreground: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--bg-accent)',
          foreground: 'var(--text-primary)',
        },
        popover: {
          DEFAULT: 'var(--bg-floating)',
          foreground: 'var(--text-primary)',
        },
        card: {
          DEFAULT: 'var(--bg-card)',
          foreground: 'var(--text-primary)',
        },
        sidebar: {
          DEFAULT: 'var(--bg-secondary)',
          foreground: 'var(--text-secondary)',
          primary: 'var(--brand)',
          'primary-foreground': '#ffffff',
          accent: 'var(--bg-accent)',
          'accent-foreground': 'var(--text-primary)',
          border: 'var(--border)',
          ring: 'var(--brand)',
        },
        chart: {
          '1': 'var(--brand)',
          '2': 'var(--status-green)',
          '3': 'var(--status-yellow)',
          '4': 'var(--status-red)',
          '5': 'var(--text-link)',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-family)'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
