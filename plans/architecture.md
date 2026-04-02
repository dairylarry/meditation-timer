# Meditation Timer — MVP Architecture

## 1. Product Overview

A personal PWA for timed meditation sessions, installable on iPhone. The core loop is: set a duration → meditate → get a gong signal at the halfway point and at completion → view your completion history. No accounts, no social features, no complexity.

---

## 2. MVP Scope

**In scope:**
- Duration picker (minutes, +/- buttons, persisted to localStorage)
- Active session page with countdown visualization
- Halfway gong + completion gong (mp3, via Web Audio API)
- Session completion recorded to DynamoDB (date + duration + timestamp)
- Session history page (calendar-style view)
- Offline-capable PWA (service worker precaching via vite-plugin-pwa)

**Out of scope (future):**
- Pause/resume (reset on navigate away instead)
- Multiple sessions per day counted separately
- Streaks, statistics, or goals
- Push notifications
- Multiple users / auth

---

## 3. User Flow

```
App opens
    │
    ▼
Landing page
  ├─ Shows last used duration (default: 10 min)
  ├─ [−] / [+] buttons to adjust duration
  ├─ [Start] → navigates to Session page
  └─ [History] → navigates to History page

Session page
  ├─ Countdown visualization begins immediately
  ├─ At 50% elapsed → gong-mid.mp3 plays
  ├─ At 100% elapsed → gong-end.mp3 plays
  │                  → records completion to DynamoDB (save prior to playing gong-end)
  └─ Navigating away at any point → timer resets (no state saved)

History page
  ├─ Fetches session records from DynamoDB
  └─ Renders month-by-month calendar grid
```

---

## 4. Functional Requirements

### Landing page
- Display current selected duration in whole minutes
- [−] decrements by 1 min (minimum: 1 min)
- [+] increments by 1 min (no hard maximum; 60 min is a reasonable soft cap)
- [Start] triggers audio context setup (must be a direct user gesture for iOS) and navigates to `/session`
- [History] navigates to `/history`
- Selected duration is persisted to `localStorage` as `lastDuration`; loaded on mount

### Session page
- Receives duration (in minutes) as route state or reads from localStorage
- Starts countdown immediately on mount
- Countdown uses Web Audio API (`ctx.currentTime`) as the time source — not `Date.now()` / `setInterval` alone — consistent with workout-tracker approach
- A silent keepalive oscillator (gain ≈ 0.001) runs for the session duration to hold the iOS audio session open
- `navigator.audioSession.type = 'ambient'` set at session start (iOS 17.4+) so Spotify keeps playing
- Wake lock requested to keep screen on
- At 50% of duration: decode and play `gong-mid.mp3`
- At 100%: play `gong-end.mp3`, record completion, show done state
- Navigating away (back button, browser nav): `useEffect` cleanup cancels audio and releases wake lock; no DynamoDB write

### History page
- Fetches all sessions for the user (full scan or range query)
- Groups by date (YYYY-MM-DD)
- Renders a calendar grid month by month, newest first
- Each day: blue if at least one completed session, gray otherwise
- Month + year label above each grid

---

## 5. UX/UI Recommendations

### Countdown Visualization

#### Your hourglass idea (evaluated)
**Verdict: Appealing and unique, but higher implementation complexity than it's worth for MVP.**

The concept is lovely — each grain representing one minute is poetic for meditation. However:
- Managing which grain is "blinking" vs "settled" requires per-minute state
- CSS animation needs to reset at each minute boundary
- The layout requires knowing total minutes upfront to size the grid correctly
- With 10 grains (10-min session) it looks great; with 2 or 30 grains the proportions get awkward

Worth revisiting as a V2 visualization once core functionality is solid.

---

#### Recommended: Circular Arc Progress Ring [DO THIS FOR V1]

A single SVG arc that depletes over the session duration — the same visual language as Apple Watch activity rings. Calm, familiar, and pixel-perfect on iPhone.

```
     ╭──────╮
   ╱    ◉    ╲      Large centered time remaining (e.g. "8:42")
  │  ·  │  ·  │     Thin ring, ~80vw diameter
   ╲          ╱     Ring drains clockwise from top
     ╰──────╯       Subtle color shift at halfway (e.g. blue → indigo)
```

**Implementation:** One `<svg>` with a `<circle>` using `stroke-dasharray` / `stroke-dashoffset`. Update `stroke-dashoffset` in the display tick (every 250ms). The math is two lines of JS. Zero dependencies.

