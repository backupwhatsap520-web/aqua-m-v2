/** @type {import('tailwindcss').Config} */
export default {
  //  These globs must match where the classes actually live, or custom colours
  //  and bg-aqua-gradient silently resolve to nothing.
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /*  ONE accent. `aqua` is the brand and the only colour that means
         *  "this is Aqua-M". Everything else is either neutral or a state.
         *
         *  `sky` is deliberately NOT a second accent: it appears only as a
         *  data series inside the chart, never on UI chrome. Two equally loud
         *  accents on near-black is the generic dark-tech look. */
        aqua: {
          DEFAULT: '#06D6A0',
          dim: '#059E77',
          wash: 'rgba(6,214,160,0.10)',
        },
        sky: '#4CC9F0',          // chart series only
        /*  State colours, used only for real state. Never decoration. */
        warn: '#F4A428',
        fault: '#E5484D',
        /*  The painting's ground. Warm viridian rather than the near-black
         *  the first version used: a dark screen reads as a default, a lit
         *  ground reads as a decision. Every step here is checked for AA
         *  contrast against ink-100 and ink-400. */
        canvas: '#16302A',
        ink: {
          950: '#10241F',
          900: '#193A32',        // panel over the painting
          850: '#1F453B',        // inset
          800: '#2A5A4C',        // hairline
          700: '#356E5C',
          600: '#44866F',
          400: '#9DB5AA',        // secondary text, 5.4:1 on canvas
          300: '#C2D5CB',
          100: '#EEF5F1',        // primary text
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: { tightest: '-0.04em' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        breathe: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '0.8' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        breathe: 'breathe 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
