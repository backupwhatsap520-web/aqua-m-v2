# Aqua-M V2 — dashboard

React + TypeScript + Vite + Tailwind, reading the Realtime Database that
ESP32 A writes to. Schema is `DOCUMENTATION.md` §8; the field names here are
taken from `uploadSensors` / `uploadStatus` / `uploadDecision` in
`firmware/AquaM_ESP32_A`.

## Run it

```bash
cd website
cp .env.example .env      # fill in from the Firebase console
npm install
npm run dev               # http://localhost:5173
```

`.env` is gitignored. Never commit a filled-in copy.

## Without a database

The dashboard is built to survive a missing or unreachable database, because
that is the state a judge sees if the venue Wi-Fi misbehaves. With no `.env` it
shows loading skeletons and a "No Firebase settings found" notice — not a white
screen, and not a stale number labelled live.

For demonstrating the interface with no database at all, three fixtures are
available **in development only** (`import.meta.env.DEV`, so they cannot be
reached from a production build):

| URL | State |
|-----|-------|
| `?mock=empty` | connected, `/device` empty — everything skeletons |
| `?mock=partial` | sensors present, `ai_decision` and `weather` missing, pH invalid |
| `?mock=full` | everything populated, mission irrigating |

## Notes for whoever picks this up

- **The palette is fixed by the team**: `#06D6A0`, `#4CC9F0`, `#0a0f1a`,
  glassmorphism. It is not a default to improve on.
- **`Drop` in `PortfolioTab.tsx` must stay its own component.** It exists so
  `useTransform` is not called inside `.map()` — hook order must not depend on
  list length. Inlining it back into the loop breaks on any change to `DROPS`.
- **`StatCard` checks `invalid` before `loading`.** A fault arrives with the
  value withheld, so checking loading first renders a skeleton that never
  resolves — a card stuck loading instead of a named fault.
- **pH is written as `-1` when the probe reading was invalid.** Never render it
  as a real pH.
- Every field from the database is optional. The board writes each node
  separately, so a dashboard opened mid-boot legitimately sees half a tree.

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | dev server |
| `npm run build` | `tsc -b` then a production build |
| `npm run preview` | serve the production build |
| `npm run lint` | oxlint |
