# Thrustfall

A 2D physics-based spaceship cave combat game built in a single `index.html` with a dedicated Node.js WebSocket multiplayer server.

---

## Repository & Deployment

| Item | Value |
|---|---|
| **GitHub** | `https://github.com/saykeyo-creator/thrustfall.git` |
| **Branch** | `main` |
| **Hosting** | [Render](https://render.com) — Web Service, auto-deploys on push to `main` |
| **Live URL** | `https://thrustfall-qr58.onrender.com` |
| **Render plan** | Starter — $7/month, 0.5 vCPU, 512MB RAM |
| **Developer** | KeyoGames — `saykeyo@gmail.com` |
| **Play Store** | `com.lakesgames.thrustfall` (permanent package ID — do NOT change) |
| **Local dev** | `http://localhost:3000` (configurable via `PORT` env var) |

### Deploying to web

Push to `main` → Render auto-deploys. No action needed.

```bash
git add -A && git commit -m "message" && git push
```

Force redeploy without code changes:
```bash
git commit --allow-empty -m "Trigger Render redeploy" && git push
```

### Deploying to Android (Play Store)

Run `deploy.bat` from the project root. It will:
1. Auto-increment `versionCode` AND `versionName` patch (e.g. 1.2.3 → 1.2.4) using `increment-version.ps1`
2. Run `node build-mobile.js` — rebuilds `dist/` from root `index.html` (injects version string)
3. Run `npx cap sync android` — copies `dist/` into Android assets + ensures plugins are up to date
4. Run `gradlew bundleRelease` — builds a signed AAB
5. Copy output to `thrustfall-release.aab` in the project root

Upload `thrustfall-release.aab` to Play Console → Internal testing → select release.

**Requirements for deploy.bat:**
- Java: `C:\Program Files\Android\Android Studio\jbr`
- Android SDK: `%LOCALAPPDATA%\Android\Sdk` (API 36)
- Signing keystore: `thrustfall-upload.keystore` in project root (gitignored)
- Keystore props: `android/keystore.properties` (gitignored) — passwords `thrustfall2026`, alias `thrustfall`

### Running locally

```bash
npm install    # only needed once — installs 'ws' package
node server.js
```

Open `http://localhost:3000`. For multiplayer testing, open multiple tabs.

Kill stale processes if port 3000 in use:
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
node server.js
```

### Running tests

```bash
node tests.js
```

Pure Node.js — no framework. Currently **4772 assertions**, all passing.

---

## Versioning

Version is stored in one authoritative place: `android/app/build.gradle`.

```groovy
versionCode 3         // integer — must increment for every Play Store upload
versionName "1.2.0"   // x.y.z — patch auto-increments with every deploy.bat run
```

`deploy.bat` calls `increment-version.ps1` which increments BOTH values atomically.
`build-mobile.js` reads `versionName` and injects it as `__VERSION__` into `index.html` in `dist/`.
The UI displays it (e.g. "v1.2.3 • KeyoGames • 2026") — always in sync with the build.

**Never manually edit versionCode in build.gradle** — always run deploy.bat so both values increment together.

---

## File Structure

```
index.html              (~5000 lines) — THE ENTIRE GAME: HTML, CSS, JS, canvas, audio, UI
server.js               (~1200 lines) — Dedicated authoritative WebSocket game server
tests.js                              — Test suite (4772 assertions)
build-mobile.js                       — Builds dist/ for Capacitor; injects version string
increment-version.ps1                 — Increments versionCode + versionName.patch in build.gradle (gitignored)
deploy.bat                            — Full deploy pipeline: increment → build → cap sync → AAB (gitignored)
capacitor.config.json                 — Capacitor config (webDir: "dist")
package.json                          — Node.js config; dependencies: ws; devDependencies: capacitor, cordova-plugin-purchase
sw.js                                 — Service worker for PWA offline caching
privacy.html / terms.html            — Policy pages served at /privacy and /terms
manifest.json                         — PWA manifest
android/                              — Capacitor Android project
  app/src/main/AndroidManifest.xml   — Includes com.android.vending.BILLING permission
  app/src/main/assets/public/        — Synced from dist/ by cap sync
  app/build.gradle                   — versionCode, versionName, signing config
  keystore.properties                — (gitignored) keystore path + passwords
dist/                                 — (gitignored) built web assets, copied to Android by cap sync
thrustfall-upload.keystore            — (gitignored) Play Store upload signing key
thrustfall-release.aab                — (gitignored) output AAB from deploy.bat
```

---

## Build Pipeline (Important)

The correct order is always:
```
index.html (source)
    └─ node build-mobile.js        → dist/index.html (with __VERSION__ replaced)
        └─ npx cap sync android    → android/.../assets/public/index.html + cordova_plugins.js
            └─ gradlew bundleRelease → app-release.aab
```

`cap sync` also registers Cordova plugins (including `cordova-plugin-purchase`). If you skip it, the billing plugin won't be bundled. `deploy.bat` runs all steps in order automatically.

**Never edit `android/app/src/main/assets/public/index.html` directly** — it gets overwritten by `cap sync`.

---

## Native App (Android/Capacitor)

- **App ID:** `com.lakesgames.thrustfall` — permanent, cannot change after Play Store listing created
- **Config:** `capacitor.config.json` — `webDir: "dist"`
- **Plugins:** `cordova-plugin-purchase@13.13.1` (Google Play Billing)
- **BILLING permission:** `<uses-permission android:name="com.android.vending.BILLING" />` in AndroidManifest.xml
- **WS_URL detection:** On Android, `location.hostname === 'localhost'` → always connect to `wss://thrustfall-qr58.onrender.com` (not `ws://localhost` which would hit the phone itself)
- **Signing:** `signingConfigs.release` in `android/app/build.gradle` reads from `android/keystore.properties`

### Google Play Billing

In-app products are **non-consumable one-time purchases** for cosmetics. The code is fully wired:

- `IS_NATIVE` detects Capacitor Android vs web browser
- `initBilling()` registers all products via `CdvPurchase.store` and initialises Google Play
- `purchaseCosmetic(tab, id)` calls `store.order()` on Android; free-unlocks on web
- `unlockByProductId(productId)` grants ownership in `shopData` and saves to localStorage
- `restorePurchases()` calls `store.restorePurchases()` — shown as ↩ RESTORE button in shop (Android only)
- On success, `transaction.finish()` is called to acknowledge the purchase (required by Play Billing)

**Product IDs** — must be created in Play Console → Monetize → In-app products, matching exactly:

| Category | Product IDs |
|---|---|
| Ships | `skin_neon`, `skin_stealth`, `skin_phoenix`, `skin_gold`, `skin_ghost`, `skin_trident`, `skin_manta`, `skin_blade`, `skin_fortress`, `skin_falcon` |
| Trails | `trail_ice`, `trail_fire`, `trail_plasma`, `trail_rainbow`, `trail_toxic` |
| Engines | `engine_rumble`, `engine_whine`, `engine_pulse`, `engine_roar`, `engine_hum` |
| Kill FX | `killfx_vortex`, `killfx_electric`, `killfx_shatter`, `killfx_nova`, `killfx_void` |

All at $1.99. On web, items are free to unlock (no payment processor on web version).

---

## Server Architecture

The server is **fully authoritative for PVP** — runs physics/collision/weapon simulation at 60fps, broadcasts state at 30Hz. Clients send inputs only.

### Key server features
- Room system: 4-char codes, public browse, max 8 players, auto-countdown for public rooms (60s when 2+ players)
- Full physics: bullets, laser beams, pickups, shields, EMP, kills, scoring
- Perk system: validates loadout budget server-side, applies PVP multipliers
- Cosmetic sync: stores skin/trail/engineSound/killEffect per player, broadcasts in start data
- Delta compression: only changed fields sent between full syncs (`FULL_SYNC_INTERVAL = 60` frames)
- Rate limiting: 120 messages/second per WebSocket connection
- WebSocket keepalive: server pings all clients every 30s (prevents Render dropping idle connections)
- Rejoin handler: if a player reconnects with the same name + code, replaces their stale WS reference
- Idle cleanup: rooms with ≤1 player auto-destroyed after 5 minutes
- `/health` endpoint returns 200 OK for Render health checks
- `/privacy` and `/terms` serve policy HTML pages (NOT the game — explicit routes prevent fallthrough)

### Capacity estimate (Render Starter — 0.5 vCPU)

| Active games | Status |
|---|---|
| 1–5 | No load |
| 5–15 | Fine |
| 15–25 | Physics drift starts |
| 25+ | All rooms slow; upgrade to $25/month Standard |

Each room runs its own `setInterval` at 60Hz on Node.js's single thread. Memory is not the bottleneck (each room ~100–500KB); CPU is.

---

## index.html — Game Layout

Everything is in one file. Rough section map:

| Lines (approx) | Section |
|---|---|
| 1–12 | HTML structure: canvas, menu screens, overlays |
| 13–250 | CSS — all styling, responsive layout, splash screen |
| 253–520 | Constants, XP/Perk/Cosmetic data, settings, pickup types, maps |
| 519–575 | Bullet whizz sound detection |
| 579–640 | Audio system — `snd()` switch, `sndAt()` spatial audio |
| 640–950 | WebSocket connection, lobby, message handling, reconnect |
| 948–1200 | Screen management, menu/create/join/browse/solo/survival UI |
| 1200–1290 | Onboarding tutorial, game mode launchers |
| 1289–1425 | Survival wave system, bot spawning, wave modifiers |
| 1426–1625 | Bot AI (`computeBotInput` — personalities, terrain avoidance, targeting) |
| 1626–2200 | `beginGame()` — init players, apply perks, game state setup; physics helpers |
| 2206–2535 | `hostUpdate()` — authoritative loop for solo/survival (physics, collisions, EMP, pickups) |
| 2535–2750 | `clientUpdate()` — interpolation, client prediction, delta merge |
| 2753–2917 | `drawShipShape()` — all 11 ship skins, shared by game + shop |
| 2917–3480 | `draw()` — Canvas rendering (terrain, ships, particles, HUD, kill effects) |
| 3480–3600 | Radar (player-centered, wrap-aware, `wrapDelta`, `toRadar`) |
| 3600–3747 | Touch controls (`drawControls`, touch input) |
| 3747–3800 | Keyboard & gamepad input |
| 3801–3855 | Daily challenge system |
| 3819–3896 | Settings (sensitivity, left-handed, music/SFX volume) |
| 3856–3895 | Stats display |
| 3896–3980 | Perk shop JS (XP-based loadout) |
| 3980–4110 | Cosmetic shop JS (billing, buy/equip/unlock/restore) |
| 4113–4230 | `renderCosmeticShop()` — ship/trail/kill previews |
| 4232–4295 | Splash screen, service worker registration, audio init |
| 4297–4780 | Adaptive music system |
| 4783–5002 | Menu theme, resize handler, main game loop (fixed timestep) |

---

## Game Constants (Must Match Between Files)

These appear in BOTH `index.html` and `server.js`. If you change one, change the other. Tests sections 67–71 verify alignment.

```
G = 0.0396              Gravity
THRUST = 0.138          Thrust force
REV_THRUST = 0.138      Reverse thrust
ROT_SPD_MAX = 0.045     Rotation speed
MAX_SPD = 2.24          Speed cap
BULLET_SPD = 5.5        Bullet speed
BULLET_LIFE = 110       Bullet lifetime (frames)
FIRE_CD = 14            Base fire cooldown (frames)
SHIP_SZ = 10            Ship collision radius
LIVES = 10              Starting lives
RESPAWN_T = 90          Respawn timer (frames)
INVINCE_T = 120         Invincibility after respawn (frames)
BASE_W = 50             Landing base width
BASE_H = 28             Landing base height
WEAPON_TIMER = 1200     Weapon pickup duration (frames, 20s)
PICKUP_R = 18           Pickup collection radius
PICKUP_SPAWN_INTERVAL = 360  Frames between spawns (6s)
PICKUP_MAX = 5          Max pickups on map
STATE_INTERVAL = 2      Server broadcast rate (every 2 frames = 30Hz)
```

Viewport: `VIEW_W = 412, VIEW_H = 732` — height-fit scaling everywhere (tablets get side bars, never crops HUD).

---

## Architecture

### Game Modes

| Mode | Physics Authority | Multiplayer |
|---|---|---|
| **Survival** | Client (`hostUpdate`) | No — solo vs bot waves |
| **Practice** | Client (`hostUpdate`) | No — solo sandbox |
| **PVP Multiplayer** | Server (`Room.update`) | Yes — 2–8 players |

### Multiplayer Flow

1. Client sends `{t:'create'}` or `{t:'join'}` with name, map, perks, skin, trail, engine, kill
2. Server creates/joins Room, broadcasts lobby state
3. When all ready (or auto-countdown), server calls `Room.startGame()` → 3-2-1 countdown
4. Server runs physics at 60fps, broadcasts `{t:'s', f, p, b, bm, be, pk}` at 30Hz
5. Clients send `{t:'i', r, t, rv, f}` (rotation, thrust, reverse, fire)
6. Client does prediction + blends server correction at `CORRECTION_RATE`

### WS_URL (Critical — Android Fix)

```javascript
const WS_URL = (location.protocol === 'file:' || location.hostname === 'localhost')
    ? 'wss://thrustfall-qr58.onrender.com'
    : (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host;
```

`localhost` detection is essential — Capacitor serves the Android app from `localhost`, so without this check it would connect to `ws://localhost` (the phone itself) instead of Render.

### Key Global Variables

| Variable | Purpose |
|---|---|
| `isHost` | `true` for solo/survival, `false` for PVP client |
| `isMultiplayer` | `true` when in PVP mode |
| `myIndex` | Local player index |
| `players[]` | All player objects |
| `activeBonuses` | Current perk bonuses for this session |
| `shopData` | Persistent shop state (localStorage: `'gravShop'`) |
| `playerStats` | Persistent XP/level/stats (localStorage: `'gravStats'`) |

---

## XP & Perk System

### XP Progression
- `XP_PER_KILL = 25`, `XP_PER_WIN = 100`, `XP_PER_WAVE = 50`, `XP_PER_LAND = 5`, `XP_PER_PICKUP = 10`
- Level formula: `XP_LEVEL_BASE = 100`, `XP_LEVEL_SCALE = 1.4`
- localStorage key: `'gravStats'`

### Perks

`LOADOUT_POINTS = 3` — max equip budget.

| Perk | ID | XP Cost | Pts | Solo Effect | PVP Effect |
|---|---|---|---|---|---|
| Reinforced Shield | `shield` | 200 | 1 | +1 shield | +1 shield |
| Quick Loader | `firerate` | 300 | 1 | fireMul: 0.85 | fireMul: 0.92 |
| Boost Jets | `thrust` | 300 | 1 | thrustMul: 1.10 | thrustMul: 1.05 |
| Thick Hull | `hull` | 500 | 2 | +1 life | +1 life |
| Scavenger | `scavenger` | 400 | 1 | wpnMul: 1.25 | wpnMul: 1.15 |
| Quick Respawn | `respawn` | 250 | 1 | respawnMul: 0.70 | respawnMul: 0.85 |

Server validates perks: budget, duplicates, invalid IDs all rejected. Server applies PVP multipliers.

### Cosmetics

| Category | Items | Price |
|---|---|---|
| Ship skins | 11 (default free + 10 paid) | $1.99 each |
| Trail effects | 6 (default free + 5 paid) | $1.99 each |
| Engine sounds | 6 (default free + 5 paid) | $1.99 each |
| Kill effects | 6 (default free + 5 paid) | $1.99 each |

Visible to other players in PVP. localStorage key: `'gravShop'`.

---

## Weapons

| Weapon | Fire CD | Special |
|---|---|---|
| Stock | 9 frames | Fastest fire rate |
| Spread | 14 frames | 5 bullets in arc |
| Rapid | 5 frames | Twin barrels |
| Heavy | 16 frames | Big bullet, pierces 1 |
| Laser | 99 frames | Instant beam, hits every 8f |
| Burst | 18 frames | 7 bullets, slight jitter |
| Homing | 15 frames | Tracks nearest enemy |

### EMP (Special Pickup — Solo Only)
- `EMP_PULSE_DUR = 300`, `EMP_DISABLE_DUR = 240`, `EMP_RADIUS = 180`
- Disables thrust/weapons/shields on hit enemies for 4 seconds
- Not implemented on server (solo/survival only)

---

## Maps

| Key | Name | Width | Height | Notes |
|---|---|---|---|---|
| `caves` | THE CAVES | 3600 | 2000 | Default |
| `canyon` | DEEP CANYON | 2800 | 2800 | Tall |
| `asteroid` | ASTEROID FIELD | 4000 | 2400 | Reduced gravity (0.032) |
| `fortress` | TWIN FORTRESS | 4400 | 2000 | Wide |
| `tunnels` | THE LABYRINTH | 4000 | 2400 | Complex |
| `arena` | THE ARENA | 3200 | 1800 | Open, no platforms |

Maps are procedurally generated with seeded random (`mulberry32` PRNG) — deterministic across client and server.

---

## Bot AI (Survival Mode)

- 7 personalities: NOVA, VEGA, APEX, STORM, SONIC, PRISM, FANG (aggression/accuracy/reactionRate/range traits)
- 4 bot types: Normal, Fast (1.4x speed), Tank (+2 lives), Sniper
- Terrain avoidance with look-ahead raycasting
- Wave modifiers: Low Grav (wave 3+, every 3rd), Heavy Weapons (wave 7+, every 7th)
- Boss waves every 5th wave (tanks with star-prefixed names)
- Difficulty scales with wave: reaction rate `max(2, 12-difficulty)` frames

---

## Audio System

All audio generated via Web Audio API — no external files.

**Adaptive 4-layer music:**
1. Layer 1 (Dread Drone) — always on
2. Layer 2 (War Drums) — combat
3. Layer 3 (Palm-Mute Chugs) — intense combat
4. Layer 4 (Warzone Chaos) — 3+ enemies + intensity > 0.6

BPM ramps 110→130. Kill stingers, low-life heartbeat, base-on-fire siren.

**Bullet whizz sounds** — weapon-specific audio for incoming projectiles near the player.

---

## Key localStorage Keys

| Key | Contents |
|---|---|
| `gravStats` | `{xp, level, totalKills, totalDeaths, gamesPlayed, wins, bestWave, bestStreak, totalPickups, totalLandings, playTimeMin, ...}` |
| `gravShop` | `{unlockedPerks[], equippedPerks[], ownedSkins[], ownedTrails[], ownedEngines[], ownedKills[], activeSkin, activeTrail, activeEngine, activeKill, coins}` |
| `gravName` | Player name string |
| `gravSensitivity` | Input sensitivity (0.5–2.0) |
| `gravLeftHanded` | Boolean — left-handed control layout |
| `gravSurvivalBest` | `{caves: N, canyon: N, ...}` — best wave per map |
| `tf_played` | Boolean — skips splash on return visits |

---

## Common Issues & Debugging

### Tests fail after editing constants
Constants must match between `index.html`, `server.js`, and `tests.js`. Update all three.

### Git not found in terminal
```powershell
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
```

### Floating point in tests
`Math.floor(90 * 0.7)` = **62**, not 63 (IEEE 754). Always verify with `node -e "console.log(Math.floor(X * Y))"`.

### Policy pages showing the game
`/privacy` and `/terms` have explicit route handlers in `server.js` added above the static file fallthrough. If they ever revert to serving the game, check those routes weren't accidentally removed.

### Multiplayer disconnects immediately on Android
The `WS_URL` check for `location.hostname === 'localhost'` must be present. Without it, Capacitor apps connect to the phone's own localhost instead of Render.

---

## Gotchas & Lessons Learned

### 1. The Server Overwrites Everything (THE BIG ONE)

In PVP, the server broadcasts player state every frame. The client replaces its own values with server state. If the server doesn't apply a system (perks, cosmetics, etc.), the client's values get stomped back to defaults on the next broadcast.

**Lesson:** In an authoritative-server architecture, if the server doesn't simulate it, it doesn't exist in multiplayer. Always ask: "does the server know about this?"

### 2. Cosmetics Were Invisible to Other Players

`activeSkin`/`activeTrail` existed client-side but were never sent to the server, stored per player, or included in start data. Other players always saw default skins.

**Lesson:** Shared multiplayer state must flow through the server. Client-only state is invisible to others.

### 3. `getTerrainYAt()` Returned a Shared Mutable Object

The function originally returned a reference to a single reusable `{y, slope}` object. Two calls in the same tick (terrain + ceiling) overwrote each other.

**Lesson:** Never return mutable singleton objects from lookup functions called multiple times per tick.

### 4. Survival Mode Silently Undid Perk Bonuses

`startSurvival()` had hardcoded `players[0].lives = LIVES; players[0].shield = 1;` lines AFTER `beginGame()`, resetting perk bonuses every time.

**Lesson:** When adding a new system that modifies initialisation, grep every place those values are set. Stale hardcoded resets are always hiding somewhere.

### 5. Wave Rebuild Lost Cosmetics

`spawnSurvivalWave()` save/restore of player state didn't include `skin`/`trail` — player reverted to default after each wave.

**Lesson:** When a save/restore pattern exists, ensure it covers ALL properties, especially newly added ones.

### 6. Weapon Timer Bar Overflowed With Scavenger Perk

Scavenger extends weapon duration → `weaponTimer` starts above `WEAPON_TIMER` → fill ratio > 1 → bar overflowed container.

**Fix:** `fill = Math.min(1, pp.weaponTimer / WEAPON_TIMER)`

**Lesson:** Any time a multiplier feeds a UI gauge, clamp the display value.

### 7. World Wrap Rendering Had Offsets Swapped

Ships near world boundary need double rendering with `±worldW` offset. The signs were swapped — fixed by correcting offset arithmetic.

**Lesson:** World-wrap bugs are visually obvious but arithmetically subtle. Test at both boundaries (x≈0 AND x≈worldW).

### 8. Shield Hit Gave Too Much Invincibility

Shield absorbing a hit gave `invT = 30` (0.5s immunity). With 2-shield perk build, players were near-unkillable. Reduced to `invT = 1`.

**Lesson:** Balance invincibility frames for the maximum perk stack, not the default case.

### 9. Tablet Viewport Cropped HUD

`Math.max(screenW/W, screenH/H)` (cover scaling) on wide tablets picked width-based scale, making the viewport taller than the screen — HUD and controls were cut off.

**Fix:** Height-fit scaling: `viewScale = screenH / H`. Everyone sees the same 412×732 area. Tablets get side bars; phones have negligible side overflow.

**Lesson:** When HUD/controls are at top/bottom edges, always fit to height. Test on wide-aspect devices.

### 10. `requestAnimationFrame` Black Screen

Initial `requestAnimationFrame(loop)` call location matters — must fire after all rendering dependencies are ready, with `cancelAnimationFrame` to prevent duplicate loops.

### 11. EADDRINUSE — Stale Node Process

Don't try to kill by port PID. Kill all node processes, then wait:
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
node server.js
```

### 12. versionCode Auto-Increment Was Silently Failing

The original `deploy.bat` used `findstr` + batch `for /f` to read versionCode. If parsing failed silently, the replace did nothing and the AAB built with the same number → "version code already used" in Play Console.

**Fix:** Moved increment logic to `increment-version.ps1` — uses proper PowerShell regex capture group, errors loudly, and increments both `versionCode` AND `versionName` patch atomically.

### 13. cap sync Was Copying Stale Web Assets

The `webDir` in `capacitor.config.json` is `"dist"`, not `.`. Running `cap sync` without first running `node build-mobile.js` left stale assets in the Android bundle (old WS_URL, old branding, missing version injection).

**Fix:** `deploy.bat` always runs `build-mobile.js` → `cap sync` → `gradlew` in that order.

### 14. Policy Pages Served the Game

`/privacy` and `/terms` URLs have no file extension. No explicit route existed, so they fell through to `serveIndex()` and served the game HTML. Google Play's policy checker retrieved game HTML instead of policy text.

**Fix:** Explicit route handlers added to `server.js` before the static file fallthrough block.

### 15. Multiplayer Instantly Disconnected on Android

Capacitor serves the app from `localhost`. Without the `hostname === 'localhost'` check, `WS_URL` resolved to `ws://localhost` — connecting to the phone itself, not Render — and immediately failed.

**Fix:** `WS_URL` now detects `localhost` or `file:` protocol and hardcodes the Render URL.
