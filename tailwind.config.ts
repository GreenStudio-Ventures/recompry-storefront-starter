import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colores de marca inyectados por `src/app/layout.tsx` desde GET /v1/store → branding.colors.
        // Tripletes RGB para que funcionen los modificadores de opacidad (bg-brand/10, ring-brand/20…).
        brand: {
          DEFAULT: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--brand-secondary-rgb) / <alpha-value>)',
          accent: 'rgb(var(--brand-accent-rgb) / <alpha-value>)',
          foreground: 'var(--brand-foreground)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px -12px rgb(15 23 42 / 0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
