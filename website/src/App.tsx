import { PaintedBackdrop } from './components/PaintedBackdrop';
import { useDeviceData } from './hooks/useDeviceData';
import { MonitoringTab } from './components/MonitoringTab';
import { PortfolioTab } from './components/PortfolioTab';
import { ContainerScroll } from './components/ui/container-scroll-animation';
import type { ConnectionState } from './types';

/*  One page, not two tabs.
 *
 *  The dashboard is the thing you came for, so it sits in the tilted frame at
 *  the top and straightens as you scroll into it. Everything about the project
 *  is below it, for whoever keeps reading. Nothing is hidden behind a tab that
 *  a judge might never press.
 */

function connectionCopy(state: ConnectionState, lastUpdate: number | null) {
  switch (state) {
    case 'unconfigured':
      return {
        tone: 'fault' as const,
        label: 'Not configured',
        detail: 'No Firebase settings found. Copy .env.example to .env and fill it in.',
      };
    case 'error':
      return {
        tone: 'fault' as const,
        label: 'No connection',
        detail: 'The dashboard is running, but no data is arriving from the database.',
      };
    case 'connecting':
      return {
        tone: 'warn' as const,
        label: 'Connecting',
        detail: 'Waiting for the first update from ESP32 A.',
      };
    case 'stale':
      return {
        tone: 'warn' as const,
        label: 'Stale',
        detail: lastUpdate
          ? `No update since ${new Date(lastUpdate).toLocaleTimeString()}. The readings below are not current.`
          : 'No recent update. The readings below are not current.',
      };
    case 'live':
    default:
      return { tone: 'accent' as const, label: 'Live', detail: '' };
  }
}

export default function App() {
  const feed = useDeviceData();
  const conn = connectionCopy(feed.connection, feed.lastUpdate);

  const toneText = {
    accent: 'text-accent-deep',
    warn: 'text-warn',
    fault: 'text-fault',
  }[conn.tone];

  return (
    <>
      <PaintedBackdrop />

      <div className="mx-auto min-h-[100dvh] max-w-[1180px] px-phi-4 pb-phi-7 pt-phi-4 sm:px-phi-5">
        <header className="mb-phi-6 flex flex-wrap items-center justify-between gap-phi-3">
          <span className="text-sm font-semibold tracking-tight text-ink">
            Aqua<span className="text-accent-deep">-M</span> V2
          </span>
          <span className={`num text-phi-sm ${toneText}`}>{conn.label}</span>
        </header>

        {conn.detail && (
          <div
            role="status"
            className={`mb-phi-4 rounded-lg border px-phi-4 py-phi-3 text-sm ${
              conn.tone === 'fault'
                ? 'border-fault/30 bg-fault/[0.06] text-fault'
                : 'border-warn/30 bg-warn/[0.07] text-warn'
            }`}
          >
            {conn.detail}
          </div>
        )}

        {/* --- the dashboard, in the frame ------------------------------- */}
        <ContainerScroll
          titleComponent={
            <>
              <p className="mb-phi-3 text-phi-sm font-medium uppercase tracking-[0.18em] text-cyan-deep">
                ISIF / IYSA
              </p>
              <h1 className="text-phi-xl font-semibold tracking-tightest text-ink lg:text-phi-2xl">
                Five pots. One robot.
                <br />
                <span className="text-accent-deep">No guessing.</span>
              </h1>
              <p className="mx-auto mt-phi-4 max-w-lg text-phi-base text-ink-muted">
                A rail-guided robot plants a probe in each pot, asks Gemini what the plant
                needs, and waters it. Lose the network and a rule on the board takes over.
              </p>
            </>
          }
        >
          <MonitoringTab feed={feed} />
        </ContainerScroll>

        {/* --- everything about the project ------------------------------ */}
        <div className="mt-phi-7">
          <PortfolioTab feed={feed} />
        </div>

        <footer className="mt-phi-7 border-t border-line pt-phi-4 text-phi-sm leading-relaxed text-ink-muted">
          Readings come from ESP32 A via Firebase. The hardware has not arrived yet, so
          nothing on this page has been measured on a robot.
        </footer>
      </div>
    </>
  );
}
