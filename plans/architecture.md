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

Authentication is added via **AWS Cognito User Pools** — a managed identity service that handles credential storage, token issuance, and session lifecycle. The frontend talks directly to Cognito using the AWS SDK (`amazon-cognito-identity-js` or `@aws-sdk/client-cognito-identity-provider`). No backend API layer is introduced.

---

### Auth Flow Diagram

#### App Load
```
App mounts
    │
    ▼
Read localStorage for cached IdToken
    │
    ├── No token → attempt refresh (below)
    │
    └── Token found → immediately render app (fast path, no login prompt)
            │
            ▼
        Call Cognito: REFRESH_TOKEN_AUTH using RefreshToken (background)
            │
            ├── Refresh succeeds → update tokens in localStorage, update user context
            │
            ├── Refresh fails (NotAuthorizedException / InvalidParameterException)
            │       → clear tokens → show Login screen
            │
            └── Refresh fails (network error / offline)
                    → keep existing tokens, keep user logged in
                    → will retry on next app load when online
```

#### Login
```
User submits username + password
    │
    ▼
Call Cognito: InitiateAuth (USER_PASSWORD_AUTH flow)
    │
    ├── Success → Receive IdToken + AccessToken + RefreshToken
    │           → Extract userId (sub) from IdToken claims
    │           → Persist all three tokens to localStorage
    │           → Store userId in React app state
    │           → Navigate to Landing
    │
    ├── NotAuthorizedException → Show "Invalid username or password"
    ├── UserNotFoundException  → Show "Invalid username or password"
    │   (same message — don't reveal which field failed)
    └── NetworkError           → Show "Connection error, try again"
```

#### Logout
```
User taps "Log out"
    │
    ▼
Call Cognito: GlobalSignOut (invalidates all refresh tokens server-side)
    │
    ▼
Clear localStorage (tokens + any cached user state)
    │
    ▼
Navigate to Login screen
```

---

### Key Components

#### Frontend

| Component | Purpose |
|---|---|
| `lib/auth.js` | Cognito SDK wrapper: `login()`, `logout()`, `refreshSession()`, `getUserId()` |
| `context/AuthContext.jsx` | React context: holds `userId`, `username`, `isAuthenticated`; provides `login` / `logout` actions |
| `pages/Login.jsx` | Username + password form; calls `auth.login()`; handles error states |
| `pages/Account.jsx` | Shows username, "Log out" button |
| `App.jsx` (updated) | On mount: attempts session restore; renders `<Login />` if unauthenticated, main routes if authenticated |

#### No Backend Required
Cognito is called directly from the browser using the public **App Client ID** (no client secret — Cognito public app clients are designed for this). The App Client ID is not a secret; it is safe to ship in frontend code.

---

### Cognito Setup (Manual, One-Time)

1. **Create a User Pool** in AWS Console
   - Sign-in: email (as username)
   - Password policy: relaxed for MVP (min 6 chars, no complexity requirements)
   - MFA: disabled
   - Self-registration: **disabled** (admin-only user creation)

2. **Create an App Client**
   - Type: Public client (no client secret)
   - Auth flows: `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
   - No OAuth / hosted UI needed

3. **Create test user via CLI** (not hardcoded in frontend, excluded from git)

```bash
# scripts/create-user.sh (gitignored)
aws cognito-idp admin-create-user \
  --user-pool-id $COGNITO_USER_POOL_ID \
  --username barryayang@gmail.com \
  --temporary-password "drybones" \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id $COGNITO_USER_POOL_ID \
  --username barryayang@gmail.com \
  --password "drybones" \
  --permanent
```

The `admin-set-user-password --permanent` step is required to bypass Cognito's forced-password-change flow on first login.

4. **Add env vars to `.env`** (not committed — add to `.gitignore`):
```
VITE_AWS_REGION=us-east-1
VITE_AWS_ACCESS_KEY_ID=...
VITE_AWS_SECRET_ACCESS_KEY=...
VITE_COGNITO_CLIENT_ID=...
```

5. **Add the same vars as GitHub Secrets** (Settings → Secrets → Actions) so the GitHub Actions build bakes them in:
- `VITE_AWS_REGION`
- `VITE_AWS_ACCESS_KEY_ID`
- `VITE_AWS_SECRET_ACCESS_KEY`
- `VITE_COGNITO_CLIENT_ID`

The User Pool ID is not needed client-side — the App Client ID is scoped to its pool.

---

### Session Management

| Token | Storage | Expiry | Purpose |
|---|---|---|---|
| `IdToken` (JWT) | localStorage | 1 day | Contains user claims (`sub` = userId, `email`). Source of user identity. |
| `AccessToken` (JWT) | localStorage | 1 day | Used for Cognito API calls (e.g. GlobalSignOut) |
| `RefreshToken` (opaque) | localStorage | 3,650 days (10 years) | Renews IdToken + AccessToken on app load |

**On app mount:** if a cached IdToken exists, the app renders immediately (no flicker to login). A background refresh updates the tokens. If refresh fails due to a network error (e.g. offline), the user stays logged in with the cached token — they'll refresh next time they're online. If refresh fails due to an auth error (expired/revoked), tokens are cleared and login is shown.

**Effective session length:** 10 years (driven by RefreshToken expiry). The user should never need to re-login on a personal device under normal circumstances.

**Token renewal is not proactive** — only on app load. IdToken lasts 1 day, sessions are ≤60 min, so no mid-session renewal is needed.

---

### Data Model Changes

The DynamoDB table (`meditation-sessions-db`) needs to be re-keyed to scope data per user.

**Current schema:**
| Key | Type | Notes |
|---|---|---|
| `date` (PK) | String | YYYY-MM-DD |
| `completedAt` (SK) | String | ISO timestamp |

**Updated schema:**
| Key | Type | Notes |
|---|---|---|
| `userId` (PK) | String | `USER#<cognito-sub>` |
| `completedAt` (SK) | String | ISO timestamp |
| `date` | String | YYYY-MM-DD (regular attribute, for display/filtering) |
| `durationMinutes` | Number | |

