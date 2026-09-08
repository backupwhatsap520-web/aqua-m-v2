import { useMemo, useState } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { DeviceFeed } from '../hooks/useDeviceData';
import { missionStateLabel } from '../types';
import {
  Badge,
  Dot,
  IconDroplet,
  IconFlask,
  IconHumidity,
  IconSun,
  IconThermometer,
  Panel,
  SkeletonRow,
  StatCard,
} from './primitives';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const POTS = [1, 2, 3, 4, 5];

export function MonitoringTab({ feed }: { feed: DeviceFeed }) {
  const { data, connection, history, sendCommand } = feed;
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const a = data?.esp32_a;
  const b = data?.esp32_b?.status;
  const sensors = a?.sensors;
  const status = a?.status;
  const decision = a?.ai_decision;
  const weather = a?.weather;

  const offline = connection === 'unconfigured' || connection === 'error';

  /*  pH is written as -1 when the probe reading was invalid (DOCUMENTATION §8).
   *  Rendering -1 as a pH would be a wrong number a judge could read. */
  const phInvalid = sensors?.pH !== undefined && sensors.pH < 0;

  /*  ChartOptions<'line'> is strict about interaction.mode and scale shapes, so
   *  the object is typed explicitly rather than inferred. */
  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: '#cbd5e1', boxWidth: 10, boxHeight: 10, usePointStyle: true },
        },
        tooltip: {
          backgroundColor: 'rgba(10,15,26,0.95)',
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 6 },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          ticks: { color: '#64748b' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          suggestedMin: 0,
          suggestedMax: 100,
        },
      },
    }),
    [],
  );

  const chartData = useMemo(() => {
    const labels = history.map((s) =>
      new Date(s.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    );
    return {
      labels,
      datasets: [
        {
          label: 'Soil moisture (%)',
          data: history.map((s) => s.soil ?? null),
          borderColor: '#06D6A0',
          backgroundColor: 'rgba(6,214,160,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          spanGaps: true,
        },
        {
          label: 'Humidity (%)',
          data: history.map((s) => s.humidity ?? null),
          borderColor: '#4CC9F0',
          backgroundColor: 'rgba(76,201,240,0.10)',
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          spanGaps: true,
        },
        {
          label: 'Temperature (C)',
          data: history.map((s) => s.temperature ?? null),
          borderColor: '#FFB703',
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          spanGaps: true,
          borderDash: [4, 4],
        },
      ],
    };
  }, [history]);

  const run = async (label: string, action: string, pot?: number) => {
    setBusy(label);
    setNotice(null);
    const err = await sendCommand(action, pot);
    setBusy(null);
    setNotice(err ?? `Sent: ${label}`);
  };

  return (
    <div className="space-y-4">
      {/* --- readings ---------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Soil moisture"
          value={sensors?.soil_moisture}
          unit="%"
          icon={<IconDroplet />}
          invalid={status?.soil_fault}
          invalidNote="probe fault"
        />
        <StatCard
          label="Temperature"
          value={sensors?.temperature}
          unit="C"
          decimals={1}
          icon={<IconThermometer />}
          invalid={status?.dht_fault}
          invalidNote="sensor fault"
        />
        <StatCard
          label="Humidity"
          value={sensors?.humidity}
          unit="%"
          decimals={0}
          icon={<IconHumidity />}
          invalid={status?.dht_fault}
          invalidNote="sensor fault"
        />
        <StatCard
          label="pH"
          value={phInvalid ? undefined : sensors?.pH}
          decimals={2}
          icon={<IconFlask />}
          invalid={phInvalid}
          invalidNote="reading out of range"
        />
        <StatCard
          label="Light"
          value={sensors?.light_intensity}
          unit="lx"
          icon={<IconSun />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- chart ----------------------------------------------------- */}
        <Panel
          title="Last 10 minutes"
          className="lg:col-span-2"
          action={
            <span className="text-xs text-slate-500">
              {history.length > 0 ? `${history.length} samples` : 'no samples yet'}
            </span>
          }
        >
          <div className="h-64">
            {history.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <div className="skeleton h-40 w-full" aria-hidden="true" />
                <p className="text-xs text-slate-500">
                  {offline
                    ? 'History starts once the dashboard can reach the database.'
                    : 'Waiting for the first reading from ESP32 A.'}
                </p>
              </div>
            ) : (
              <Line options={chartOptions} data={chartData} />
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            History is collected by this browser tab while it is open. The board does not
            store one, so reloading the page starts it again.
          </p>
        </Panel>

        {/* --- decision -------------------------------------------------- */}
        <Panel title="Latest decision">
          {!decision ? (
            <div className="space-y-2">
              <SkeletonRow w="w-1/2" />
              <SkeletonRow />
              <SkeletonRow w="w-3/4" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone={status?.decision_source === 'AI' ? 'good' : 'neutral'}>
                  {status?.decision_source === 'AI' ? 'Gemini' : 'Local rule'}
                </Badge>
                {decision.pump_water && (
                  <Badge tone="good">Water {(decision.water_duration ?? 0) / 1000}s</Badge>
                )}
                {decision.pump_fertilizer && (
                  <Badge tone="good">
                    Fertiliser {(decision.fertilizer_duration ?? 0) / 1000}s
                  </Badge>
                )}
                {decision.fertilizer_deferred && <Badge tone="warn">Fertiliser deferred</Badge>}
              </div>
              <p className="text-sm leading-relaxed text-slate-300">
                {decision.reason || 'No reason recorded.'}
              </p>
              {decision.timestamp && (
                <p className="font-mono text-[11px] text-slate-500">{decision.timestamp}</p>
              )}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- robot ----------------------------------------------------- */}
        <Panel title="Robot">
          <dl className="space-y-2.5 text-sm">
            <Row label="Mission">
              {status?.mission_state === undefined ? (
                <SkeletonRow w="w-24" />
              ) : (
                missionStateLabel(status.mission_state)
              )}
            </Row>
            <Row label="At pot">
              {b?.current_pot === undefined ? <SkeletonRow w="w-8" /> : b.current_pot}
            </Row>
            <Row label="Moving">
              {b?.moving === undefined ? (
                <SkeletonRow w="w-10" />
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Dot tone={b.moving ? 'warn' : 'good'} pulse={b.moving} />
                  {b.moving ? 'Yes' : 'No'}
                </span>
              )}
            </Row>
            <Row label="Pumps">
              {status?.pump_active === undefined ? (
                <SkeletonRow w="w-14" />
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Dot tone={status.pump_active ? 'warn' : 'good'} pulse={status.pump_active} />
                  {status.pump_active ? 'Running' : 'Off'}
                </span>
              )}
            </Row>
            {b?.error ? (
              <Row label="Error">
                <span className="text-fault">{b.error}</span>
              </Row>
            ) : null}
          </dl>
        </Panel>

        {/* --- weather --------------------------------------------------- */}
        <Panel title="Weather">
          {!weather ? (
            <div className="space-y-2">
              <SkeletonRow w="w-2/3" />
              <SkeletonRow w="w-1/2" />
            </div>
          ) : (
            <dl className="space-y-2.5 text-sm">
              <Row label="Condition">{weather.condition || '--'}</Row>
              <Row label="Outside">
                {weather.temp_out !== undefined ? `${weather.temp_out.toFixed(1)} C` : '--'}
              </Row>
              <Row label="Humidity">
                {weather.humidity_out !== undefined ? `${weather.humidity_out.toFixed(0)} %` : '--'}
              </Row>
            </dl>
          )}
        </Panel>

        {/* --- control --------------------------------------------------- */}
        <Panel title="Control">
          <p className="mb-3 text-xs text-slate-500">
            Commands are written to Firebase. ESP32 A polls every 3 seconds and only while
            idle, so expect a short delay.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {POTS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={offline || busy !== null}
                onClick={() => run(`pot ${p}`, 'goto', p)}
                className="min-h-[44px] min-w-[44px] cursor-pointer rounded-xl border border-hair bg-white/[0.04] px-4 font-mono text-sm text-slate-200 transition-colors duration-200 hover:border-aqua/50 hover:bg-aqua/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={offline || busy !== null}
              onClick={() => run('return home', 'return')}
              className="min-h-[44px] flex-1 cursor-pointer rounded-xl border border-hair bg-white/[0.04] px-4 text-sm text-slate-200 transition-colors duration-200 hover:border-sky/50 hover:bg-sky/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Return home
            </button>
            <button
              type="button"
              disabled={offline || busy !== null}
              onClick={() => run('stop', 'stop')}
              className="min-h-[44px] flex-1 cursor-pointer rounded-xl border border-fault/40 bg-fault/10 px-4 text-sm font-medium text-fault transition-colors duration-200 hover:bg-fault/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Stop
            </button>
          </div>

          <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-xs text-slate-400">
            {busy ? `Sending ${busy}...` : notice}
          </p>

          {offline && (
            <p className="mt-2 text-xs text-warn">
              Controls are disabled because the database cannot be reached.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-mono text-slate-100">{children}</dd>
    </div>
  );
}
