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
        /*  Cool neutral ramp on the team's #0a0f1a ground. */
        ink: {
          950: '#0a0f1a',        // page
          900: '#0E141F',        // raised surface
          850: '#131A26',        // input / inset
          800: '#1A2231',
          700: '#26303F',        // hairline strong
          600: '#3A465A',
          400: '#7E8CA3',        // secondary text
          300: '#A7B2C4',
          100: '#E6EBF2',        // primary text
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
