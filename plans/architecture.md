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
- Multiple users (single pre-created user only)

---

## 3. User Flow

```
App opens
    │
    ▼
Login screen (if no valid session)
    │
    ▼
Landing page
  ├─ Shows last used duration (default: 10 min)
  ├─ [−] / [+] buttons to adjust duration
  ├─ Show countdown toggle (default: off)
  ├─ [Start] → navigates to Session page
  ├─ [History] → navigates to History page
  ├─ [Brahmavihārā 4] → navigates to Brahmavihara page
  └─ [Account] → navigates to Account page

Session page
  ├─ 10s get-ready countdown (gong-mid plays to signal start)
  ├─ Progress ring animates over session duration
  ├─ At 50% elapsed → gong-mid.mp3 plays
  ├─ At 100% elapsed → gong-end.mp3 plays
  │                  → records completion to DynamoDB (save prior to playing gong-end)
  ├─ Screen dims during active meditation (simulated via CSS opacity)
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
- `navigator.audioSession.type = 'playback'` set at session start (iOS 17.4+) — bypasses iOS silent/mute switch; pauses Spotify
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
│   │   ├── gong-mid.mp3
│   │   └── gong-end.mp3
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx             ← AuthProvider + auth-gated routes
│   │   ├── context/
│   │   │   └── AuthContext.jsx ← authState, user, login, logout
│   │   ├── lib/
│   │   │   ├── audio.js        ← Web Audio API helpers (context, keepalive, mp3 decode)
│   │   │   ├── auth.js         ← Cognito SDK wrapper (login, logout, refresh)
│   │   │   └── sessions.js     ← DynamoDB read/write (userId-scoped)
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Session.jsx
│   │   │   ├── History.jsx
│   │   │   ├── Brahmavihara.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Account.jsx
│   │   └── styles/
│   │       ├── App.css
│   │       ├── Landing.css
│   │       ├── Session.css
│   │       ├── History.css
│   │       ├── Login.css
│   │       └── Account.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── scripts/
│   └── create-user.sh          ← gitignored; admin-creates Cognito user
└── .github/workflows/deploy.yml
```

**Stack:**
- Vite + React 18
- React Router v7 (client-side routing, basename `/meditation-timer/`)
- Web Audio API (timer source + gong playback)
- AWS SDK v3: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-cognito-identity-provider`
- vite-plugin-pwa (service worker + installability)
- GitHub Actions → GitHub Pages (deploy on push to main)

---

## 7. Frontend Component Breakdown

### `App.jsx`
- Wraps all routes in `<AuthProvider>`
- `<AuthedRoutes>` inner component reads `authState`: renders blank during `'loading'`, `<Login />` during `'unauthenticated'`, full router when `'authenticated'`
- Routes: `/`, `/session`, `/history`, `/brahmavihara`, `/account`
- Passes duration via route state from Landing → Session

### `Landing.jsx`
- Reads `lastDuration` and `showCountdown` from localStorage
- Local state: `duration`, `showCountdown`
- Renders: duration display, [−] [+] buttons, show countdown toggle, [Start] button, [History] / [Brahmavihārā 4] / [Account] links
- On Start: navigates to `/session` with `{ duration, showCountdown }` in route state

### `Session.jsx`
- Props/state: `duration` + `showCountdown` (from route state), `timerState` (countdown | running | done)
- 10s get-ready countdown phase → gong-mid plays to signal start
- On mount: initializes AudioContext, sets `playback` audio session, starts keepalive, requests wake lock, pre-fetches/decodes both mp3 files
- Display interval (250ms): reads `ctx.currentTime`, updates remaining, checks halfway/completion
- On completion: records to DynamoDB (with `userId` from `useAuth()`), plays gong-end, transitions to done state
- Screen dims (CSS `.session-dimmed`) during `running` state
- Shows "session ends at HH:MM" during running state; countdown numbers optional via `showCountdown`
- `useEffect` cleanup: stops keepalive, releases wake lock, closes context

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
export async function recordSession({ userId, date, completedAt, durationMinutes })
export async function fetchSessions({ userId })  // Query by USER#<userId> PK
```
- `isDev` check (localhost) skips DynamoDB writes and logs to console instead

---

## 8. State Management Approach

