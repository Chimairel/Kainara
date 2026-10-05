import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'color-mix(in srgb, var(--background) calc(<alpha-value> * 100%), transparent)',
        foreground: 'color-mix(in srgb, var(--foreground) calc(<alpha-value> * 100%), transparent)',
        brand: {
          bg: 'color-mix(in srgb, var(--brand-bg) calc(<alpha-value> * 100%), transparent)',
          bgAlt: 'color-mix(in srgb, var(--brand-bg-alt) calc(<alpha-value> * 100%), transparent)',
          surface: 'color-mix(in srgb, var(--brand-surface) calc(<alpha-value> * 100%), transparent)',
          border: 'color-mix(in srgb, var(--brand-border) calc(<alpha-value> * 100%), transparent)',
          green: 'color-mix(in srgb, var(--brand-green) calc(<alpha-value> * 100%), transparent)',
          greenHover: 'color-mix(in srgb, var(--brand-green-hover) calc(<alpha-value> * 100%), transparent)',
          greenLight: 'color-mix(in srgb, var(--brand-green-light) calc(<alpha-value> * 100%), transparent)',
          text: 'color-mix(in srgb, var(--brand-text) calc(<alpha-value> * 100%), transparent)',
          muted: 'color-mix(in srgb, var(--brand-muted) calc(<alpha-value> * 100%), transparent)',
          accent: 'color-mix(in srgb, var(--brand-accent) calc(<alpha-value> * 100%), transparent)',
          accentSoft: 'color-mix(in srgb, var(--brand-accent-soft) calc(<alpha-value> * 100%), transparent)',
          cyan: 'color-mix(in srgb, var(--brand-cyan) calc(<alpha-value> * 100%), transparent)',
          violet: 'color-mix(in srgb, var(--brand-violet) calc(<alpha-value> * 100%), transparent)',
          black: 'color-mix(in srgb, var(--brand-black) calc(<alpha-value> * 100%), transparent)',
          dark: 'color-mix(in srgb, var(--brand-dark) calc(<alpha-value> * 100%), transparent)',
        },
        sidebar: {
          bg: 'color-mix(in srgb, var(--sidebar-bg) calc(<alpha-value> * 100%), transparent)',
          text: 'color-mix(in srgb, var(--sidebar-text) calc(<alpha-value> * 100%), transparent)',
          active: 'color-mix(in srgb, var(--sidebar-active) calc(<alpha-value> * 100%), transparent)',
          hover: 'color-mix(in srgb, var(--sidebar-hover) calc(<alpha-value> * 100%), transparent)',
        },
        status: {
          verified: {
            bg: 'color-mix(in srgb, var(--status-verified-bg) calc(<alpha-value> * 100%), transparent)',
            text: 'color-mix(in srgb, var(--status-verified-text) calc(<alpha-value> * 100%), transparent)',
          },
          pending: {
            bg: 'color-mix(in srgb, var(--status-pending-bg) calc(<alpha-value> * 100%), transparent)',
            text: 'color-mix(in srgb, var(--status-pending-text) calc(<alpha-value> * 100%), transparent)',
          },
          rejected: {
            bg: 'color-mix(in srgb, var(--status-rejected-bg) calc(<alpha-value> * 100%), transparent)',
            text: 'color-mix(in srgb, var(--status-rejected-text) calc(<alpha-value> * 100%), transparent)',
          },
          error: {
            bg: 'color-mix(in srgb, var(--status-error-bg) calc(<alpha-value> * 100%), transparent)',
            text: 'color-mix(in srgb, var(--status-error-text) calc(<alpha-value> * 100%), transparent)',
          },
          ai: {
            bg: 'color-mix(in srgb, var(--status-ai-bg) calc(<alpha-value> * 100%), transparent)',
            text: 'color-mix(in srgb, var(--status-ai-text) calc(<alpha-value> * 100%), transparent)',
          },
          user: {
            bg: 'color-mix(in srgb, var(--status-user-bg) calc(<alpha-value> * 100%), transparent)',
            text: 'color-mix(in srgb, var(--status-user-text) calc(<alpha-value> * 100%), transparent)',
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'sans-serif'],
        display: ['var(--font-outfit)', 'var(--font-plus-jakarta-sans)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(5, 18, 14, 0.05), 0 12px 32px rgba(5, 18, 14, 0.07)',
        'card-hover': '0 18px 50px rgba(5, 18, 14, 0.12)',
        'card-lg': '0 28px 80px rgba(5, 18, 14, 0.18)',
        neon: '0 0 0 1px rgba(184, 244, 95, 0.18), 0 0 36px rgba(184, 244, 95, 0.12)',
        cyan: '0 0 32px rgba(97, 230, 255, 0.14)',
      },
    },
  },
  plugins: [],
};
export default config;
