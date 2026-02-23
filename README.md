# Gravitation Mobile

A Net Yaroze–inspired 2D spaceship combat game built entirely in a single HTML file with a dedicated Node.js WebSocket multiplayer server. Inspired by the original PlayStation 1 Net Yaroze game "Gravitation" (1998).

---

## Repository & Deployment

| Item | Value |
|---|---|
| **GitHub** | `https://github.com/Lakeaj/gravitation-mobile.git` |
| **Branch** | `main` |
| **Hosting** | [Render](https://render.com) — Web Service (auto-deploys on push to `main`) |
| **Live URL** | Check Render dashboard — the service name is `gravitation-mobile` |
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

Pure Node.js — no test framework needed. Currently **2997 assertions** across **153 sections**, all passing.

---

## File Structure

```
index.html           (~4400 lines)  — THE ENTIRE GAME: HTML, CSS, JS, Canvas rendering, audio, UI
server.js            (~1130 lines)  — Dedicated WebSocket game server (authoritative for PVP)
tests.js             (~4860 lines)  — Comprehensive test suite (153 sections, 2997 assertions)
sw.js                (~44 lines)    — Service worker for offline caching (PWA)
capacitor.config.json               — Capacitor config for native Android/iOS builds
package.json                        — Node.js config (only dependency: ws ^8.16.0)
```

### index.html — The Game (Single File)

Everything is in one file. The rough layout:

| Lines (approx) | Section |
|---|---|
| 1–40 | HTML structure: `<canvas>`, menu screens, overlays |
| 41–230 | Shop/perk UI HTML (perkShopScreen, cosmeticShopScreen) |
| 230–340 | CSS — all styling, responsive layout |
| 340–370 | `<script>` — Constants (must match server.js exactly) |
| 370–450 | XP/Perk/Cosmetic data structures & helper functions |
| 450–800 | WebSocket connection, lobby system, message handling |
| 800–1000 | Game mode launchers (Survival, Practice, Multiplayer) |
| 1000–1100 | Survival wave system, bot spawning |
| 1100–1350 | Bot AI system (personalities, terrain avoidance, targeting) |
| 1350–1420 | `beginGame()` — initializes players, applies perks, sets up game state |
| 1420–1700 | `hostUpdate()` — authoritative game loop for solo/survival modes |
| 1700–1900 | Physics, collisions, bullets, pickups, beams |
| 1900–2100 | `clientUpdate()` — interpolation, client prediction for PVP |
| 2100–2200 | Client-side prediction physics |
| 2200–2550 | `draw()` — Canvas rendering (ships, terrain, particles, HUD, cosmetics) |
| 2550–2700 | UI rendering (HUD, kill feed, score floats, weapon timer bar) |
| 2700–2900 | Input handling (touch, keyboard, gamepad) |
| 2900–3000 | Audio system (adaptive Doom/Halo-style music, spatial SFX) |
| 3000–3180 | Shop JS functions (perk shop, cosmetic shop, buy/equip/unlock) |
| 3180–3320 | Stats, XP system, game over screen |

### server.js — Dedicated Multiplayer Server

The server is authoritative for PVP — it runs the full physics/collision/weapon simulation at 60fps and broadcasts state at 30Hz. Clients send inputs only.

Key server features:
- Room system (create/join with 4-char codes, public browse, 8 players max)
- Full game simulation: physics, bullets, beams, pickups, shields, kills, scoring
- Perk system: validates and applies player perks server-side (budget enforcement, PVP multipliers)
- Cosmetic sync: stores skin/trail/engineSound/killEffect per player, broadcasts to all clients
- Auto-countdown for public rooms (60s when 2+ players)
- Graceful disconnect handling

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
- **1–31**: Core physics, collisions, weapons, shields, pickups, terrain, maps
- **32–57**: Spatial audio, kill streaks, scoring, spectator, bot AI
- **58–94**: Survival mode, network sync, client prediction, platforms
- **95–114**: Viewport, weapon balance, XP progression, world wrap rendering
- **115–141**: Perk definitions, cosmetic shop, loadout system, perk gameplay integration, bug fix verification
- **142–143**: Server-side perk validation, server perk integration
- **144–146**: Unique ship shapes, music Layer 4 warzone trigger, height-fit tablet viewport

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
2. Client connects WebSocket to server, sends `{t:'create', name, map, pub, perks, skin, trail}` or `{t:'join', code, name, perks, skin, trail}`
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
THRUST = 0.092       Thrust force
REV_THRUST = 0.092   Reverse thrust (= THRUST)
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
- `XP_PER_KILL = 25`, `XP_PER_WIN = 100`, `XP_PER_WAVE = 50`
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
- 6 ship skins (each with a unique ship silhouette + canvas preview in shop): default, neon, stealth, phoenix, gold, ghost
- 6 trail effects: default (free), ice, fire, plasma, rainbow, toxic
- Mock purchase system (no real payments implemented)
- Visible to other players in PVP (server stores skin/trail per player, broadcasts in start data)
- Stored in `shopData.ownedSkins[]`, `shopData.activeSkin`, `shopData.ownedTrails[]`, `shopData.activeTrail`

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

## Audio System

Adaptive 4-layer music system (Doom/Halo inspired):
1. **Layer 1 (Dread Drone)**: Always playing, low ambient
2. **Layer 2 (War Drums)**: Activates during combat
3. **Layer 3 (Palm-Mute Chugs)**: Activates during intense combat
4. **Layer 4 (Warzone Chaos)**: Activates when 3+ enemies are on screen and intensity > 0.6 — sirens, 32nd-note kicks, dissonant stabs, war horns

BPM ramps from 110 (calm) to 130 (combat). Kill stingers play on kills.

All audio is generated via Web Audio API — no external audio files.

---

## Bot AI (Survival Mode)

- 7 bot personalities: NOVA, BLAZE, VIPER, STORM, GHOST, COBRA, FANG
- Each has aggression, accuracy, reactionRate, preferredRange traits
- Terrain avoidance with look-ahead raycasting
- Target selection (nearest enemy, threat assessment)
- Wave progression: more bots, shields on higher waves, boss waves every 5th wave
- Life bonus between waves: `min(3, floor(wave/2))`

---

## Native App (Capacitor)

- App ID: `com.lakesgames.gravitation`
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
| `gravStats` | `{xp, level, kills, deaths, gamesPlayed, wins, survivalBest, ...}` |
| `gravShop` | `{unlockedPerks[], equippedPerks[], ownedSkins[], ownedTrails[], activeSkin, activeTrail, coins}` |
| `gravName` | Player name string |
| `gravSensitivity` | Input sensitivity (0.5–2.0) |
| `gravLeftHanded` | Boolean — left-handed control layout |

---

## Development Workflow

1. Edit `index.html` and/or `server.js`
2. Run `node tests.js` to verify
3. Test locally: `node server.js` → open `http://localhost:3000`
4. Commit and push: `git add -A && git commit -m "description" && git push`
5. Render auto-deploys from `main` branch

The workspace is at: `C:\Users\ljack\Lakes_Games\Gravitation Mobile`

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