**Why it's best for MVP:**
- 20 lines of SVG/CSS total
- Looks premium on Retina screens
- Inherently calming (no abrupt jumps)
- Handles any duration gracefully

---

#### Alternative 1: Blinking Grain Hourglass (your idea — deferred to V2)

As described above. Implementation: a CSS Grid of `n` circles (n = total minutes), split into top/bottom halves. Current minute grain has a `blink` keyframe animation. State: `{ minutesElapsed, secondsInCurrentMinute }`. Visually unique and worth building after MVP.

---

### Session History Visualization

#### Your GitHub contribution grid (evaluated)
**Verdict: Good, but the metaphor leans "productivity tracker" rather than "meditation app."**

Dense and efficient for long histories, but the horizontal scrolling layout doesn't feel native to iPhone, and the "contribution" framing is goal-anxiety-inducing rather than calming.

---

#### Recommended for MVP: Monthly Calendar Grid [DO THIS FOR V1]

A standard month-at-a-glance calendar (Mon–Sun columns, weeks as rows), one month per card, stacked vertically, newest month on top.

```
   April 2026
M  T  W  T  F  S  S
      1  2  3  4  5
6  7  8  9 10 11 12
■  ·  ·  ·  ·  ·  ·   ■ = blue (completed)  · = gray
```

**Why:** Familiar, readable, vertical scroll is natural on iPhone, months are labeled clearly, no horizontal scroll needed.

**Implementation:** Pure CSS Grid. Data: array of `{ date, completed }` — ~40 lines of JSX.

---

## 6. Technical Architecture

```
meditation-timer/
├── frontend/
│   ├── public/
│   │   ├── manifest.json
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   ├── gong-mid.mp3        ← you provide
│   │   └── gong-end.mp3        ← you provide
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx             ← routes
│   │   ├── lib/
│   │   │   ├── audio.js        ← Web Audio API helpers (context, keepalive, mp3 decode)
│   │   │   └── sessions.js     ← DynamoDB read/write
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Session.jsx
│   │   │   └── History.jsx
│   │   └── styles/
│   │       └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── .github/workflows/deploy.yml
```

**Stack:**
- Vite + React (same as workout-tracker)
- React Router (client-side routing)
- Web Audio API (timer source + gong playback)
- AWS SDK DynamoDB (direct from browser, same pattern as workout-tracker)
- vite-plugin-pwa (service worker + installability)

---

## 7. Frontend Component Breakdown

### `App.jsx`
- Sets up React Router with routes: `/`, `/session`, `/history`
- Passes duration via route state from Landing → Session

### `Landing.jsx`
- Reads `lastDuration` from localStorage (default: 10)
- Local state: `duration`
- Renders: duration display, [−] [+] buttons, [Start] button, [History] link
- On Start: writes `lastDuration` to localStorage, navigates to `/session` with `{ duration }` in route state

### `Session.jsx`
- Props/state: `duration` (from route state), `timerState` (running | done), `display` (timeRemaining)
- Refs: `ctxRef`, `silentOscRef`, `wakeLockRef`, `halfwayFiredRef`
- On mount: initializes AudioContext, sets ambient audio session, starts keepalive, requests wake lock, pre-fetches/decodes both mp3 files, starts display interval
- Display interval (250ms): reads `ctx.currentTime`, updates `timeRemaining`, checks halfway threshold and completion
- On completion: plays gong-end, records to DynamoDB, transitions to done state
- `useEffect` cleanup: stops keepalive, cancels scheduled nodes, releases wake lock, closes context
- Renders: `<ProgressRing />`, time remaining text, back button

### `ProgressRing.jsx`
- Props: `progress` (0–1)
- Pure SVG: single circle with `stroke-dashoffset` computed from `progress`
- Stroke color transitions at 0.5 (CSS or inline style)
- No state, no side effects

### `History.jsx`
- Fetches sessions from DynamoDB on mount
- Derives a `Set<string>` of completed dates
- Groups into months, renders `<MonthGrid />` per month

### `MonthGrid.jsx`
- Props: `year`, `month`, `completedDates: Set<string>`
- Pure render: CSS Grid, 7 columns, fills in blank cells before day 1
- Each day: colored square (blue if in completedDates, gray otherwise)

