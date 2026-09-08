import { useEffect, useRef, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import { db, isConfigured } from '../lib/firebase';
import type { ConnectionState, DeviceData, Sample } from '../types';

/*  How long without an update before the reading is called stale rather than
 *  live. ESP32 A uploads every 5 s, so 20 s is four missed cycles — long enough
 *  not to flicker on a slow link, short enough that a judge is not shown a dead
 *  number labelled "live". */
const STALE_AFTER_MS = 20_000;
const MAX_SAMPLES = 120;          // ~10 minutes at one sample per 5 s

export interface DeviceFeed {
  data: DeviceData | null;
  connection: ConnectionState;
  /** Client-side rolling history; the board does not store one. */
  history: Sample[];
  lastUpdate: number | null;
  /** Rejects out-of-range values before they reach the database. */
  sendCommand: (action: string, targetPot?: number) => Promise<string | null>;
}

/*  Development-only fixtures.
 *
 *  §6.2 of the verification brief asks for three states to be checked
 *  deliberately: no .env, a valid config with an empty database, and a valid
 *  config with partial data. The last two are unreachable without Firebase
 *  credentials, so `?mock=` provides them.
 *
 *  Gated on import.meta.env.DEV, so this cannot be reached from a production
 *  build — Vite drops the branch entirely. It doubles as a way to show the
 *  dashboard on a laptop with no database at all.
 *
 *    ?mock=empty     connected, /device exists but is empty
 *    ?mock=partial   sensors present, ai_decision and weather missing
 *    ?mock=full      everything populated
 */
type MockName = 'empty' | 'partial' | 'full';

const MOCKS: Record<MockName, DeviceData | null> = {
  empty: null,
  partial: {
    esp32_a: {
      sensors: {
        soil_moisture: 34,
        temperature: 29.4,
        humidity: 62,
        pH: -1, // invalid probe reading, must not render as a pH
        light_intensity: 812,
        timestamp: '2026-09-08T11:20:04Z',
      },
      status: {
        mode: 'ONLINE',
        pump_active: false,
        internet: true,
        ai_available: false,
        decision_source: 'LOCAL',
        mission_state: 0,
        dht_fault: false,
        soil_fault: false,
      },
    },
    esp32_b: { status: { current_pot: 2, moving: false, connection: 'online', error: '' } },
  },
  full: {
    esp32_a: {
      sensors: {
        soil_moisture: 22,
        temperature: 36.2,
        humidity: 55,
        pH: 6.4,
        light_intensity: 1240,
        timestamp: '2026-09-08T11:24:31Z',
      },
      weather: {
        condition: 'Partly cloudy',
        temp_out: 31,
        humidity_out: 70,
        timestamp: '2026-09-08T11:20:00Z',
      },
      ai_decision: {
        pump_water: true,
        water_duration: 8000,
        pump_fertilizer: false,
        fertilizer_duration: 0,
        fertilizer_deferred: true,
        reason: 'Soil at 22% and 36C outside; watering 8s and holding fertiliser until the next visit.',
        timestamp: '2026-09-08T11:24:31Z',
      },
      status: {
        mode: 'ONLINE',
        pump_active: true,
        internet: true,
        ai_available: true,
        decision_source: 'AI',
        mission_state: 8,
        dht_fault: false,
        soil_fault: false,
      },
    },
    esp32_b: { status: { current_pot: 3, moving: false, connection: 'online', error: '' } },
  },
};

function readMock(): MockName | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('mock');
  return v === 'empty' || v === 'partial' || v === 'full' ? v : null;
}

