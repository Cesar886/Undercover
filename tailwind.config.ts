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
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: '0', transform: 'tranzincY(-6px)' },
          to:   { opacity: '1', transform: 'tranzincY(0)' },
        },
        voteBounce: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.25)' },
        },
        toastIn: {
          from: { opacity: '0', transform: 'tranzincX(-50%) tranzincY(8px)' },
          to:   { opacity: '1', transform: 'tranzincX(-50%) tranzincY(0)' },
        },
        riseIn: {
          from: { opacity: '0', transform: 'tranzincY(12px)' },
          to:   { opacity: '1', transform: 'tranzincY(0)' },
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
