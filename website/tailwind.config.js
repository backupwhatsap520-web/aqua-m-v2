/** @type {import('tailwindcss').Config} */

/*  COLOUR
 *
 *  Split-complementary, built off the brand accent.
 *
 *    accent   #06D6A0   hue 165   spring green, the brand
 *    ground   hue ~278  violet-plum, from the far side of the wheel
 *    warm     hue  38   amber, the second half of the split
 *    fault    hue 358   rose
 *
 *  The previous version was analogous — greens and teals only. Safe, and
 *  flat: with nothing opposite it, the accent had nothing to push against.
 *  A violet ground makes the same green read twice as bright without
 *  touching the green itself, which is also how a painter gets foliage to
 *  sing: green leaves over violet shadow.
 *
 *  SPACING
 *
 *  Fibonacci, so successive steps approach the golden ratio. Every gap,
 *  padding and column split on the page comes from this scale or from the
 *  phi grid templates below, rather than from Tailwind's linear 4px steps.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#06D6A0',
          dim: '#04A67C',
          wash: 'rgba(6,214,160,0.12)',
        },
        //  Second half of the split. Used for real state and for warmth in
        //  the painting, never as a second brand colour.
        warm: '#F5A524',
        fault: '#F2557A',
        //  Chart series only.
        series: { a: '#06D6A0', b: '#8B7BF7', c: '#F5A524' },

        canvas: '#221B33',
        ink: {
          950: '#191426',
          900: '#271F3A', // panel
          850: '#302647', // inset
          800: '#3D3059', // hairline
          700: '#4E3E70',
          600: '#65538C',
          400: '#AFA3C8', // secondary text, 6.0:1 on canvas
          300: '#D0C8E2',
          100: '#F2EEF9', // primary text
        },
      },
      spacing: {
        //  Fibonacci, in rem. phi-5 is 2.125rem, phi-6 is 3.4375rem, and so on.
        'phi-1': '0.3125rem',
        'phi-2': '0.5rem',
        'phi-3': '0.8125rem',
        'phi-4': '1.3125rem',
        'phi-5': '2.125rem',
        'phi-6': '3.4375rem',
        'phi-7': '5.5625rem',
      },
      gridTemplateColumns: {
        //  1.618 : 1 and its inverse, for the two-column splits.
        phi: '1.618fr 1fr',
        'phi-r': '1fr 1.618fr',
      },
      fontSize: {
        //  A 1.618 type scale from a 1rem body, rounded to sane pixels.
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
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { shimmer: 'shimmer 1.6s infinite' },
    },
  },
  plugins: [],
};
