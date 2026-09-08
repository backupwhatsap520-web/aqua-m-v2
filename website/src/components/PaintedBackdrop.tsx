import { useEffect, useState } from 'react';

/*  The page ground: an oil painting rather than a dark screen.
 *
 *  WHY THIS IS A BACKGROUND-IMAGE AND NOT INLINE SVG
 *
 *  The first version put this SVG straight in the DOM. It looked right and it
 *  broke the 3D view: feTurbulence at four octaves across the viewport, plus
 *  two displacement maps, is expensive enough that the compositor never gave
 *  the WebGL canvas a frame. The rail panel stayed transparent, with no error
 *  anywhere, which took a while to pin down.
 *
 *  As a CSS background-image the same SVG is rasterised once and cached, so
 *  the filters cost nothing after first paint and WebGL gets its frames back.
 *
 *  Split-complementary: violet-plum ground, green foliage, two low warm
 *  passages in amber. Green over violet is also how a painter gets foliage
 *  to read as lit rather than as a flat wash.
 *
 *  The painting itself, in layers:
 *    1. Pigment, clean. Palette-knife fields, leaves and water in a warm
 *       viridian family, with knife filters roughening the edges.
 *    2. Relief. Fractal noise lit by feDiffuseLighting from the upper left,
 *       blended soft-light so thick paint catches the light. Running colour
 *       THROUGH the lighting filter instead of over it washes it out to grey,
 *       which was the first thing that went wrong here.
 *    3. Canvas weave, fainter still.
 */

const LEAVES = [
  { x: 128, y: 178, s: 1.5, r: -28, f: '%238CC63F', o: 0.62 },
  { x: 1296, y: 626, s: 1.85, r: 33, f: '%237CB93A', o: 0.52 },
  { x: 986, y: 132, s: 1.05, r: 11, f: '%239ED155', o: 0.44 },
  { x: 452, y: 742, s: 1.32, r: -54, f: '%236FAE33', o: 0.58 },
  { x: 712, y: 268, s: 0.82, r: 67, f: '%23A9D96A', o: 0.3 },
  { x: 46, y: 452, s: 0.95, r: 6, f: '%2382BF3C', o: 0.38 },
  { x: 1130, y: 806, s: 1.15, r: -14, f: '%2374B336', o: 0.4 },
  { x: 830, y: 700, s: 0.7, r: 44, f: '%239ED155', o: 0.26 },
];

const WATER = [
  { x: 40, y: 452, w: 470, o: 0.34 },
  { x: 400, y: 500, w: 360, o: 0.26 },
  { x: 690, y: 540, w: 590, o: 0.3 },
  { x: 150, y: 592, w: 300, o: 0.22 },
  { x: 860, y: 640, w: 440, o: 0.26 },
  { x: 300, y: 690, w: 380, o: 0.2 },
];