**Why move `date` out of the PK:**
With multi-user support, the natural partition key becomes `userId`. Keeping `date` as PK would mix users' data. `completedAt` as SK still provides ordering and uniqueness within a user.

**Query pattern:**
- Fetch all sessions for a user: `Query` where PK = `USER#<sub>` (replaces current `Scan`)
- This is efficient and cheap — no full table scan needed once users are scoped properly

**Migration note:** Existing test records (date-keyed) will be orphaned and can be deleted. Since the table only has dev data, a table wipe is acceptable.

---

### Security Tradeoffs (Explicit)

| Concern | Decision | Rationale |
|---|---|---|
| Client secret in frontend | None needed | Cognito public app clients have no client secret by design |
| App Client ID in frontend | ✅ Safe to expose | Not a credential — only enables auth against a specific user pool |
| User Pool ID in frontend | ✅ Safe to expose | Same reasoning — publicly known by design |
| localStorage for tokens | ✅ Acceptable for MVP | XSS risk is theoretical for a personal app; sessionStorage would be slightly safer but loses persistence on tab close |
| IAM credentials in frontend | ⚠️ Unchanged concern | Pre-existing tradeoff from DynamoDB setup — acceptable for personal app |
| GlobalSignOut on logout | ✅ Done | Invalidates refresh tokens server-side, not just client-side |
| No PKCE / OAuth flow | ✅ Acceptable | USER_PASSWORD_AUTH is sufficient for a non-public app with known users |

---

### Edge Cases

| Scenario | Behavior |
|---|---|
| Refresh token expired (>10 years inactive) | `refreshSession()` returns `NotAuthorizedException` → clear tokens → redirect to login |
| User refreshes page mid-session (timer running) | Timer resets (pre-existing behavior). Auth state is restored from localStorage before app renders — no login prompt. |
| Failed login attempt | Show error message. No lockout handling in UI (Cognito has built-in rate limiting server-side). |
| Network failure during login | Catch error → show "connection error, try again" |
| App opened offline with cached tokens | User stays logged in (tokens preserved). History page shows error loading data. Timer works fully offline. |
| App opened offline with no tokens | Stuck on login screen — can't authenticate without network. |
| Network failure during DynamoDB write | Pre-existing behavior: log warning, don't surface to user |
| User logs out on one device | RefreshToken invalidated globally. Other devices will fail to refresh on next app load and redirect to login. |
| Cognito service outage | Login blocked. If already authenticated and token still valid (<1hr), app continues to function. After expiry, redirect to login. |

---

### Assumptions

1. No sign-up flow — users are pre-created by admin via CLI script.
2. No password reset UI — can be done via AWS Console or CLI if needed.
3. No MFA — out of scope.
4. Single Cognito User Pool shared for all environments (MVP simplification). A prod/dev split would be the next step.
5. The Cognito `sub` claim (a UUID) is used as the canonical userId — not the email. This decouples identity from contact info.
6. The existing IAM user (`workout-tracker-app`) will be granted `dynamodb:Query` on the updated table (replacing `dynamodb:Scan`).

---

### Implementation Status ✅

All auth features are implemented and deployed:

1. ✅ **AWS Setup** — User Pool + App Client created; `ALLOW_USER_PASSWORD_AUTH` enabled on App Client; user created via `create-user.sh`; env vars added to `.env` and GitHub Secrets
2. ✅ **`lib/auth.js`** — Cognito SDK wrapper: `login()`, `logout()`, `refreshSession()`, `getCurrentUser()`, `clearTokens()`
3. ✅ **`context/AuthContext.jsx`** — `authState` ('loading' | 'authenticated' | 'unauthenticated'), `user` (`{ userId, username }`), `login`, `logout`; session restore with offline resilience
4. ✅ **`pages/Login.jsx`** + **`styles/Login.css`** — Email + password form; error handling for bad credentials and network failures
5. ✅ **`App.jsx`** — `AuthProvider` wraps all routes; `AuthedRoutes` gates on `authState`
6. ✅ **`lib/sessions.js`** — `USER#<userId>` PK; `QueryCommand` replaces `ScanCommand`
7. ✅ **DynamoDB** — Table recreated with `userId` (PK) + `completedAt` (SK)
8. ✅ **`pages/Account.jsx`** + **`styles/Account.css`** — Username display + log out button
9. ✅ **`Landing.jsx`** — "account" link added