No global state manager (no Redux, no Zustand). The app has isolated pages with minimal shared state:
- Auth state lives in `AuthContext` (React Context) — `authState`, `user`, `login`, `logout`
- Duration + showCountdown travel via React Router route state (`navigate('/session', { state: { ... } })`)
- Audio/timer state lives entirely in refs within `Session.jsx`
- History page is fetch-on-mount, local state only
- Preferences (`lastDuration`, `showCountdown`) persisted in localStorage

This is intentionally flat. The app doesn't need more.

---

## 9. Data Model

### DynamoDB Table: `meditation-sessions-db`

| Attribute | Type | Notes |
|---|---|---|
| `userId` (PK) | String | `USER#<cognito-sub>` — partition key |
| `completedAt` (SK) | String | ISO 8601 timestamp — sort key |
| `date` | String | `YYYY-MM-DD` — regular attribute for display/filtering |
| `durationMinutes` | Number | Duration in whole minutes |

**Why this shape:**
- `userId` as PK scopes all data per user — `Query` where `userId = USER#<sub>` returns only that user's sessions
- `completedAt` as SK allows multiple sessions per day without any schema change
- `date` demoted to regular attribute — no longer needed in key since we query by user, not by date
- Cognito `sub` (UUID) used instead of email — stable even if email changes

**Access pattern:**
- Fetch all sessions for user: `QueryCommand` with `KeyConditionExpression: userId = :pk`
- No `Scan` needed — efficient regardless of table size

---

## 10. Storage Approach

### DynamoDB (remote sessions)
- Same direct-from-browser AWS SDK approach as workout-tracker
- AWS credentials injected at build time via Vite env vars (`VITE_AWS_*`)
- Single table, single write per completed session
- On history page: `Query` by `userId` PK (replaces prior `Scan`) — efficient and scoped to the authenticated user
- No API layer needed for MVP

### localStorage (local preferences + auth tokens)
- `lastDuration` — integer, minutes — read on Landing mount, written on duration change
- `showCountdown` — boolean — persisted across sessions
- `cognito_id_token` — JWT — used to restore user identity on app load
- `cognito_access_token` — JWT — used for Cognito API calls (e.g. GlobalSignOut)
- `cognito_refresh_token` — opaque — used to renew id/access tokens on app load

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
| Spotify / external audio | `navigator.audioSession.type = 'playback'` (iOS 17.4+) — bypasses mute switch; intentionally pauses Spotify during session. |
| `navigator.audioSession` not available (older iOS) | Caught in try/catch — gongs still play but mute switch is respected. |
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

---

## 15. Authentication Architecture

### Overview

Authentication uses **AWS Cognito User Pools** — a managed identity service that issues JWTs, handles credential storage, and manages token lifecycle. The React frontend calls Cognito directly from the browser via the AWS SDK v3. **No backend API layer is required.**

Users are pre-created by an admin CLI script. There is no self-registration flow. The canonical user identifier is the Cognito `sub` claim (a stable UUID), not the email address.

---

### How It Works End-to-End

```
Browser                          Cognito                    DynamoDB
  │                                 │                           │
  │  InitiateAuth(email, password)  │                           │
  │────────────────────────────────▶│                           │
  │  ◀── IdToken + AccessToken +    │                           │
  │       RefreshToken              │                           │
  │                                 │                           │
  │  Decode IdToken (base64, local) │                           │
  │  Extract sub → userId           │                           │
  │  Store all 3 tokens in          │                           │
  │  localStorage                   │                           │
  │                                 │                           │
  │  [on next app load]             │                           │
  │  REFRESH_TOKEN_AUTH ───────────▶│                           │
  │  ◀── new IdToken + AccessToken  │                           │
  │                                 │                           │
  │  [write session]                │                           │
  │  PutItem(userId=USER#<sub>) ────│──────────────────────────▶│
  │                                 │                           │
  │  [read history]                 │                           │
  │  Query(userId=USER#<sub>) ──────│──────────────────────────▶│
  │  ◀── user's sessions            │                           │
```

The Cognito `sub` is never shown to the user — it is only used internally as the DynamoDB partition key prefix (`USER#<sub>`).

---

### Auth Flows

