/** @type {import('tailwindcss').Config} */
export default {
  //  These globs must match where the classes actually live, or custom colours
  //  and bg-aqua-gradient silently resolve to nothing.
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        //  Team-specified palette. Do not "improve" these.
        aqua:  '#06D6A0',   // primary accent, healthy state
        sky:   '#4CC9F0',   // secondary accent, data lines
        abyss: '#0a0f1a',   // page background
        panel: 'rgba(255,255,255,0.05)',
        hair:  'rgba(255,255,255,0.12)',
        warn:  '#FFB703',
        fault: '#EF476F',
      },
      backgroundImage: {
        'aqua-gradient': 'linear-gradient(135deg, #06D6A0 0%, #4CC9F0 100%)',
      },
      fontFamily: {
        sans: ['"Fira Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      backdropBlur: { glass: '14px' },
      keyframes: {
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
        shimmer:   { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        pulseSoft: 'pulseSoft 2s ease-in-out infinite',
        shimmer:   'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
