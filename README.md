# Thrustfall

A 2D physics-based spaceship cave combat game built entirely in a single HTML file with a dedicated Node.js WebSocket multiplayer server.

---

## Repository & Deployment

| Item | Value |
|---|---|
| **GitHub** | `https://github.com/Lakeaj/thrustfall.git` |
| **Branch** | `main` |
| **Hosting** | [Render](https://render.com) — Web Service (auto-deploys on push to `main`) |
| **Live URL** | Check Render dashboard — the service name is `thrustfall` |
| **Local dev** | `http://localhost:3000` |
| **Local port** | `3000` (configurable via `PORT` env var) |

### Deploying

1. Push to `main` → Render auto-deploys.
2. Force redeploy: `git commit --allow-empty -m "Trigger Render redeploy" && git push`
3. Render uses `npm install` then `npm start` (which runs `node server.js`).
4. The server serves `index.html` for all HTTP requests and upgrades `/` to WebSocket for multiplayer.

### Running locally

```bash
npm install        # only need once — installs 'ws' package
node server.js     # starts on http://localhost:3000
```

Open `http://localhost:3000` in a browser. For multiplayer testing, open multiple tabs.

If port 3000 is already in use (common issue — stale node processes):
```powershell
# Windows — kill anything on port 3000 then start
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
node server.js
```

### Running tests

```bash
node tests.js
```

Pure Node.js — no test framework needed. Currently **4733 assertions** across **233 sections**, all passing.

---

## File Structure

```
index.html           (~5000 lines)  — THE ENTIRE GAME: HTML, CSS, JS, Canvas rendering, audio, UI
server.js            (~1180 lines)  — Dedicated WebSocket game server (authoritative for PVP)
tests.js             (~6670 lines)  — Comprehensive test suite (4733 assertions)
sw.js                (~43 lines)    — Service worker for offline caching (PWA)
capacitor.config.json               — Capacitor config for native Android/iOS builds
package.json                        — Node.js config (only dependency: ws ^8.16.0)
```

### index.html — The Game (Single File)

Everything is in one file. The rough layout:

| Lines (approx) | Section |
|---|---|
| 1–12 | HTML structure: `<canvas>`, menu screens, overlays |
| 13–250 | CSS — all styling, responsive layout, splash screen |
| 253–520 | `<script>` — Constants, XP/Perk/Cosmetic data, settings, pickup types, maps |
| 519–575 | Bullet whizz sound system (`checkBulletWhizz`, weapon-type detection) |
| 579–640 | Audio system — `snd()` switch (all SFX including EMP + whizz variants), `sndAt()` spatial audio |
| 640–950 | WebSocket connection, lobby system, message handling, reconnect logic |
| 948–1200 | Screen management (`showScreen`), menu/create/join/browse/solo/survival UI |
| 1200–1290 | Onboarding tutorial, game mode launchers (Survival, Practice, Multiplayer) |
| 1289–1425 | Survival wave system, bot spawning, wave modifiers, bot types |
| 1426–1625 | Bot AI system (`computeBotInput` — personalities, terrain avoidance, targeting) |
| 1626–2200 | `beginGame()` — initializes players, applies perks, sets up game state; physics helpers |
| 2206–2535 | `hostUpdate()` — authoritative game loop for solo/survival (physics, collisions, EMP, pickups) |
| 2535–2750 | `clientUpdate()` — interpolation, client prediction, delta compression merge |
| 2753–2917 | Ship shape drawing (`drawShipShape` — all 11 skins), shared by game + shop |
| 2917–3480 | `draw()` — Canvas rendering (terrain, ships, particles, HUD, cosmetics, kill effects) |
| 3480–3600 | Player-centered radar (`drawRadar`, `wrapDelta`, `toRadar`, direction indicators) |
| 3600–3747 | Touch controls (`drawControls`, touch input handling) |
| 3747–3800 | Keyboard & gamepad input |
| 3801–3855 | Daily challenge system (`getDailyChallenge`, `checkDailyChallenge`) |
| 3819–3896 | Settings system (sensitivity, left-handed, music/SFX volume) |
| 3856–3895 | Stats display (`showStats`) |
| 3896–3980 | Perk shop JS (XP-based loadout) |
| 3980–4110 | Cosmetic shop JS (mock payments, buy/equip/unlock) |
| 4113–4230 | Cosmetic rendering (`renderCosmeticShop`, ship/trail/kill previews) |
| 4232–4295 | Splash screen, service worker registration, audio init |
| 4297–4780 | Adaptive music system (4-layer + dynamic systems, stingers, combat intensity) |
| 4783–5002 | Menu theme music (`startMenuTheme`), resize, main game loop (fixed timestep) |

### server.js — Dedicated Multiplayer Server

The server is authoritative for PVP — it runs the full physics/collision/weapon simulation at 60fps and broadcasts state at 30Hz. Clients send inputs only.

Key server features:
- Room system (create/join with 4-char codes, public browse, 8 players max)
- Full game simulation: physics, bullets, beams, pickups, shields, kills, scoring
- Perk system: validates and applies player perks server-side (budget enforcement, PVP multipliers)
- Cosmetic sync: stores skin/trail/engineSound/killEffect per player, broadcasts to all clients
- Delta compression: broadcasts only changed fields between full syncs (`FULL_SYNC_INTERVAL = 60` frames)
- Rate limiting: 120 messages/second per connection
- Idle room cleanup: rooms with ≤1 player auto-destroyed after 5 minutes
- Health endpoint: `GET /health` returns 200 OK for load balancer heartbeat
- Auto-countdown for public rooms (60s when 2+ players)
- Graceful disconnect handling, rematch voting system

### tests.js — Test Suite

Pure assertion-based tests. No framework. Pattern:

```javascript
section('N. Test Group Name');
{
    assert(condition, 'description');
    assertApprox(a, b, epsilon, 'description');
}
```

Test sections cover:
- **1–31**: Core physics, collisions, weapons, shields, pickups, terrain, maps, constants
- **32–57**: Spatial audio, kill streaks, scoring, spectator, bot AI, kill/death tracking
- **58–94**: Survival mode, network sync, client prediction, platforms, bullet lifetime
- **95–114**: Viewport, weapon balance, XP progression, world wrap rendering, fixed timestep
- **115–141**: Perk definitions, cosmetic shop, loadout system, perk gameplay integration, bug fix verification
- **142–143**: Server-side perk validation, server perk integration (respawn shield)
- **144–146**: Unique ship shapes (11 skins), music Layer 4 warzone trigger, height-fit tablet viewport
- **180**: EMP powerup full system
- **181–191**: Server mechanics (EMP gap, shield grace, disconnect, auto-countdown, room cap, creator leave, rate limiting, perk validation, input clamping)
- **192–197**: Achievements, daily challenges, XP scaling, multi-level-up, spendable XP, loadout budget
- **198–210**: Pickup placement, EMP events, survival guards/modifiers/state preservation, bot types, bot pickup AI, landing, client prediction, cleanup, combat intensity, score floats, interpolation
- **211–222**: Server deep tests (random codes, laser raycast, base explosion bug, broadcast safety, rematch, idle cleanup, events, broadcast fields, weapon cooldowns, pickup application, perk application, respawn multiplier)
- **223–227**: Special weapon shield damage, public join cosmetics, server lobby/start/join cosmetic sync
- **228–232**: Delta compression (structure, merge, periodic full sync, empty delta, client reset)
- **233**: Rematch countdown timer

Note: sections 147–179 are reserved (numbering gap).

---

## Architecture

### Game Modes

| Mode | Host | Physics Authority | Multiplayer |
|---|---|---|---|
| **Survival** | Client (isHost=true) | Client (`hostUpdate`) | No — solo vs bot waves |
| **Practice** | Client (isHost=true) | Client (`hostUpdate`) | No — solo sandbox |
| **PVP Multiplayer** | Server | Server (`Room.update`) | Yes — 2-8 players |

### Multiplayer Flow

1. Player opens menu → clicks MULTIPLAYER → Create or Join
2. Client connects WebSocket to server, sends `{t:'create', name, map, pub, perks, skin, trail, engine, kill}` or `{t:'join', code, name, perks, skin, trail, engine, kill}`
3. Server creates/joins Room, broadcasts lobby state
4. When all ready (or auto-countdown expires), server calls `Room.startGame()` → 3-2-1 countdown → `Room.beginGame()`
5. Server runs physics at 60fps, broadcasts state at 30Hz (`{t:'s', f, p, b, bm, be, pk}`)
6. Clients send inputs: `{t:'i', r, t, rv, f}` (rotation, thrust, reverse, fire)
7. Client does client-side prediction with server correction blending (`CORRECTION_RATE`)

### Key Global Variables (index.html)

| Variable | Purpose |
|---|---|
| `isHost` | `true` for solo/survival, `false` for PVP client |
| `isMultiplayer` | `true` when in PVP mode |
| `myIndex` | Local player's index in the players array |
| `players[]` | Array of all player objects |
| `activeBonuses` | Current perk bonuses for this game session |
| `shopData` | Persistent shop state (localStorage: `'gravShop'`) |
| `playerStats` | Persistent XP/level/stats (localStorage: `'gravStats'`) |

---

## Game Constants (Critical — Must Match Between Files)

These constants appear in BOTH `index.html` and `server.js`. If you change one, change the other. Tests in section 67-71 verify alignment.

```
G = 0.0396          Gravity
THRUST = 0.138       Thrust force (1.5x boost)
REV_THRUST = 0.138   Reverse thrust (= THRUST)
ROT_SPD_MAX = 0.045  Rotation speed
MAX_SPD = 2.24       Speed cap
BULLET_SPD = 5.5     Bullet speed
BULLET_LIFE = 110    Bullet lifetime (frames)
FIRE_CD = 14         Base fire cooldown (frames)
SHIP_SZ = 10         Ship collision radius
LIVES = 10           Starting lives
RESPAWN_T = 90       Respawn timer (frames, 1.5s at 60fps)
INVINCE_T = 120      Invincibility after respawn (frames, 2s)
BASE_W = 50          Landing base width
BASE_H = 28          Landing base height
WEAPON_TIMER = 1200  Weapon pickup duration (frames, 20s)
PICKUP_R = 18        Pickup collection radius
PICKUP_SPAWN_INTERVAL = 360  Frames between pickup spawns (6s)
PICKUP_MAX = 5       Max pickups on map
STATE_INTERVAL = 2   Server broadcast rate (every 2 frames = 30Hz)
```

Viewport is fixed: `VIEW_W = 412, VIEW_H = 732` (height-fit scaling — all devices see the same game area, tablets get side bars instead of top/bottom crop).

---

## XP & Perk System

### XP Progression
- `XP_PER_KILL = 25`, `XP_PER_WIN = 100`, `XP_PER_WAVE = 50`, `XP_PER_LAND = 5`, `XP_PER_PICKUP = 10`
- Level formula: `XP_LEVEL_BASE = 100`, `XP_LEVEL_SCALE = 1.4` (each level costs `floor(100 * 1.4^(level-1))`)
- XP stored in `playerStats` (localStorage key: `'gravStats'`)

### Perks (Loadout System)
- `LOADOUT_POINTS = 3` — max equip budget
- 6 perks, each with solo and PVP effect multipliers:

| Perk | ID | Cost (XP) | Pts | Solo Effect | PVP Effect |
|---|---|---|---|---|---|
| Reinforced Shield | `shield` | 200 | 1 | +1 shield | +1 shield |
| Quick Loader | `firerate` | 300 | 1 | fireMul: 0.85 | fireMul: 0.92 |
| Boost Jets | `thrust` | 300 | 1 | thrustMul: 1.10 | thrustMul: 1.05 |
| Thick Hull | `hull` | 500 | 2 | +1 life | +1 life |
| Scavenger | `scavenger` | 400 | 1 | wpnMul: 1.25 | wpnMul: 1.15 |
| Quick Respawn | `respawn` | 250 | 1 | respawnMul: 0.70 | respawnMul: 0.85 |

- Server validates perks: budget enforcement, duplicate rejection, invalid ID rejection
- Server applies PVP multipliers to: spawn shield/lives, thrust, fire cooldowns, respawn timer, weapon timer
- Client applies solo multipliers for Survival/Practice via `activeBonuses = getActivePerks(isMultiplayer)`
- Stored in `shopData.unlockedPerks[]` and `shopData.equippedPerks[]` (localStorage key: `'gravShop'`)

### Cosmetics
- 11 ship skins (each with a unique `drawShipShape` silhouette + canvas preview in shop): default, neon, stealth, phoenix, gold, ghost, trident, manta, blade, fortress, falcon
- 6 trail effects: default (free), ice, fire, plasma, rainbow, toxic
- 6 engine sounds: default (free), rumble, whine, pulse, roar, hum
- 6 kill effects: default (free), vortex, electric, shatter, nova, void
- Mock purchase system (no real payments implemented)
- Visible to other players in PVP (server stores skin/trail/engine/kill per player, broadcasts in start data)
- Stored in `shopData.ownedSkins[]`, `shopData.activeSkin`, `shopData.ownedTrails[]`, `shopData.activeTrail`, `shopData.ownedEngines[]`, `shopData.activeEngine`, `shopData.ownedKills[]`, `shopData.activeKill`

### Achievements

14 achievements tracked via `playerStats`:

| Achievement | Requirement |
|---|---|
| First Blood | 1 kill |
| Serial Killer | 50 kills |
| Centurion | 100 kills |
| Survivor | Wave 5 in Survival |
| Iron Will | Wave 10 in Survival |
| Champion | Win a multiplayer match |
| Dominator | Win 10 matches |
| Triple Threat | 3-kill streak |
| Unstoppable | 5+ kill streak |
| Pacifist | Wave 3 with 0 kills |
| Collector | 100 powerups collected |
| Ace Pilot | 200 landings |
| Veteran | 50 games played |
| Dedicated | 5 hours total playtime |

### Daily Challenges

7 rotating challenges, one per day (seeded by `Math.floor(Date.now() / 86400000)`):
- Get 3 kills with homing weapon (50 XP)
- Win a match without dying (75 XP)
- Land on 5 different surfaces (30 XP)
- Survive to wave 4 (60 XP)
- Get 10 kills in a single game (40 XP)
- Collect 5 powerups in one game (35 XP)
- Get a triple kill streak (50 XP)

### Onboarding & Splash Screen

- First visit shows a splash screen overlay (`menuSplash` div: "TAP TO START")
- Tapping initializes Web Audio API (browser requires user gesture) and transitions to main menu
- `localStorage` key `tf_played` tracks if player has seen tutorial; splash is skipped on return visits

---

## Weapons

| Weapon | Fire CD | Bullet Speed | Special |
|---|---|---|---|
| Stock (normal) | `FIRE_CD / 1.5` (9) | 1x | Fastest fire rate |
| Spread | `FIRE_CD` (14) | 1.05x | 5 bullets in arc |
| Rapid | `FIRE_CD * 0.4` (5) | 1.15x | Twin barrels |
| Heavy | `FIRE_CD * 1.2` (16) | 0.9x | Big bullet, pierces 1 |
| Laser | `BEAM_DUR + BEAM_CD` (99) | Instant | Beam, hits every 8 frames |
| Burst | `FIRE_CD * 1.3` (18) | 1.05x | 7 bullets, slight jitter |
| Homing | `FIRE_CD * 1.1` (15) | 0.9x | Tracks nearest enemy |

### EMP (Special Pickup)

EMP is a unique pickup — not a standard weapon replacement. Collecting it activates an AoE pulse:
- `EMP_PULSE_DUR = 300` (5 seconds active field)
- `EMP_DISABLE_DUR = 240` (4 seconds — disables thrust/weapons/shields on hit enemies)
- `EMP_RADIUS = 180` (blast radius in world pixels)
- Client-only (not implemented on server — solo/survival mode only)
- 4 custom sounds: `empSpawn`, `empActivate`, `empStruck`, `empPulse`

Fire rate perk (`fireMul`) applies to all except laser.

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

Maps are procedurally generated with seeded random (`mulberry32` PRNG) for determinism across client/server.

---

## Radar / Minimap

The radar is **player-centered** — the player's ship is always at the center of the circular minimap. All entities are positioned relative to the player using wrap-aware delta calculations (`wrapDelta`) to handle toroidal world boundaries correctly.

Key features:
- `viewRadius` scales to show ~45% of the largest world dimension
- `toRadar()` maps world coordinates to radar pixel coordinates relative to the player
- Canvas clipping creates a clean circular boundary
- Direction indicators (edge arrows) show off-screen player positions
- Terrain, ceilings, platforms, pickups, explosions, and other players all rendered

---

## Audio System

Adaptive 4-layer music system (Doom/Halo inspired) + 3 dynamic systems:

**Music Layers:**
1. **Layer 1 (Dread Drone)**: Always playing, low ambient
2. **Layer 2 (War Drums)**: Activates during combat
3. **Layer 3 (Palm-Mute Chugs)**: Activates during intense combat
4. **Layer 4 (Warzone Chaos)**: Activates when 3+ enemies are on screen and intensity > 0.6 — sirens, 32nd-note kicks, dissonant stabs, war horns

**Dynamic Systems:**
- **Layer transitions**: Smooth crossfade between combat intensity tiers
- **Low-life heartbeat**: Rhythmic pulse when player health is critically low
- **Base-on-fire siren**: Warning siren when a base is being destroyed

**Menu Theme:** Separate orchestral theme (`startMenuTheme`) plays on the main menu.

**Kill Stingers:** Short musical stabs play on kills (pitch/timbre varies by streak).

BPM ramps from 110 (calm) to 130 (combat).

**Bullet whizz sounds** — incoming projectiles near the player trigger weapon-specific audio cues:
- Standard bullets → sine wave descending pitch
- Heavy bullets → low sawtooth rumble
- Homing missiles → warbling triangle wave
- Rapid fire → short square wave chirps
- Laser beams → high sawtooth hiss (proximity-based via perpendicular distance)

**EMP sounds:** `empSpawn` (rising siren), `empActivate` (descending sweep), `empStruck` (bass hit), `empPulse` (short sine blip).

Throttled to max ~7 per second (`WHIZZ_COOLDOWN = 8` frames) to prevent audio spam.

All audio is generated via Web Audio API — no external audio files.

---

## Bot AI (Survival Mode)

- 7 bot personalities: NOVA, VEGA, APEX, STORM, SONIC, PRISM, FANG
- Each has aggression, accuracy, reactionRate, preferredRange traits
- 4 bot types with distinct properties:

| Type | Speed | Size | Extra Lives | Notes |
|---|---|---|---|---|
| Normal | 1.0x | 1.0x | 0 | Default |
| Fast | 1.4x | 0.85x | 0 | Smaller and quicker |
| Tank | 0.7x | 1.2x | +2 | Slower but durable |
| Sniper | 0.9x | 1.0x | 0 | Slightly slower |

- Terrain avoidance with look-ahead raycasting
- Target selection (nearest enemy, threat assessment)
- Wave progression: more bots, shields on wave 5+, boss waves every 5th wave
- Boss waves spawn tanks with star-prefixed names
- Wave modifiers:
  - **Low Grav** (wave 3+, every 3rd wave): gravity halved — higher jumps, longer flight
  - **Heavy Weapons** (wave 7+, every 7th wave): bots spawn with random weapons (spread/homing/laser)
- Bot difficulty scales with wave (1–10): affects reaction rate (`max(2, 12-difficulty)` frames per decision)
- Life bonus between waves: `+1 life` (capped at `LIVES + wave`)

---

## Native App (Capacitor)

- App ID: `com.lakesgames.thrustfall`
- Config: `capacitor.config.json`
- Platforms: Android + iOS
- The `webDir` is `.` (root) since the entire game is `index.html`
- No native build files are in this repo (generated separately)

---

## Common Issues & Debugging

### Server won't start (EADDRINUSE)
A stale node process is holding port 3000:
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
node server.js
```

### Git not found in terminal
PowerShell terminals spawned by VS Code sometimes lose PATH. Fix:
```powershell
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
```

### Tests fail after editing constants
Constants must match between `index.html`, `server.js`, and `tests.js`. The test suite replicates all constants at the top of the file. Update all three.

### Floating point in tests
Use `Math.floor()` carefully — e.g., `Math.floor(90 * 0.7)` = 62, not 63 (IEEE 754).

### Render deployment not updating
Check Render dashboard for build logs. Force redeploy:
```bash
git commit --allow-empty -m "Trigger Render redeploy" && git push
```

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
| `tf_played` | Boolean — set after first play (skips splash on return) |

---

## Development Workflow

1. Edit `index.html` and/or `server.js`
2. Run `node tests.js` to verify
3. Test locally: `node server.js` → open `http://localhost:3000`
4. Commit and push: `git add -A && git commit -m "description" && git push`
5. Render auto-deploys from `main` branch

The workspace is at: `C:\Users\ljack\Lakes_Games\Thrustfall`

---

## Gotchas & Lessons Learned

Hard-won knowledge from bugs that wasted real time. Read these before touching anything.

### 1. The Server Overwrites Everything (THE BIG ONE)

**What we tried:** Built the entire perk system client-side — `getActivePerks()` computes bonuses, `beginGame()` applies them to shield/lives/thrust/fire/respawn. Seemed to work in solo/survival. Shipped it.

**What actually happened:** In PVP, every perk was silently broken — shield perk did nothing, hull perk did nothing, ALL of them. The server runs the authoritative game simulation and broadcasts `{sh: p.shield, l: p.lives}` every frame. The client overwrites its own values with server state: `me.shield = sp.sh || 0`. The server initialised everyone with `shield: 1, lives: LIVES` (hardcoded, no perk awareness) so every broadcast stomped the client's perk bonuses back to defaults.

**The fix:** Had to add the full PERKS array and `getServerPerks()` to `server.js`. The server now stores each player's equipped perks from the create/join message, validates the loadout budget server-side (rejects over-budget, duplicates, invalid IDs), and applies PVP multipliers to every relevant system: spawn shield/lives, thrust, fire cooldowns, respawn timer, weapon timer, and respawn shield restoration.

**The lesson:** In an authoritative-server architecture, client-side game state is decorative. If the server doesn't know about a feature, the feature doesn't exist in multiplayer. Always ask: "does the server simulate this?"

### 2. Cosmetics Were Invisible to Other Players

**What we tried:** Added `shopData.activeSkin` and `shopData.activeTrail` on the client. The local player's ship rendered with their chosen cosmetics. Looked great in testing.

**What actually happened:** Other players in PVP only ever saw the default skin/trail because the server had no concept of skins or trails. The create/join messages didn't send them, the server didn't store them, and the start data broadcast didn't include them. Each client only knew its own cosmetics.

**The fix:** Client sends `skin` and `trail` in create/join messages. Server stores them on `lobbyPlayers[i]`. Server includes them in the start data broadcast. Client reads `data.players[i].skin/trail` for remote players in `beginGame()`.

**The lesson:** Same principle as #1 — if you want shared state in multiplayer, it must flow through the server.

### 3. `getTerrainYAt()` Returned a Shared Mutable Object

**What we tried:** Pickups spawn by calling `getTerrainYAt(x, terrain)` to get the terrain height, then `getTerrainYAt(x, ceiling)` to get the ceiling height, then placing the pickup between them.

**What actually happened:** Pickups spawned inside walls or at weird positions. The original `getTerrainYAt()` returned a reference to the same reusable object `{y, slope}` — the second call (ceiling) overwrote the first call's (terrain) return value because they pointed to the same object in memory.

**The fix:** Changed `getTerrainYAt()` to return a new `{y, slope}` object each time (or, in the binary-search version, compute a fresh result object).

**The lesson:** Never return mutable singleton objects from lookup functions that get called multiple times.

### 4. Survival Mode Silently Undid Perk Bonuses

**What we tried:** `beginGame()` applies perks (e.g. shield perk gives `shield: 2`). Then `startSurvival()` calls `beginGame(data)`. Should work.

**What actually happened:** `startSurvival()` had two lines AFTER `beginGame()`:
```js
players[0].lives = LIVES;     // overwrites perk bonus (was LIVES + 1)
players[0].shield = 1;         // overwrites perk bonus (was 2)
```
These were left over from before perks existed. They silently reset the player's perk bonuses on every survival start.

**The fix:** Removed those two lines. `beginGame()` already sets the correct perk-boosted values.

**The lesson:** When adding a new system (perks) that modifies initialisation, grep for EVERY place the initialised values get set. There are always stale hardcoded resets hiding somewhere.

### 5. Wave Rebuild Lost Cosmetics

`spawnSurvivalWave()` saves the human player's state (position, lives, weapon, etc.) then rebuilds the players array with new bots. The save/restore didn't include `skin` or `trail` properties. After each wave, the player reverted to default cosmetics.

**The fix:** Added `skin` and `trail` to the save object and the restore path.

**The lesson:** When a save/restore pattern exists, check it covers ALL properties — especially newly added ones.

### 6. Weapon Timer Bar Overflowed With Scavenger Perk

The scavenger perk extends weapon duration by 25% (solo). The weapon timer bar rendered as `fill = pp.weaponTimer / WEAPON_TIMER`. With scavenger, `weaponTimer` starts at 1500 but `WEAPON_TIMER` is 1200, giving `fill = 1.25` — the bar drew 25% past its container.

**The fix:** `fill = Math.min(1, pp.weaponTimer / WEAPON_TIMER)`.

**The lesson:** Any time you add a multiplier to a value that feeds a UI element (progress bar, meter, gauge), clamp the display value.

### 7. `requestAnimationFrame` Black Screen

The game loop used `requestAnimationFrame` but the initial call wasn't structured correctly — the canvas was created and the loop was set up, but `requestAnimationFrame(loop)` wasn't called at the right point, resulting in a black screen on load.

**The fix:** Ensured `af = requestAnimationFrame(loop)` is called at the end of `beginGame()` after all state is initialised, and `cancelAnimationFrame(af)` is called first to prevent duplicate loops.

**The lesson:** With `requestAnimationFrame`, the initial kick-off call location matters. It must happen after all rendering dependencies are ready.

### 8. World Wrap Rendering Had Offsets Swapped

Ships near the world boundary (x ≈ 0 or x ≈ worldW) need to be rendered twice — once at their real position and once offset by `±worldW` so they appear on both edges seamlessly. The offset values were swapped (added when should subtract, and vice versa).

**The fix:** Corrected the offset arithmetic in the wrap rendering code.

**The lesson:** World-wrap rendering bugs are visually obvious but arithmetically subtle. Test at both boundaries (x near 0 AND x near worldW).

### 9. Shield Hit Gave 30 Frames of Invincibility

When a shield absorbed a hit, the player got `invT = 30` (half a second of invincibility). This was way too generous — with a 2-shield perk build, players were nearly unkillable because each shield pop gave them 0.5s of immunity.

**The fix:** Reduced shield-hit invincibility to `invT = 1` (a single frame of grace, ~16ms). Just enough to prevent double-hits from the same bullet, not enough to escape.

**The lesson:** Invincibility frames that seem fine with 1 shield become overpowered when the perk system lets you stack shields. Always balance for the maximum perk case.

### 10. Thrust Particles Ignored Trail Cosmetics

The `hostUpdate` function spawns thrust and reverse-thrust particles with hardcoded orange/blue colors. When trail cosmetics were added (ice=blue, fire=red, plasma=purple, rainbow=hue-cycling), the particle colors were never updated to use them.

**The fix:** Added trail color computation: look up the player's `trail` property in `TRAIL_EFFECTS`, and use its `colors[]` array (or HSL hue cycling for rainbow) instead of the hardcoded defaults. Applied to both forward thrust and reverse thrust particles.

**The lesson:** Visual effects (particles, trails) are easy to forget when adding cosmetic systems. Search for every hardcoded color that should be dynamic.

### 11. `Math.floor(90 * 0.7)` = 62, Not 63

Wrote a test asserting `Math.floor(RESPAWN_T * 0.7) === 63`. Seemed obvious: 90 × 0.7 = 63. Test failed. IEEE 754 floating point: `90 * 0.7 = 62.99999999999999`, and `Math.floor` of that is 62.

**The fix:** Changed the assertion to 62.

**The lesson:** Never assume `Math.floor(a * b)` gives you `floor(a×b)` from pure math. Always verify with `node -e "console.log(Math.floor(X * Y))"` for test assertions.

### 12. EADDRINUSE — The Recurring Server Crash

Every single time we tried to restart the server, it crashed with `EADDRINUSE: address already in use 0.0.0.0:3000`. This happened because background node processes from previous runs held the port. Spent many terminal attempts doing targeted port kills before learning the reliable fix:

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
node server.js
```

**The lesson:** Don't try to be surgical (killing by port PID). Just kill all node processes — in a dev environment there's usually only one thing running. The `Start-Sleep` is necessary because Windows doesn't release the port instantly.

### 13. Tablet Viewport Cropped HUD & Controls

**What we tried:** Used `Math.max(screenW/W, screenH/H)` (cover mode) for viewport scaling — fills the screen with no black bars.

**What actually happened:** On tablets (Samsung Tab A9, wider aspect ratio than phones), `Math.max` picked width-based scaling, which made the viewport taller than the screen. The HUD (lives, kills) at the top was cropped off, and the joystick/fire button at the bottom were partially off-screen. Phones (S23 Ultra, taller aspect ratio) were fine because `Math.max` picked height-based scaling there.

**The fix:** Changed to height-fit scaling: `viewScale = screenH / H`. This ensures the full viewport height is always visible on every device. On narrow phones, the sides overflow slightly (harmless — no critical UI at the edges). On wide tablets, small black bars appear on the sides. Everyone sees the same 412×732 game area. No unfair advantage.

**The lesson:** `Math.max` scaling (cover) guarantees no bars but may crop important UI. When HUD and controls live at the top/bottom edges of the viewport, always fit to height. Test on devices with different aspect ratios, not just phones.