#### App Load (session restore)
```
App mounts → AuthProvider useEffect runs
    │
    ▼
getCurrentUser() — reads cached IdToken from localStorage, decodes JWT locally
    │
    ├── Token found → setUser(cached), setAuthState('authenticated')  ← instant, no network
    │       │
    │       ▼
    │   refreshSession() runs in background
    │       ├── Success → update user + tokens in localStorage (silent)
    │       ├── NotAuthorizedException / InvalidParameterException
    │       │       → clearTokens() → setAuthState('unauthenticated') → Login shown
    │       └── Network error (offline, timeout, DNS failure)
    │               → do nothing — keep existing cached auth state
    │               → tokens are NOT cleared
    │               → user stays logged in until next successful refresh
    │
    └── No token found
            │
            ▼
        refreshSession() — try RefreshToken from localStorage
            ├── Success → setUser, setAuthState('authenticated')
            └── Fails for any reason → setAuthState('unauthenticated') → Login shown
```

#### Login
```
User submits email + password → handleSubmit()
    │
    ▼
login(email, password) → InitiateAuthCommand(USER_PASSWORD_AUTH)
    │
    ├── Success (AuthenticationResult present)
    │     → saveTokens({ IdToken, AccessToken, RefreshToken }) to localStorage
    │     → decodeJwt(IdToken) → extract { sub, email }
    │     → return { userId: sub, username: email }
    │     → AuthContext: setUser, setAuthState('authenticated')
    │     → App re-renders → AuthedRoutes renders main app
    │
    ├── response.AuthenticationResult missing (Cognito challenge returned)
    │     → throw Error('Authentication challenge not supported')
    │     → Login shows generic error
    │
    ├── NotAuthorizedException → "invalid username or password"
    ├── UserNotFoundException  → "invalid username or password"  ← same msg, no field hint
    ├── NetworkError / TypeError → "connection error, try again"
    └── Anything else → JSON.stringify(err) shown (debug — clean up for prod)
```

#### Logout
```
User taps "log out" → logout()
    │
    ▼
GlobalSignOutCommand(AccessToken) → Cognito invalidates ALL refresh tokens for this user
    │   (error swallowed — always proceed to local cleanup)
    ▼
clearTokens() → removes cognito_id_token, cognito_access_token, cognito_refresh_token
    │
    ▼
AuthContext: setUser(null), setAuthState('unauthenticated')
    │
    ▼
App re-renders → AuthedRoutes renders <Login />
```

---

### File Structure

```
src/
├── lib/
│   └── auth.js              ← all Cognito SDK calls live here
├── context/
│   └── AuthContext.jsx      ← React context; consumed by all pages via useAuth()
├── pages/
│   ├── Login.jsx            ← shown when unauthenticated
│   └── Account.jsx          ← shows username + log out button
└── App.jsx                  ← AuthProvider + AuthedRoutes (auth gate)
```

---

### `lib/auth.js` — Full Implementation Reference

```js
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const REGION = import.meta.env.VITE_AWS_REGION
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID

// Cognito public-client operations (InitiateAuth, GlobalSignOut) don't require
// IAM credentials. However, the AWS SDK v3 still SigV4-signs the request.
// Cognito ignores the signature for public ops, but the SDK will throw before
// making the HTTP call if credentials are empty strings. Pass the existing
// IAM credentials (from DynamoDB setup) so the signer has non-empty values.
const client = new CognitoIdentityProviderClient({
  region: REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
})

const STORAGE_KEYS = {
  idToken:      'cognito_id_token',
  accessToken:  'cognito_access_token',
  refreshToken: 'cognito_refresh_token',
}

// --- internal helpers ---

function saveTokens({ IdToken, AccessToken, RefreshToken }) {
  if (IdToken)      localStorage.setItem(STORAGE_KEYS.idToken,      IdToken)
  if (AccessToken)  localStorage.setItem(STORAGE_KEYS.accessToken,  AccessToken)
  if (RefreshToken) localStorage.setItem(STORAGE_KEYS.refreshToken, RefreshToken)
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEYS.idToken)
  localStorage.removeItem(STORAGE_KEYS.accessToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
}

function decodeJwt(token) {
  // JWT payload is base64url-encoded JSON — no library needed.
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(normalized))
  } catch {
    return null
  }
}

function userFromIdToken(idToken) {
  const claims = decodeJwt(idToken)
  if (!claims) return null
  return {
    userId:   claims.sub,                                           // stable UUID
    username: claims.email || claims['cognito:username'] || claims.sub,
  }
}

// --- public API ---

// Read cached IdToken from localStorage and decode locally (no network).
// Returns { userId, username } or null.
export function getCurrentUser() {
  const idToken = localStorage.getItem(STORAGE_KEYS.idToken)
  if (!idToken) return null
  return userFromIdToken(idToken)
}

// Authenticate with email + password. Returns { userId, username }.
// Throws on bad credentials, network failure, or unsupported auth challenge.
export async function login(username, password) {
  const response = await client.send(new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: username, PASSWORD: password },
  }))

  if (!response.AuthenticationResult) {
    throw new Error('Authentication challenge not supported')
  }

  saveTokens(response.AuthenticationResult)
  const user = userFromIdToken(response.AuthenticationResult.IdToken)
  if (!user) throw new Error('Failed to decode user from token')
  return user
}

// Silently renew IdToken + AccessToken using RefreshToken.
// Returns updated { userId, username } or null on any failure.
// Only clears tokens on hard auth errors — NOT on network failures (offline resilience).
export async function refreshSession() {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
  if (!refreshToken) return null

  try {
    const response = await client.send(new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    }))
    // Refresh response never includes a new RefreshToken — reuse existing one.
    saveTokens({ ...response.AuthenticationResult, RefreshToken: refreshToken })
    return userFromIdToken(response.AuthenticationResult.IdToken)
  } catch (err) {
    const name = err?.name || ''
    if (name === 'NotAuthorizedException' || name === 'InvalidParameterException') {
      clearTokens()  // token is revoked/expired — force re-login
    }
    // All other errors (network, DNS, timeout) leave tokens intact.
    return null
  }
}

// Invalidate all sessions server-side, then clear local tokens.
export async function logout() {
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken)
  if (accessToken) {
    try {
      await client.send(new GlobalSignOutCommand({ AccessToken: accessToken }))
    } catch (_) {} // always clear locally even if server call fails
  }
  clearTokens()
}
```

