import { useState } from 'react';
import { useDeviceData } from './hooks/useDeviceData';
import { MonitoringTab } from './components/MonitoringTab';
import { PortfolioTab } from './components/PortfolioTab';
import { Dot } from './components/primitives';
import type { ConnectionState } from './types';

type Tab = 'monitoring' | 'portfolio';

/*  The connection banner is the part that matters when things go wrong. A judge
 *  looking at a venue with bad Wi-Fi should see a sentence explaining it, not a
 *  white screen and not a frozen number labelled live. */
function connectionCopy(state: ConnectionState, lastUpdate: number | null) {
  switch (state) {
    case 'unconfigured':
      return {
        tone: 'bad' as const,
        label: 'Not configured',
        detail: 'No Firebase settings found. Copy .env.example to .env and fill it in.',
      };
    case 'error':
      return {
        tone: 'bad' as const,
        label: 'Cannot reach the database',
        detail: 'The dashboard is running, but no data is arriving.',
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
      return {
        tone: 'good' as const,
        label: 'Live',
        detail: lastUpdate ? `Updated ${new Date(lastUpdate).toLocaleTimeString()}` : '',
      };
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('monitoring');
  const feed = useDeviceData();
  const conn = connectionCopy(feed.connection, feed.lastUpdate);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'portfolio', label: 'Project' },
  ];

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-aqua-gradient font-bold text-abyss"
            aria-hidden="true"
          >
            A
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight text-slate-100">Aqua-M V2</h1>
            <p className="text-xs text-slate-500">Smart irrigation robot</p>
          </div>
        </div>

        <div className="glass flex items-center gap-2 px-3 py-2">
          <Dot tone={conn.tone} pulse={feed.connection === 'live'} />
          <span className="text-xs font-medium text-slate-200">{conn.label}</span>
        </div>
      </header>

      {/*  Not an aria-live region: it is present from first paint, and
          announcing it on every reconnect would be noise. */}
      {conn.detail && feed.connection !== 'live' && (
        <div
          role="status"
          className={`glass px-4 py-3 text-sm ${
            conn.tone === 'bad' ? 'text-fault' : 'text-warn'
          }`}
        >
          {conn.detail}
        </div>
      )}

      <nav aria-label="Sections">
        <div role="tablist" className="glass inline-flex gap-1 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] cursor-pointer rounded-xl px-5 text-sm font-medium transition-colors duration-200 ${
                tab === t.id
                  ? 'bg-aqua/15 text-aqua'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="flex-1"
      >
        {tab === 'monitoring' ? <MonitoringTab feed={feed} /> : <PortfolioTab feed={feed} />}
      </main>

      <footer className="pt-2 text-center text-xs leading-relaxed text-slate-600">
        Readings come from ESP32 A via Firebase. Figures quoted in the project tab are
        software-in-the-loop simulation, not hardware measurement.
      </footer>
    </div>
  );
}
