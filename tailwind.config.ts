import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        mauve: {
          50:  '#FAF9FC',
          100: '#F2EDF8',
          200: '#E2D8EE',
          300: '#C9BBDA',
          400: '#AA97C2',
          500: '#8E77AA',
          600: '#725B90',
          700: '#5C4875',
          800: '#43325A',
          900: '#2C1F3F',
        },
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        voteBounce: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.25)' },
        },
        toastIn: {
          from: { opacity: '0', transform: 'translateX(-50%) translateY(8px)' },
          to:   { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
        },
        riseIn: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        'fade-slide-in': 'fadeSlideIn 0.2s ease-out',
        'vote-bounce':   'voteBounce 0.3s ease-out',
        'toast-in':      'toastIn 0.2s ease-out',
        'rise-in':       'riseIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in':       'fadeIn 0.4s ease-out',
      },
    },
  },
  plugins: [],
};
export default config;