---

### `context/AuthContext.jsx` — Full Implementation Reference

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as cognitoLogin, logout as cognitoLogout, refreshSession, getCurrentUser } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState('loading')  // 'loading' | 'authenticated' | 'unauthenticated'
  const [user, setUser] = useState(null)                 // { userId, username } | null

  useEffect(() => {
    let cancelled = false

    async function restore() {
      // Fast path: render immediately if we have a cached token.
      const cached = getCurrentUser()
      if (cached && !cancelled) {
        setUser(cached)
        setAuthState('authenticated')
      }

      // Background refresh: keeps tokens alive and detects revoked sessions.
      const refreshed = await refreshSession()
      if (cancelled) return

      if (refreshed) {
        setUser(refreshed)
        setAuthState('authenticated')
      } else if (!cached) {
        setAuthState('unauthenticated')
      }
      // If cached exists but refresh failed: do nothing — offline resilience.
      // The user stays logged in until the next successful refresh.
    }

    restore()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (username, password) => {
    const user = await cognitoLogin(username, password)
    setUser(user)
    setAuthState('authenticated')
    return user
  }, [])

  const logout = useCallback(async () => {
    await cognitoLogout()
    setUser(null)
    setAuthState('unauthenticated')
  }, [])

  return (
    <AuthContext.Provider value={{ authState, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

---

### `App.jsx` — Route Gating Pattern

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
// ... other page imports

function AuthedRoutes() {
  const { authState } = useAuth()

  if (authState === 'loading') return <div className="app-loading" />  // blank while restoring
  if (authState === 'unauthenticated') return <Login />

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {/* ... other routes */}
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/your-app">
      <AuthProvider>
        <AuthedRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
```

**Why `AuthedRoutes` is a child component:** `useAuth()` must be called inside the `AuthProvider` tree. Calling it in `App` directly would fail since the provider hasn't mounted yet.

---

### AWS Setup — Step-by-Step

#### Step 1: Create a Cognito User Pool

In AWS Console → Cognito → **Create user pool**:

| Setting | Value |
|---|---|
| Sign-in identifier | Email |
| Password policy | Cognito defaults (or relax: 8 chars, no symbol requirement) |
| MFA | Disabled |
| Self-service sign-up | **Disabled** — admin-only user creation |
| Required attributes | `email` |
| Email provider | "Send email with Cognito" (fine for personal apps) |
| User pool name | anything (e.g. `my-app-users`) |

After creation, note the **User Pool ID** (e.g. `us-east-1_AbCdEfGhI`). You'll need it to run the create-user script.

#### Step 2: Create an App Client

Inside the User Pool → **App Integration** → **App clients** → **Create app client**:

| Setting | Value |
|---|---|
| App type | **Public client** |
| App client name | anything (e.g. `my-app-web`) |
| Client secret | **Don't generate** — browser apps cannot safely store secrets |
| Authentication flows | ✅ `ALLOW_USER_PASSWORD_AUTH` ✅ `ALLOW_REFRESH_TOKEN_AUTH` |
| Token expiry — Access/ID tokens | 1 day (maximum allowed) |
| Token expiry — Refresh token | 3,650 days (10 years) — user never needs to re-login |

After creation, note the **App Client ID** (e.g. `1a2b3c4d5e6fexample`). This goes into your `.env`.

> **Common gotcha:** If you forget to enable `ALLOW_USER_PASSWORD_AUTH`, login will fail with `InvalidParameterException: USER_PASSWORD_AUTH flow not enabled for this client`. It must be explicitly checked — it is off by default.

#### Step 3: Create a User via CLI

The user is created server-side by an admin. Never hardcode credentials in frontend code.

Create `scripts/create-user.sh` (add to `.gitignore`):

```bash
#!/bin/bash
set -e
: "${COGNITO_USER_POOL_ID:?Set COGNITO_USER_POOL_ID env var first}"

USERNAME="user@example.com"
PASSWORD="your-password"

# Step 1: Create the user (suppresses the welcome email)
aws cognito-idp admin-create-user \
  --user-pool-id "$COGNITO_USER_POOL_ID" \
  --username "$USERNAME" \
  --user-attributes Name=email,Value="$USERNAME" Name=email_verified,Value=true \
  --message-action SUPPRESS

# Step 2: Set a permanent password — skips Cognito's forced-change-on-first-login flow
aws cognito-idp admin-set-user-password \
  --user-pool-id "$COGNITO_USER_POOL_ID" \
  --username "$USERNAME" \
  --password "$PASSWORD" \
  --permanent
```

Run it:
```bash
chmod +x scripts/create-user.sh
export COGNITO_USER_POOL_ID=us-east-1_AbCdEfGhI
./scripts/create-user.sh
```

> **Why two commands?** `admin-create-user` alone leaves the user in `FORCE_CHANGE_PASSWORD` status — they'd be required to change their password on first login, which the app doesn't implement. `admin-set-user-password --permanent` sets the status to `CONFIRMED` and bypasses that challenge entirely.

Verify in the AWS Console → Cognito → User Pool → **Users** — status should be `CONFIRMED`.

#### Step 4: IAM Policy

The IAM user whose credentials are used in the frontend (for DynamoDB access) needs these permissions on the table:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:Query"
  ],
  "Resource": "arn:aws:dynamodb:us-east-1:*:table/your-table-name"
}
```

`Query` replaces `Scan` now that data is partitioned by `userId`.

#### Step 5: Environment Variables

**`frontend/.env`** (gitignored — never commit):
```
VITE_AWS_REGION=us-east-1
VITE_AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
VITE_AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_CLIENT_ID=1a2b3c4d5e6fexample
```

> The **User Pool ID** is only needed when running `create-user.sh` — it is not needed in the frontend. The App Client ID is sufficient; it is scoped to its pool.

**GitHub Secrets** (Settings → Secrets and variables → Actions) — same four vars:
- `VITE_AWS_REGION`
- `VITE_AWS_ACCESS_KEY_ID`
- `VITE_AWS_SECRET_ACCESS_KEY`
- `VITE_COGNITO_CLIENT_ID`

**`.github/workflows/deploy.yml`** — pass secrets to the build step:
```yaml
- run: npm run build
  working-directory: frontend
  env:
    VITE_AWS_REGION: ${{ secrets.VITE_AWS_REGION }}
    VITE_AWS_ACCESS_KEY_ID: ${{ secrets.VITE_AWS_ACCESS_KEY_ID }}
    VITE_AWS_SECRET_ACCESS_KEY: ${{ secrets.VITE_AWS_SECRET_ACCESS_KEY }}
    VITE_COGNITO_CLIENT_ID: ${{ secrets.VITE_COGNITO_CLIENT_ID }}
```

Vite bakes `import.meta.env.VITE_*` vars into the JS bundle at build time. If the secrets aren't set, the vars will be `undefined` and auth will fail silently (or with a cryptic "region is missing" error from the SDK).

---

### Token Storage

| Key | Value | Expiry | Notes |
|---|---|---|---|
| `cognito_id_token` | JWT | 1 day | Contains `sub` (userId) and `email` claims. Decoded locally — no network call needed. |
| `cognito_access_token` | JWT | 1 day | Required for `GlobalSignOut`. Not decoded. |
| `cognito_refresh_token` | Opaque string | 10 years | Used to renew id/access tokens. Never decoded. |

All three are stored in `localStorage` (persists across tab close and browser restart). On logout, all three are removed.

The `REFRESH_TOKEN_AUTH` flow never returns a new `RefreshToken` — the existing one must be reused. This is a Cognito design choice; the refresh token's expiry clock resets on each use.

---

### DynamoDB Key Design for Per-User Data

With auth, data must be scoped per user. The table key schema changes:

| | Before auth | After auth |
|---|---|---|
| PK | `date` (YYYY-MM-DD) | `userId` (`USER#<cognito-sub>`) |
| SK | `completedAt` (ISO timestamp) | `completedAt` (ISO timestamp) |
| `date` | PK | Regular attribute |

**Why `USER#` prefix?** A namespacing convention that makes the key type explicit in the raw table. Useful if you later add other entity types (e.g. `CONFIG#<userId>`) to the same table.

**Why `sub` not email?** The `sub` claim is a UUID assigned at user creation and never changes, even if the email is updated. Using email as a key would make email changes a data migration.

**`lib/sessions.js` pattern:**
```js
// Write
await docClient.send(new PutCommand({
  TableName: TABLE,
  Item: { userId: `USER#${userId}`, completedAt, date, durationMinutes },
}))

// Read
await docClient.send(new QueryCommand({
  TableName: TABLE,
  KeyConditionExpression: '#pk = :pk',
  ExpressionAttributeNames: { '#pk': 'userId' },
  ExpressionAttributeValues: { ':pk': `USER#${userId}` },
}))
```

---

### Session Persistence and Offline Behavior

| Scenario | Result |
|---|---|
| App opened, online, valid refresh token | Silent refresh → stay logged in, tokens updated |
| App opened, offline, cached IdToken present | Instant render from cache → stay logged in, no network call needed |
| App opened, offline, no cached token | Stuck at login — cannot authenticate without network |
| App opened, refresh token revoked/expired | Tokens cleared → login screen shown |
| Session timer running, app backgrounded on iOS | Timer continues via AudioContext; tokens unaffected |
| User explicitly logs out | `GlobalSignOut` → all tokens invalidated server-side + cleared locally |

**Effective logged-in duration:** 10 years (RefreshToken expiry). On a personal device where the app is opened regularly, the user will never see the login screen again after the first login.

---

### Security Notes

| Concern | Decision | Rationale |
|---|---|---|
| App Client secret | Not used | Cognito public clients have no secret by design — safe for browser apps |
| App Client ID in bundle | ✅ Safe | It's a public identifier, not a credential |
| IAM credentials in bundle | ⚠️ Known tradeoff | Scoped to `PutItem`/`Query` on one table — acceptable for a personal app with no sensitive data |
| Token storage | localStorage | Persists across sessions. sessionStorage would be safer against XSS but loses session on tab close — unacceptable UX for a mobile PWA |
| No PKCE / OAuth flow | ✅ Acceptable | `USER_PASSWORD_AUTH` is appropriate for a closed app with pre-created users. PKCE is for public OAuth flows. |
| `GlobalSignOut` on logout | ✅ Done | Invalidates all refresh tokens across all devices server-side |

---

### Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `InvalidParameterException: USER_PASSWORD_AUTH flow not enabled` | App Client doesn't have the flow enabled | AWS Console → Cognito → User Pool → App clients → Edit → check `ALLOW_USER_PASSWORD_AUTH` |
| `region is missing` | `VITE_AWS_REGION` env var not set at build time | Add to GitHub Secrets and redeploy; restart dev server locally |
| `undefined: undefined` on login error | SDK threw before making HTTP call (empty credentials) | Ensure `VITE_AWS_ACCESS_KEY_ID` and `VITE_AWS_SECRET_ACCESS_KEY` are set |
| User status is `FORCE_CHANGE_PASSWORD` | `admin-create-user` run but `admin-set-user-password` not run | Run the second command in `create-user.sh` |
| Login succeeds locally but fails in prod | Env vars not in GitHub Secrets / not passed to build step | Check `deploy.yml` `env:` block; verify secrets are set in repo settings |

---

## 16. Session Notes

### Overview

Each completed meditation session can optionally have a short reflection note attached to it. Notes are **per-session**, not per-day — if you meditate twice in one day, each session gets its own note. Notes can only be added or edited on the same day the session was completed; past days are read-only.

### Where notes are added/edited

1. **Done screen** (after a session finishes) — a subtle `+ add note` link appears below the "done" text. Tapping it expands an inline textarea + save button. Only "add" exists here (a session that just finished can't already have a note).

2. **Reflect page** (`/reflect`) — reachable from a new "reflect" link on the Landing page (above "history"). The link is only shown if the user has at least one completed session today. Behavior:
   - **1 session today** → opens the note editor for that session directly
   - **2+ sessions today** → shows a picker (stacked list of session cards — time + duration), tap to pick one and open its editor
   - The editor supports both add and edit (prefills with any existing note). Save button writes the note to DynamoDB.

3. **History page** — notes are **read-only**. Tapping a date in the calendar shows a detail panel below the calendar grid with each session for that day: time, duration, and the note (if any).

### Landing "reflect" link visibility

The reflect link only appears when the user has meditated today. To avoid a DynamoDB query on every Landing mount, we use a localStorage hint: on session completion, write `lastSessionDate` (YYYY-MM-DD). On Landing mount, read it and compare to today — if equal, show the link.

**Tradeoff:** if you complete a session on device A and immediately open the app on device B, device B won't show the reflect link until it fetches fresh data. For a single-user personal app this is acceptable.

### Data model

The note is stored as a `note` string attribute directly on the existing session item. No new table or item type.

| Attribute | Type | Notes |
|---|---|---|
| `userId` (PK) | String | `USER#<cognito-sub>` (unchanged) |
| `completedAt` (SK) | String | ISO timestamp (unchanged) |
| `date` | String | YYYY-MM-DD (unchanged) |
| `durationMinutes` | Number | (unchanged) |
| `note` | String | **New.** Optional. Added/updated via `UpdateCommand`. |

**Write pattern:** `UpdateCommand` with `SET #n = :note` — creates or replaces the attribute. Keyed by `userId` + `completedAt` so we target the exact session.

**Read pattern:** no change — `fetchSessions` already returns all attributes via `Query`, so `note` comes through automatically.

### `lib/sessions.js` additions

```js
export async function updateSessionNote({ userId, completedAt, note }) {
  if (!userId || !completedAt) throw new Error('updateSessionNote requires userId and completedAt')
  if (isDev) {
    console.log('[dev] skipping DynamoDB note update:', { userId, completedAt, note })
    return
  }
  await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId: `USER#${userId}`, completedAt },
    UpdateExpression: 'SET #n = :note',
    ExpressionAttributeNames: { '#n': 'note' },
    ExpressionAttributeValues: { ':note': note },
  }))
}
```

### IAM policy update

The IAM user needs `dynamodb:UpdateItem` on the table in addition to the existing `PutItem` and `Query`.

### Component changes

| File | Change |
|---|---|
| `lib/sessions.js` | Add `updateSessionNote()`; `recordSession()` also writes `localStorage.lastSessionDate` |
| `pages/Session.jsx` | Store session's `completedAt` in state; after "done", show `+ add note` link → expands textarea; call `updateSessionNote` on save |
| `pages/Reflect.jsx` (NEW) | Fetch today's sessions; single-session auto-opens editor; multi-session shows picker |
| `pages/Landing.jsx` | Conditionally show "reflect" link based on `localStorage.lastSessionDate === today` |
| `pages/History.jsx` | Manage `selectedDate` state; pass `onDayClick` to MonthGrid; render detail panel below grid with each session's time, duration, and note |
| `components/MonthGrid.jsx` | Remove internal `selectedDate` state; accept `selectedDate` + `onDayClick` props; remove inline detail rendering (now handled by History) |
| `App.jsx` | Add `/reflect` route |

### Edge cases

| Scenario | Behavior |
|---|---|
| Session completes, user adds note, then taps back without saving | Note is not persisted — cleanup fires, navigation returns to landing |
| User opens reflect page but has no sessions today (stale localStorage hint) | Show "no sessions today" empty state with back button |
| User adds a note offline | `updateSessionNote` fails silently (logged to console). UI shows as saved optimistically. Not retried. |
| Multiple sessions today, user picks one, then goes back | Return to picker, not landing |
| Note contains newlines / long text | Textarea supports multiline; no hard character limit enforced client-side |