export function useDeviceData(): DeviceFeed {
  const mock = readMock();

  const [data, setData] = useState<DeviceData | null>(mock ? MOCKS[mock] : null);
  const [connection, setConnection] = useState<ConnectionState>(
    mock ? 'live' : isConfigured ? 'connecting' : 'unconfigured',
  );
  const [history, setHistory] = useState<Sample[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  //  Kept in a ref as well so the staleness timer can read it without being
  //  re-created on every update.
  const lastUpdateRef = useRef<number | null>(null);

  useEffect(() => {
    if (mock) return;                 // fixtures are static; no subscription
    if (!isConfigured || !db) return;

    const unsub = onValue(
      ref(db, '/device'),
      (snap) => {
        const value = (snap.val() ?? null) as DeviceData | null;
        setData(value);
        const now = Date.now();
        lastUpdateRef.current = now;
        setLastUpdate(now);
        setConnection('live');

        const s = value?.esp32_a?.sensors;
        if (s) {
          setHistory((prev) => {
            const next: Sample[] = [
              ...prev,
              {
                t: now,
                soil: typeof s.soil_moisture === 'number' ? s.soil_moisture : undefined,
                temperature: typeof s.temperature === 'number' ? s.temperature : undefined,
                humidity: typeof s.humidity === 'number' ? s.humidity : undefined,
              },
            ];
            return next.length > MAX_SAMPLES ? next.slice(-MAX_SAMPLES) : next;
          });
        }
      },
      (err) => {
        console.error('[firebase] read failed:', err);
        setConnection('error');
      },
    );

    return () => unsub();
  }, [mock]);

  /*  Fixtures need a moving history or the chart can never fill, which makes
   *  the one panel that shows trend impossible to demonstrate without
   *  hardware. A slow random walk around the fixture's own readings, at the
   *  same 5 s cadence the board uploads at. Mock mode is explicitly fake, so
   *  inventing a plausible trend here is honest; doing it on live data would
   *  not be. */
  useEffect(() => {
    if (!mock) return;
    const base = MOCKS[mock]?.esp32_a?.sensors;
    if (!base) return;

    const drift = (v: number | undefined, span: number, lo: number, hi: number) =>
      v === undefined ? undefined : Math.min(hi, Math.max(lo, v + (Math.random() - 0.5) * span));

    let soil = base.soil_moisture;
    let temp = base.temperature;
    let hum = base.humidity;

    //  Seed a few minutes of past readings so the chart has a shape at once.
    const now = Date.now();
    const seeded: Sample[] = [];
    for (let i = 24; i > 0; i--) {
      soil = drift(soil, 2.2, 5, 95);
      temp = drift(temp, 0.5, 10, 45);
      hum = drift(hum, 1.6, 20, 95);
      seeded.push({ t: now - i * 5000, soil, temperature: temp, humidity: hum });
    }
    setHistory(seeded);

    const id = window.setInterval(() => {
      soil = drift(soil, 2.2, 5, 95);
      temp = drift(temp, 0.5, 10, 45);
      hum = drift(hum, 1.6, 20, 95);
      setHistory((prev) => {
        const next = [...prev, { t: Date.now(), soil, temperature: temp, humidity: hum }];
        return next.length > MAX_SAMPLES ? next.slice(-MAX_SAMPLES) : next;
      });
    }, 5000);

    return () => window.clearInterval(id);
  }, [mock]);

  //  Mark the feed stale rather than leaving a frozen number looking live.
  useEffect(() => {
    if (mock || !isConfigured) return;   // a fixture never goes stale
    const id = window.setInterval(() => {
      setConnection((prev) => {
        if (prev === 'error' || prev === 'unconfigured') return prev;
        const last = lastUpdateRef.current;
        if (last === null) return prev;
        return Date.now() - last > STALE_AFTER_MS ? 'stale' : 'live';
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, [mock]);

  const sendCommand = async (action: string, targetPot?: number) => {
    if (mock) {
      /*  Fixtures are the one place it is honest to move the robot without a
       *  robot: mock mode is explicitly fake, and being able to press a pot
       *  and watch it travel is the whole point of having fixtures. */
      if (targetPot !== undefined) {
        setData((prev) =>
          prev
            ? { ...prev, esp32_b: { status: { ...prev.esp32_b?.status, current_pot: targetPot, moving: false } } }
            : prev,
        );
      }
      return null;
    }
    if (!isConfigured || !db) return 'Database is not configured.';

    //  Validate here as well as on the board. RECOMMENDATIONS items 15-17 note
    //  the database rules are wide open, so the dashboard should not be the
    //  thing that writes nonsense into it.
    if (targetPot !== undefined && (!Number.isInteger(targetPot) || targetPot < 1 || targetPot > 5)) {
      return `Pot ${targetPot} is outside 1-5.`;
    }

    try {
      await set(ref(db, '/device/esp32_a/command/action'), action);
      if (targetPot !== undefined) {
        await set(ref(db, '/device/esp32_a/command/target_pot'), targetPot);
      }
      return null;
    } catch (err) {
      console.error('[firebase] write failed:', err);
      return 'Could not reach the database. The command was not sent.';
    }
  };

  return { data, connection, history, lastUpdate, sendCommand };
}
