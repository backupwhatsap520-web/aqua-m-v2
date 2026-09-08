import { useState } from 'react';
import { PaintedBackdrop } from './components/PaintedBackdrop';
import { useDeviceData } from './hooks/useDeviceData';
import { MonitoringTab } from './components/MonitoringTab';
import { PortfolioTab } from './components/PortfolioTab';
import type { ConnectionState } from './types';

type Tab = 'monitoring' | 'project';

/*  The connection line is the part that matters when things go wrong. Someone
 *  looking at a venue with bad Wi-Fi should get a sentence explaining it, not a
 *  white screen and not a frozen number labelled live. */
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
  const [tab, setTab] = useState<Tab>('monitoring');
  const feed = useDeviceData();
  const conn = connectionCopy(feed.connection, feed.lastUpdate);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'project', label: 'Project' },
  ];

  const toneText = {
    accent: 'text-accent',
    warn: 'text-warn',
    fault: 'text-fault',
  }[conn.tone];

  return (
    <>
      <PaintedBackdrop />
      <div className="mx-auto flex min-h-[100dvh] max-w-[1200px] flex-col px-4 py-5 sm:px-6 sm:py-7">
      {/* nav: one line, under 80px, tabs and status share it */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-tight text-ink-100">
            Aqua<span className="text-accent">-M</span> V2
          </span>

          <nav aria-label="Sections">
            <div role="tablist" className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`min-h-[40px] cursor-pointer rounded-lg px-3.5 text-sm transition-colors duration-200 ${
                    tab === t.id
                      ? 'bg-ink-850 text-ink-100'
                      : 'text-ink-400 hover:text-ink-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>
        </div>

        <span className={`num text-xs ${toneText}`}>{conn.label}</span>
      </header>

      {conn.detail && (
        <div
          role="status"
          className={`mb-5 rounded-lg border px-4 py-2.5 text-sm ${
            conn.tone === 'fault'
              ? 'border-fault/30 bg-fault/[0.07] text-fault'
              : 'border-warn/30 bg-warn/[0.07] text-warn'
          }`}
        >
          {conn.detail}
        </div>
      )}

      <main role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex-1">
        {tab === 'monitoring' ? <MonitoringTab feed={feed} /> : <PortfolioTab feed={feed} />}
      </main>

      <footer className="mt-10 border-t border-ink-800 pt-5 text-xs leading-relaxed text-ink-400">
        Readings come from ESP32 A via Firebase. Figures quoted on the project page are
        software-in-the-loop simulation, not hardware measurement.
      </footer>
      </div>
    </>
  );
}
