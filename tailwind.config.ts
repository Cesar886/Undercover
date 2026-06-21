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
      backgroundImage: {
        'footer-glow-light': 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(114,91,144,0.07) 0%, transparent 70%)',
        'footer-glow-dark': 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(124,58,237,0.14) 0%, transparent 70%)',
        'footer-line-light': 'linear-gradient(90deg, transparent 0%, rgba(170,151,194,0.25) 30%, rgba(114,91,144,0.45) 50%, rgba(170,151,194,0.25) 70%, transparent 100%)',
        'footer-line-dark': 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.2) 30%, rgba(167,139,250,0.5) 50%, rgba(139,92,246,0.2) 70%, transparent 100%)',
        'footer-wordmark': 'linear-gradient(135deg, #aa97c2 0%, #725b90 45%, #43325a 100%)',
        'footer-divider-left': 'linear-gradient(90deg, transparent, rgba(139,92,246,0.15))',
        'footer-divider-right': 'linear-gradient(270deg, transparent, rgba(139,92,246,0.15))',
        'footer-link-underline': 'linear-gradient(90deg, #7c3aed, #a78bfa)',
        'app-bottom-glow-dark': 'radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.08) 0%, transparent 70%)',
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        newPostSlide: {
          from: { opacity: '0', transform: 'translateY(-10px) scale(0.98)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Pop suave al seleccionar — spring con ligero overshoot
        fbPop: {
          '0%':   { transform: 'scale(1)' },
          '25%':  { transform: 'scale(1.28)' },
          '55%':  { transform: 'scale(0.94)' },
          '75%':  { transform: 'scale(1.06)' },
          '90%':  { transform: 'scale(0.98)' },
          '100%': { transform: 'scale(1)' },
        },
        // Fantasma que sube con fade-out y leve rotación aleatoria
        fbFloat: {
          '0%':   { opacity: '1',  transform: 'translateY(0)    scale(1.15)' },
          '40%':  { opacity: '0.9' },
          '100%': { opacity: '0',  transform: 'translateY(-42px) scale(0.85)' },
        },
        // Picker: entrada con spring suave desde abajo
        pickerIn: {
          '0%':   { opacity: '0', transform: 'scale(0.85) translateY(10px)' },
          '60%':  { opacity: '1', transform: 'scale(1.02) translateY(-2px)' },
          '100%': { opacity: '1', transform: 'scale(1)    translateY(0)' },
        },
        // Cada emoji: aparece con spring y rebote
        emojiEnter: {
          '0%':   { opacity: '0', transform: 'scale(0.4)  translateY(8px)' },
          '60%':  { opacity: '1', transform: 'scale(1.12) translateY(-2px)' },
          '80%':  { opacity: '1', transform: 'scale(0.96) translateY(1px)' },
          '100%': { opacity: '1', transform: 'scale(1)    translateY(0)' },
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
        'fade-slide-in':      'fadeSlideIn 0.2s ease-out',
        'new-post-slide':     'newPostSlide 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fb-pop':             'fbPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fb-float':           'fbFloat 0.55s ease-out forwards',
        'picker-in':          'pickerIn 0.25s cubic-bezier(0.34, 1.4, 0.64, 1) both',
        'emoji-enter':        'emojiEnter 0.3s cubic-bezier(0.34, 1.5, 0.64, 1) both',
        'toast-in':           'toastIn 0.2s ease-out',
        'rise-in':            'riseIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in':            'fadeIn 0.4s ease-out',
      },
    },
  },
  plugins: [],
};
export default config;
