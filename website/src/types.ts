/*  Shapes mirror DOCUMENTATION.md §8 and the FirebaseJson keys written by
 *  uploadSensors / uploadWeather / uploadDecision / uploadStatus in
 *  firmware/AquaM_ESP32_A. If a key here disagrees with the firmware, the
 *  firmware wins — change this file, not the sketch.
 *
 *  Every field is optional on purpose. The board writes each node separately,
 *  so a dashboard opened mid-boot legitimately sees a node that exists with
 *  only some of its children. Anything that assumes otherwise crashes on the
 *  one state a judge is most likely to catch.
 */

export interface Sensors {
  soil_moisture?: number;
  temperature?: number;
  humidity?: number;
  /** -1 means the probe reading was invalid; never render it as a real pH. */
  pH?: number;
  light_intensity?: number;
  timestamp?: string;
}

export interface Weather {
  condition?: string;
  temp_out?: number;
  humidity_out?: number;
  timestamp?: string;
}

export interface AiDecision {
  pump_water?: boolean;
  water_duration?: number;
  pump_fertilizer?: boolean;
  fertilizer_duration?: number;
  fertilizer_deferred?: boolean;
  reason?: string;
  timestamp?: string;
}

export interface StatusA {
  mode?: 'ONLINE' | 'OFFLINE' | string;
  pump_active?: boolean;
  internet?: boolean;
  ai_available?: boolean;
  decision_source?: 'AI' | 'LOCAL' | 'NONE' | string;
  /** Index into MISSION_STATES. */
  mission_state?: number;
  dht_fault?: boolean;
  soil_fault?: boolean;
}

export interface StatusB {
  current_pot?: number;
  moving?: boolean;
  connection?: string;
  error?: string;
}

export interface DeviceData {
  esp32_a?: {
    sensors?: Sensors;
    weather?: Weather;
    ai_decision?: AiDecision;
    status?: StatusA;
  };
  esp32_b?: { status?: StatusB };
}

/*  Order matches the MissionState enum in AquaM_ESP32_A.ino §4. */
export const MISSION_STATES = [
  'Idle',
  'Requesting move',
  'Waiting to arrive',
  'Waiting for probe',
  'Probe settling',
  'Reading sensors',
  'Deciding',
  'Starting pumps',
  'Irrigating',
  'Stopping pumps',
  'Lifting arm',
  'Waiting for lift',
  'Finishing',
] as const;

export function missionStateLabel(n?: number): string {
  if (n === undefined || n < 0 || n >= MISSION_STATES.length) return 'Unknown';
  return MISSION_STATES[n];
}

/** One point in the rolling chart history, built client-side. */
export interface Sample {
  t: number;
  soil?: number;
  temperature?: number;
  humidity?: number;
}

export type ConnectionState =
  | 'unconfigured'   // no .env: nothing to connect to
  | 'connecting'
  | 'live'
  | 'stale'          // connected, but no update for a while
  | 'error';
