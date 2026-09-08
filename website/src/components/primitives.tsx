import type { ReactNode } from 'react';
import { useCountUp } from '../hooks/useCountUp';

/*  Shared parts.
 *
 *  Two rules this file exists to enforce:
 *
 *  1. A reading is not a card. Readings sit in a row separated by a hairline
 *     and space. A bordered container is reserved for something that genuinely
 *     sits above the page: the rail view, the control panel.
 *  2. A value that is missing and a value that is faulty are different things
 *     and must not look the same. Missing renders a skeleton. Faulty renders a
 *     dash and says what is wrong.
 */

/** One instrument reading in the top strip. */
export function Readout({
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

  /*  Order matters: a fault arrives with the value withheld, so checking
   *  loading first would render a skeleton that never resolves. */
  const loading = value === undefined && !invalid;

  return (
    <div className="flex-1 px-4 py-3 first:pl-0 sm:px-5 lg:px-6">
      <div className="mb-2 flex items-center gap-1.5 text-ink-400">
        {icon}
        <span className="text-[11px] font-medium tracking-wide">{label}</span>
      </div>

      {invalid ? (
        <>
          <p className="num text-2xl font-medium text-warn sm:text-3xl">--</p>
          {invalidNote && <p className="mt-0.5 text-[11px] text-warn/75">{invalidNote}</p>}
        </>
      ) : loading ? (
        <div className="skeleton h-8 w-20" aria-hidden="true" />
      ) : (
        <p className="num text-2xl font-medium text-ink-100 sm:text-3xl">
          {animated.toFixed(decimals)}
          {unit && <span className="ml-1 text-sm font-normal text-ink-400">{unit}</span>}
        </p>
      )}

      {loading && <span className="sr-only">{label}: waiting for data</span>}
    </div>
  );
}

/** A raised panel. Used sparingly, where elevation means something. */
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
    <section className={`surface p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-ink-100">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** A row of label and value, hairline-separated by the parent. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-ink-400">{label}</dt>
      <dd className="num text-right text-sm text-ink-100">{children}</dd>
    </div>
  );
}

export function Tag({
  tone = 'neutral',
  children,
}: {
  tone?: 'accent' | 'warn' | 'fault' | 'neutral';
  children: ReactNode;
}) {
  const tones = {
    accent: 'border-accent/35 bg-accent-wash text-accent',
    warn: 'border-warn/35 bg-warn/10 text-warn',
    fault: 'border-fault/35 bg-fault/10 text-fault',
    neutral: 'border-ink-700 bg-ink-850 text-ink-300',
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function SkeletonRow({ w = 'w-full' }: { w?: string }) {
  return <div className={`skeleton h-3.5 ${w}`} aria-hidden="true" />;
}
