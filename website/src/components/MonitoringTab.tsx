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
import {
  Drop,
  Flask,
  Sun,
  Thermometer,
  Waves,
} from '@phosphor-icons/react';
import type { DeviceFeed } from '../hooks/useDeviceData';
import { missionStateLabel } from '../types';
import { RailScene } from './RailScene';
import { Field, Panel, Readout, SkeletonRow, Tag } from './primitives';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const POTS = [1, 2, 3, 4, 5];
const ICON = { size: 15, weight: 'regular' as const };

/*  Mission states where the probe is in the soil: ST_SETTLE (4) through
 *  ST_IRRIGATE_OFF (9). Matches probeIsPlanted() in AquaM_ESP32_A. */
const PLANTED_FROM = 4;
const PLANTED_TO = 9;

export function MonitoringTab({ feed }: { feed: DeviceFeed }) {
  const { data, connection, history, sendCommand } = feed;
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  //  The pot the operator has asked for. Held until the robot actually reports
  //  arriving there, so the scene never claims a position it has not reached.
  const [requested, setRequested] = useState<number | null>(null);

  const a = data?.esp32_a;
  const b = data?.esp32_b?.status;
  const sensors = a?.sensors;
  const status = a?.status;
  const decision = a?.ai_decision;
  const weather = a?.weather;

  const offline = connection === 'unconfigured' || connection === 'error';
  const ms = status?.mission_state;
  const planted = ms !== undefined && ms >= PLANTED_FROM && ms <= PLANTED_TO;

  /*  pH arrives as -1 when the probe reading was rejected (DOCUMENTATION §8).
   *  Rendering that as a pH would be a wrong number a judge could read off. */
  const phInvalid = sensors?.pH !== undefined && sensors.pH < 0;

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          align: 'end',
          labels: {
            color: '#7E8CA3',
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            font: { size: 11 },
          },
        },
        tooltip: {
          backgroundColor: '#0E141F',
          borderColor: '#26303F',
          borderWidth: 1,
          titleColor: '#E6EBF2',
          bodyColor: '#A7B2C4',
          padding: 10,
          displayColors: true,
        },
      },
      scales: {
        x: { ticks: { color: '#3A465A', maxTicksLimit: 6, font: { size: 10 } }, grid: { display: false } },
        y: {
          ticks: { color: '#3A465A', font: { size: 10 } },
          grid: { color: 'rgba(38,48,63,0.5)' },
          border: { display: false },
          suggestedMin: 0,
          suggestedMax: 100,
        },
      },
    }),
    [],
  );

  const chartData = useMemo(
    () => ({
      labels: history.map((s) =>
        new Date(s.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ),
      datasets: [
        {
          label: 'Soil',
          data: history.map((s) => s.soil ?? null),
          borderColor: '#06D6A0',
          backgroundColor: 'rgba(6,214,160,0.10)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          spanGaps: true,
        },
        {
          label: 'Humidity',
          data: history.map((s) => s.humidity ?? null),
          borderColor: '#4CC9F0',
          borderWidth: 1.5,
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          spanGaps: true,
        },
        {
          label: 'Temp',
          data: history.map((s) => s.temperature ?? null),
          borderColor: '#F4A428',
          borderWidth: 1.5,
          borderDash: [3, 3],
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          spanGaps: true,
        },
      ],
    }),
    [history],
  );

  const run = async (label: string, action: string, pot?: number) => {
    setBusy(label);
    setNotice(null);
    if (pot !== undefined) setRequested(pot);
    const err = await sendCommand(action, pot);
    setBusy(null);
    setNotice(err ?? `Sent: ${label}`);
    if (err) setRequested(null);
  };

  /*  Clear the request once the robot reports it got there. Derived during
   *  render rather than kept in a second piece of state, so the marker cannot
   *  drift out of step with the position the board reports. */
  const pendingPot = requested !== null && b?.current_pot !== requested ? requested : null;

  return (
    <div className="space-y-phi-4">
      {/* --- the rail, and the readings taken from it -------------------- */}
      <section className="surface overflow-hidden p-phi-3 sm:p-phi-4">
        <RailScene
          currentPot={b?.current_pot ?? null}
          requestedPot={pendingPot}
          planted={planted}
          pumping={Boolean(status?.pump_active)}
          degraded={offline}
          disabled={offline || busy !== null}
          onSelect={(p) => run(`pot ${p}`, 'goto', p)}
        />

        <div className="flex flex-wrap divide-x divide-line border-t border-line px-4 sm:px-5">
          <Readout
            label="Soil"
            value={sensors?.soil_moisture}
            unit="%"
            icon={<Drop {...ICON} />}
            invalid={status?.soil_fault}
            invalidNote="probe fault"
          />
          <Readout
            label="Temp"
            value={sensors?.temperature}
            unit="C"
            decimals={1}
            icon={<Thermometer {...ICON} />}
            invalid={status?.dht_fault}
            invalidNote="sensor fault"
          />
          <Readout
            label="Humidity"
            value={sensors?.humidity}
            unit="%"
            icon={<Waves {...ICON} />}
            invalid={status?.dht_fault}
            invalidNote="sensor fault"
          />
          <Readout
            label="pH"
            value={phInvalid ? undefined : sensors?.pH}
            decimals={2}
            icon={<Flask {...ICON} />}
            invalid={phInvalid}
            invalidNote="out of range"
          />
          <Readout
            label="Light"
            value={sensors?.light_intensity}
            unit="lx"
            icon={<Sun {...ICON} />}
          />
        </div>
      </section>

      <div className="grid gap-phi-4 lg:grid-cols-phi">
        {/* --- history ----------------------------------------------------- */}
        <Panel
          title="Last 10 minutes"
          action={
            <span className="num text-xs text-ink-muted">
              {history.length > 0 ? `${history.length} samples` : 'no samples'}
            </span>
          }
        >
          <div className="h-56 sm:h-64">
            {history.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line">
                <p className="max-w-xs text-center text-xs leading-relaxed text-ink-muted">
                  {offline
                    ? 'History starts once the dashboard can reach the database.'
                    : 'Waiting for the first reading from ESP32 A.'}
                </p>
              </div>
            ) : (
              <Line options={chartOptions} data={chartData} />
            )}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            Collected by this browser tab. The board keeps no history, so reloading starts it
            again.
          </p>
        </Panel>

        {/* --- state ------------------------------------------------------- */}
        <div className="space-y-phi-4">
          <Panel title="State">
            <dl className="divide-y divide-line">
              <Field label="Mission">
                {ms === undefined ? <SkeletonRow w="w-24" /> : missionStateLabel(ms)}
              </Field>
              <Field label="At pot">
                {b?.current_pot === undefined ? <SkeletonRow w="w-6" /> : b.current_pot}
              </Field>
              <Field label="Pumps">
                {status?.pump_active === undefined ? (
                  <SkeletonRow w="w-14" />
                ) : status.pump_active ? (
                  <span className="text-warn">Running</span>
                ) : (
                  'Off'
                )}
              </Field>
              <Field label="Decision by">
                {status?.decision_source ?? <SkeletonRow w="w-12" />}
              </Field>
              {b?.error ? (
                <Field label="Error">
                  <span className="text-fault">{b.error}</span>
                </Field>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Weather">
            {!weather ? (
              <div className="space-y-2.5">
                <SkeletonRow w="w-2/3" />
                <SkeletonRow w="w-1/2" />
              </div>
            ) : (
              <dl className="divide-y divide-line">
                <Field label="Condition">{weather.condition || '--'}</Field>
                <Field label="Outside">
                  {weather.temp_out !== undefined ? `${weather.temp_out.toFixed(1)} C` : '--'}
                </Field>
                <Field label="Humidity">
                  {weather.humidity_out !== undefined
                    ? `${weather.humidity_out.toFixed(0)} %`
                    : '--'}
                </Field>
              </dl>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-phi-4 lg:grid-cols-phi-r">
        {/* --- control ----------------------------------------------------- */}
        <Panel title="Control">
          <div className="mb-4 grid grid-cols-5 gap-1.5">
            {POTS.map((p) => {
              const here = b?.current_pot === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={offline || busy !== null}
                  onClick={() => run(`pot ${p}`, 'goto', p)}
                  className={`num min-h-[44px] cursor-pointer rounded-lg border text-sm transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${
                    here
                      ? 'border-accent/50 bg-accent-wash text-accent'
                      : 'border-line-strong bg-paper-3 text-ink-soft hover:border-ink-muted hover:text-ink'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={offline || busy !== null}
              onClick={() => run('return home', 'return')}
              className="min-h-[44px] cursor-pointer rounded-lg border border-line-strong bg-paper-3 px-3 text-sm text-ink-soft transition-all duration-200 hover:border-ink-muted hover:text-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Return home
            </button>
            <button
              type="button"
              disabled={offline || busy !== null}
              onClick={() => run('stop', 'stop')}
              className="min-h-[44px] cursor-pointer rounded-lg border border-fault/40 bg-fault/10 px-3 text-sm font-medium text-fault transition-all duration-200 hover:bg-fault/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Stop
            </button>
          </div>

          <p aria-live="polite" className="mt-3 min-h-[1.1rem] text-[11px] text-ink-muted">
            {busy ? `Sending ${busy}...` : notice}
          </p>

          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
            {offline
              ? 'Disabled: the database cannot be reached.'
              : 'ESP32 A polls every 3 seconds and only while idle, so expect a short delay.'}
          </p>
        </Panel>

        {/* --- decision ---------------------------------------------------- */}
        <Panel title="Latest decision">
          {!decision ? (
            <div className="space-y-2.5">
              <SkeletonRow w="w-1/3" />
              <SkeletonRow />
              <SkeletonRow w="w-4/5" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <Tag tone={status?.decision_source === 'AI' ? 'accent' : 'neutral'}>
                  {status?.decision_source === 'AI' ? 'Gemini' : 'Local rule'}
                </Tag>
                {decision.pump_water && (
                  <Tag tone="accent">Water {(decision.water_duration ?? 0) / 1000}s</Tag>
                )}
                {decision.pump_fertilizer && (
                  <Tag tone="accent">
                    Fertiliser {(decision.fertilizer_duration ?? 0) / 1000}s
                  </Tag>
                )}
                {decision.fertilizer_deferred && <Tag tone="warn">Fertiliser deferred</Tag>}
              </div>
              <p className="text-sm leading-relaxed text-ink-soft">
                {decision.reason || 'No reason recorded.'}
              </p>
              {decision.timestamp && (
                <p className="num text-[11px] text-ink-muted">{decision.timestamp}</p>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
