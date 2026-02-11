import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        harmonium: {
          'bg-primary': '#36393f',
          'bg-secondary': '#2f3136',
          'bg-tertiary': '#202225',
          'bg-accent': '#40444b',
          'bg-floating': '#18191c',
          'text-primary': '#dcddde',
          'text-secondary': '#96989d',
          'text-muted': '#72767d',
          'brand': '#5865f2',
          'brand-hover': '#4752c4',
          'green': '#3ba55c',
          'yellow': '#faa61a',
          'red': '#ed4245',
        },
      },
      fontFamily: {
        sans: ['"gg sans"', '"Noto Sans"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