### `lib/audio.js`
```js
// Key exports:
export function getOrCreateContext()      // singleton AudioContext
export function startKeepalive(ctx)       // silent oscillator, gain 0.001
export function stopKeepalive()
export async function loadGong(ctx, url)  // fetch + decodeAudioData → AudioBuffer
export function playBuffer(ctx, buffer)   // createBufferSource + start
```

### `lib/sessions.js`
```js
export async function recordSession({ date, completedAt, durationMinutes })
export async function fetchSessions()     // returns array of session records
```

---

## 8. State Management Approach

No global state manager (no Redux, no Zustand). The app has three isolated pages with no shared runtime state:
- Duration travels via React Router route state (`navigate('/session', { state: { duration } })`)
- Audio/timer state lives entirely in refs within `Session.jsx` (consistent with workout-tracker's `IntervalTimer.jsx` approach)
- History page is fetch-on-mount, local state only

This is intentionally flat. The app doesn't need more.

---

## 9. Data Model

### DynamoDB Table: `meditation_sessions`

| Attribute | Type | Notes |
|---|---|---|
| `date` (PK) | String | `YYYY-MM-DD` — partition key |
| `completedAt` (SK) | String | ISO 8601 timestamp — sort key, allows multiple records per day |
| `durationMinutes` | Number | Duration in whole minutes |

**Why this shape:**
- Querying "did I meditate on date X?" is a single `GetItem` by PK — O(1) and cheap
- Storing `completedAt` as SK future-proofs for multiple sessions per day without any schema change
- Storing `durationMinutes` captures context without adding complexity
- No userId needed since there's only one user and no auth

**Future-proofing included:**
- SK on `completedAt` (not just PK on date) allows multiple records without a breaking schema change
- DurationMinutes captured for future stats

**Not included (over-engineering):**
- `userId` attribute — add if auth is ever needed, via a simple table update
- Session notes/tags — not needed for V1
- A GSI — not needed until query patterns require it

---

## 10. Storage Approach

### DynamoDB (remote sessions)
- Same direct-from-browser AWS SDK approach as workout-tracker
- AWS credentials injected at build time via Vite env vars (`VITE_AWS_*`)
- Single table, single write per completed session
- On history page: `scan` the full table (small dataset — one record per day at most — scan is fine indefinitely)
- No API layer needed for MVP

### localStorage (local preferences)
- `lastDuration` — integer, minutes — read on Landing mount, written on Start

### Service Worker (offline)
- vite-plugin-pwa precaches all static assets (HTML, JS, CSS, mp3 files, icons)
- History page will fail offline (DynamoDB requires network) — acceptable for MVP
- Timer page works fully offline once assets are cached

---

## 11. Edge Cases / Failure Scenarios

| Scenario | Behavior |
|---|---|
| User navigates away mid-session | `useEffect` cleanup cancels audio, releases wake lock. No DynamoDB write. Timer resets if they return. |
| User closes tab mid-session | Same as above — cleanup fires on unmount. |
| Page refresh mid-session | Session state is not persisted. User lands on homepage. Timer is gone. Acceptable per spec. |
| Screen locks during session | Keepalive oscillator holds iOS audio session open. Gongs fire on schedule. Wake lock may be revoked — screen will lock but audio continues. |
| Spotify / external audio | `navigator.audioSession.type = 'ambient'` (iOS 17.4+) ensures gongs mix with background audio rather than interrupting it. |
| `navigator.audioSession` not available (older iOS) | Caught in try/catch — gongs still play, but may pause Spotify. Acceptable fallback. |
| DynamoDB write fails on completion | Log error, don't surface to user (session is done — no need to disrupt the post-meditation moment). Could add a retry or a local fallback queue in V2. |
| DynamoDB fetch fails on History page | Show empty state with an error message. Don't crash. |
| Duration set to very large value (e.g. 120 min) | Timer runs correctly. Halfway gong fires at 60 min. No issue. |
| Halfway mark fires, then user navigates away, comes back | New session starts fresh. Halfway flag resets. |

---

## 12. Tradeoffs and Alternatives Considered

### Web Audio API vs `<audio>` tag for mp3 playback
**Chosen: Web Audio API (`fetch` + `decodeAudioData` + `AudioBufferSourceNode`)**

The `<audio>` tag is simpler for basic playback but doesn't integrate with the AudioContext ambient session setup. To mix gongs with Spotify without interrupting it, everything needs to go through the same AudioContext that has `navigator.audioSession.type = 'ambient'` set. Using `<audio>` elements would bypass this and risk pausing Spotify.

Yes, mp3 is fully supported: `AudioContext.decodeAudioData()` handles mp3 natively in all modern browsers including Mobile Safari.

### DynamoDB vs localStorage-only
**Chosen: DynamoDB**

localStorage would be simpler and fully offline. Tradeoff: data is locked to one browser/device. Since you use iPhone as primary, this is actually acceptable for a solo-user app — but DynamoDB future-proofs if you ever want to check history on another device.

### React Router vs single-page state machine
**Chosen: React Router**

Three distinct pages with back-button behavior map cleanly to routes. An alternative (single component with `view` state) would avoid the router dependency but lose native browser history/back button, which is important for iPhone PWA feel.

### Interval-based display tick vs `requestAnimationFrame`
**Chosen: `setInterval` at 250ms**

Consistent with workout-tracker. `rAF` is more precise but unnecessary — sub-250ms precision is imperceptible for a meditation countdown. The display tick is display-only; actual audio scheduling is on the AudioContext thread and is frame-accurate regardless.

---

## 13. Recommended MVP Implementation Plan

### Phase 1 — Shell + Navigation (no audio, no data)
1. Add `react-router-dom` dependency
2. Create `Landing.jsx` with duration picker (localStorage read/write)
3. Create `Session.jsx` as placeholder (just shows duration, back button)
4. Create `History.jsx` as placeholder
5. Wire routes in `App.jsx`

**Deliverable:** Working navigation, duration picker persists, builds and deploys.

### Phase 2 — Timer + Countdown Visualization
1. Implement `ProgressRing.jsx` (SVG arc, takes `progress` prop)
2. Implement Web Audio timer in `Session.jsx`:
   - AudioContext + keepalive oscillator
   - `navigator.audioSession` ambient setup
   - 250ms display interval reading `ctx.currentTime`
   - Wake lock
3. Wire progress and time remaining display

**Deliverable:** Timer runs, ring animates, screen stays on, Spotify keeps playing.

### Phase 3 — Gong Audio
1. Add `gong-mid.mp3` and `gong-end.mp3` to `frontend/public/`
2. Implement `lib/audio.js` (`loadGong`, `playBuffer`)
3. Pre-fetch and decode both buffers on session start
4. Fire gong-mid at `duration * 0.5` elapsed
5. Fire gong-end at `duration` elapsed, transition to done state

**Deliverable:** Full session experience end-to-end.

### Phase 4 — DynamoDB Integration
1. Add AWS SDK dependencies (same as workout-tracker)
2. Create DynamoDB table `meditation_sessions` (PK: `date`, SK: `completedAt`)
3. Set up Vite env vars for AWS credentials
4. Implement `lib/sessions.js`
5. Write completion record on session end
6. Fetch and render in `History.jsx` with `MonthGrid.jsx`

**Deliverable:** Full app. History persists across devices.

### Phase 5 — Polish + PWA
1. Add app icons (already done)
2. Style the app (calming dark theme, appropriate typography)
3. Test install flow on iPhone (Add to Home Screen)
4. Verify offline timer functionality
5. Deploy via GitHub Actions

---

## 14. Open Questions

1. **Gong at exact halfway vs. end of the halfway minute?** ✅ Resolved.
   Fires at exactly 50% of total duration elapsed. For 10 min → at 5:00 elapsed. For 1 min → at 30s elapsed. No difference between the two framings — they're the same point in time. Always fires regardless of duration.
   > Future: may add a toggle to disable the halfway gong.

2. **Done state behavior:** ✅ Resolved.
   After the completion gong, stay on the session page showing a "Done" state. User navigates away manually. No auto-redirect.

3. **DynamoDB table name:** ✅ Resolved.
   Use `meditation_sessions`. Keep it separate from workout-tracker data (different table, same AWS account/region is fine).

4. **AWS credentials:** ✅ Resolved.
   Reuse the same IAM credentials as workout-tracker (same DynamoDB endpoint, different table). No need to create a new IAM user. Just ensure the existing IAM policy grants access to the `meditation_sessions` table.

5. **Minimum duration halfway gong:** ✅ Resolved.
   Always fire the halfway gong regardless of duration (e.g. 30s into a 1-min session). Future toggle to disable it can be added later.

6. **History page depth:** ✅ Resolved.
   Show a rolling 3-month window. Simple to implement, easy to extend later.