/*  Hashes are percent-encoded inline because the whole thing becomes a URL. */
const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 900' preserveAspectRatio='xMidYMid slice'>
<defs>
<linearGradient id='w' x1='0.1' y1='0' x2='0.9' y2='1'>
<stop offset='0%' stop-color='%23FBFAF5'/><stop offset='42%' stop-color='%23F5F3EB'/><stop offset='100%' stop-color='%23EFEDE2'/>
</linearGradient>
<filter id='k' x='-15%' y='-15%' width='130%' height='130%'>
<feTurbulence type='fractalNoise' baseFrequency='0.022' numOctaves='3' seed='9'/>
<feDisplacementMap in='SourceGraphic' scale='26' xChannelSelector='R' yChannelSelector='G'/>
</filter>
<filter id='kf' x='-15%' y='-15%' width='130%' height='130%'>
<feTurbulence type='fractalNoise' baseFrequency='0.05' numOctaves='2' seed='21'/>
<feDisplacementMap in='SourceGraphic' scale='9' xChannelSelector='R' yChannelSelector='G'/>
</filter>
<filter id='r'>
<feTurbulence type='fractalNoise' baseFrequency='0.62' numOctaves='4' seed='11' result='g'/>
<feDiffuseLighting in='g' lighting-color='%23ffffff' surfaceScale='3' diffuseConstant='1'>
<feDistantLight azimuth='225' elevation='46'/></feDiffuseLighting>
</filter>
<filter id='v'>
<feTurbulence type='turbulence' baseFrequency='0.85 0.62' numOctaves='1' seed='3'/>
<feColorMatrix type='saturate' values='0'/>
</filter>
</defs>
<rect width='1440' height='900' fill='url(%23w)'/>
<g filter='url(%23k)'>
<path d='M-80 90 C 240 20, 520 170, 780 96 C 1000 34, 1200 130, 1520 46 L1520 -60 L-80 -60 Z' fill='%23DFF0F5' opacity='0.85'/>
<path d='M-80 800 C 260 742, 430 880, 720 830 C 1010 782, 1240 886, 1520 820 L1520 980 L-80 980 Z' fill='%23E4EDDD' opacity='0.9'/>
<ellipse cx='1210' cy='250' rx='330' ry='200' fill='%23CDE9F1' opacity='0.35'/>
<ellipse cx='190' cy='640' rx='280' ry='185' fill='%23E8F2DC' opacity='0.45'/>
<ellipse cx='640' cy='430' rx='420' ry='150' fill='%23F1EFE6' opacity='0.3'/><ellipse cx='1090' cy='120' rx='210' ry='120' fill='%2317B9D6' opacity='0.14'/><ellipse cx='330' cy='858' rx='260' ry='90' fill='%238CC63F' opacity='0.1'/>
</g>
<g filter='url(%23kf)'>
${WATER.map(
  (s) =>
    `<rect x='${s.x}' y='${s.y}' width='${s.w}' height='11' rx='5' fill='%2317B9D6' opacity='${s.o}'/>`,
).join('')}
</g>
<g filter='url(%23kf)'>
${LEAVES.map(
  (l) =>
    `<g transform='translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})' opacity='${l.o}'>` +
    `<path d='M0 0 C 32 -48, 94 -54, 126 -8 C 96 42, 30 46, 0 0 Z' fill='${l.f}'/>` +
    `<path d='M2 -2 C 42 -16, 88 -14, 126 -8' stroke='%23E4EDDD' stroke-width='2.5' fill='none' opacity='0.45'/>` +
    `</g>`,
).join('')}
</g>
<rect width='1440' height='900' filter='url(%23r)' opacity='0.22' style='mix-blend-mode:soft-light'/>
<rect width='1440' height='900' filter='url(%23v)' opacity='0.06' style='mix-blend-mode:overlay'/>
</svg>`
  .replace(/\n/g, '')
  .replace(/"/g, "'");

const source = `data:image/svg+xml,${svg.replace(/#/g, '%23')}`;

/*  Bake the painting to a raster once, then throw the filters away.
 *
 *  Leaving the SVG anywhere the compositor can see it — inline, or even as a
 *  background-image — starves the WebGL canvas next to it: the rail panel
 *  renders transparent and nothing reports an error. Drawing it into a 2D
 *  canvas once and handing back a PNG means there is no filter left in the
 *  document at all, and the 3D view gets its frames.
 *
 *  Until the bake finishes the page shows bg-paper, which is the same family
 *  of green, so there is no flash of a different colour.
 */
function usePaintedRaster(width = 1440, height = 900) {
  const [raster, setRaster] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.decoding = 'async';

    img.onload = () => {
      if (cancelled) return;
      try {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        setRaster(c.toDataURL('image/png'));
      } catch {
        //  Tainted canvas or no 2D context: fall back to the flat ground.
        //  A missing painting is a cosmetic loss; a dead dashboard is not.
      }
    };

    img.src = source;
    return () => {
      cancelled = true;
    };
  }, [width, height]);

  return raster;
}

export function PaintedBackdrop() {
  const raster = usePaintedRaster();

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-paper">
      {raster && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${raster})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      {/*  A short settle at the top so the header and the connection line always
          sit on calm ground, whatever the painting is doing up there. */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-paper/75 to-transparent" />
    </div>
  );
}
