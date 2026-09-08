/** @type {import('tailwindcss').Config} */

/*  COLOUR
 *
 *  Paper-dominant, with cyan and young leaf green doing the work.
 *
 *    paper    warm white, the ground everything sits on
 *    ink      deep green-slate, the text
 *    cyan     #17B9D6   the interactive colour
 *    leaf     #8CC63F   young leaf, growth and healthy state
 *    accent   #06D6A0   the brand green, kept for the machine itself
 *
 *  Cyan and leaf sit either side of the brand green on the wheel, so the
 *  three read as one family without any of them going flat, and the warm
 *  white keeps them from turning acidic. Amber and rose are state only.
 *
 *  Names are semantic rather than numeric on purpose: in a light theme a
 *  scale where `ink-900` means near-white is a trap for whoever edits next.
 *
 *  SPACING
 *
 *  Fibonacci, so successive steps approach the golden ratio. Every gap,
 *  padding and column split comes from this scale or from the phi grid
 *  templates below, not from Tailwind's linear 4px steps.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F7F5EF', // page
          2: '#FCFBF7', // raised surface
          3: '#EFEDE4', // inset / track
        },
        ink: {
          DEFAULT: '#16241E', // primary text, 14.9:1 on paper
          soft: '#3B4E45',
          muted: '#4F6459', // secondary text, 6.4:1 on paper
        },
        line: {
          DEFAULT: '#DDE2D9',
          strong: '#C3CCC1',
        },
        cyan: { DEFAULT: '#17B9D6', deep: '#0E8FA8', wash: 'rgba(23,185,214,0.10)' },
        leaf: { DEFAULT: '#8CC63F', deep: '#5F9425', wash: 'rgba(140,198,63,0.14)' },
        accent: { DEFAULT: '#06D6A0', deep: '#04A67C', wash: 'rgba(6,214,160,0.12)' },
        warn: '#C77A16',
        fault: '#C64A55',
        series: { a: '#0E8FA8', b: '#5F9425', c: '#C77A16' },
      },
      spacing: {
        'phi-1': '0.3125rem',
        'phi-2': '0.5rem',
        'phi-3': '0.8125rem',
        'phi-4': '1.3125rem',
        'phi-5': '2.125rem',
        'phi-6': '3.4375rem',
        'phi-7': '5.5625rem',
      },
      gridTemplateColumns: {
        phi: '1.618fr 1fr',
        'phi-r': '1fr 1.618fr',
      },
      fontSize: {
        'phi-sm': ['0.7rem', { lineHeight: '1.5' }],
        'phi-base': ['1rem', { lineHeight: '1.6' }],
        'phi-lg': ['1.618rem', { lineHeight: '1.3' }],
        'phi-xl': ['2.618rem', { lineHeight: '1.12' }],
        'phi-2xl': ['4.236rem', { lineHeight: '1.02' }],
      },
      fontFamily: {
        sans: ['"Space Grotesk Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: { tightest: '-0.04em' },
      keyframes: { shimmer: { '100%': { transform: 'translateX(100%)' } } },
      animation: { shimmer: 'shimmer 1.6s infinite' },
    },
  },
  plugins: [],
};
