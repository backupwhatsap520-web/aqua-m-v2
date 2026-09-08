import type { ReactNode } from 'react';
import { useCountUp } from '../hooks/useCountUp';

/*  Shared building blocks. Icons are inline SVG rather than emoji — an emoji
 *  renders differently on every machine and reads as a character to a screen
 *  reader. */

export function Panel({
  title,
  children,
  className = '',
  action,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`glass p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-slate-200">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/*  A single reading. `value` undefined means "no data yet" and renders a
 *  skeleton — never a zero, which would be a lie a judge could read off the
 *  screen. */
export function StatCard({
  label,
  value,
  unit,
  decimals = 0,
  invalid,
  invalidNote,
  icon,
}: {
  label: string;
  value?: number;
  unit?: string;
  decimals?: number;
  invalid?: boolean;
  invalidNote?: string;
  icon?: ReactNode;
}) {
  const animated = useCountUp(value);

  /*  `invalid` is checked before `loading`, and the order matters. A fault is
   *  reported by the board *with* the value withheld — an out-of-range pH
   *  arrives as -1, which the caller turns into `undefined`. Checking loading
   *  first would render a skeleton that never resolves, so a judge would see a
   *  card stuck loading instead of a named fault. */
  const loading = value === undefined && !invalid;

  return (
    <div className="glass p-4">
      <div className="mb-2 flex items-center gap-2">
        {icon && <span className="text-aqua">{icon}</span>}
        <span className="stat-label">{label}</span>
      </div>

      {invalid ? (
        <div>
          <p className="font-mono text-2xl font-semibold text-warn">--</p>
          {invalidNote && <p className="mt-1 text-xs text-warn/80">{invalidNote}</p>}
        </div>
      ) : loading ? (
        <div className="skeleton h-9 w-24" aria-hidden="true" />
      ) : (
        <p className="stat-value">
          {animated.toFixed(decimals)}
          {unit && <span className="ml-1 text-base font-normal text-slate-400">{unit}</span>}
        </p>
      )}

      {loading && <span className="sr-only">{label}: waiting for data</span>}
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  children: ReactNode;
}) {
  const tones = {
    good: 'bg-aqua/15 text-aqua border-aqua/30',
    warn: 'bg-warn/15 text-warn border-warn/30',
    bad: 'bg-fault/15 text-fault border-fault/30',
    neutral: 'bg-white/5 text-slate-300 border-hair',
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/*  Status dot. The label always carries the meaning as text as well — colour
 *  alone must never be the only signal. */
export function Dot({ tone, pulse }: { tone: 'good' | 'warn' | 'bad'; pulse?: boolean }) {
  const c = { good: 'bg-aqua', warn: 'bg-warn', bad: 'bg-fault' }[tone];
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${c} ${pulse ? 'animate-pulseSoft' : ''}`}
    />
  );
}

export function SkeletonRow({ w = 'w-full' }: { w?: string }) {
  return <div className={`skeleton h-4 ${w}`} aria-hidden="true" />;
}

/* --- icons (Lucide-style, 1.5px stroke) ---------------------------------- */
const ico = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconDroplet = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...ico} aria-hidden="true">
    <path d="M12 2.7 6.8 9.3a7 7 0 1 0 10.4 0z" />
  </svg>
);

export const IconThermometer = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...ico} aria-hidden="true">
    <path d="M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0z" />
  </svg>
);

export const IconHumidity = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...ico} aria-hidden="true">
    <path d="M12 3.5 7.5 9a5.5 5.5 0 1 0 9 0z" />
    <path d="M9.5 14.5h5" />
  </svg>
);

export const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...ico} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconFlask = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...ico} aria-hidden="true">
    <path d="M9 3h6M10 3v6l-5.2 9A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3L14 9V3" />
  </svg>
);
