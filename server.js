// =====================================================
// GRAVITATION MOBILE — Dedicated WebSocket Game Server
// Run: npm install && npm start
// =====================================================

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// =====================================================
// GAME CONSTANTS (must match client exactly)
// =====================================================
const G = 0.0396, THRUST = 0.092, ROT_SPD_MAX = 0.045, MAX_SPD = 2.24;
const REV_THRUST = 0.0552;
const BULLET_SPD = 5.5, BULLET_LIFE = 110, FIRE_CD = 14, SHIP_SZ = 10;
const LIVES = 10, RESPAWN_T = 90, INVINCE_T = 120;
const BASE_W = 50, BASE_H = 28;
const BASE_EXP_DUR = 240, BASE_EXP_R = 65, RESPAWN_KILL_R = 58;
const LAND_MAX_SPD = 2.2, LAND_MAX_ANGLE = 0.85;
const STATE_INTERVAL = 2; // broadcast every 2 frames = 30 Hz
const COLORS = ['#00ccff','#ff3366','#33ff66','#ffcc00','#ff66ff','#66ffcc','#ff8833','#aa66ff'];
const PICKUP_R = 18, PICKUP_SPAWN_INTERVAL = 360, PICKUP_MAX = 5;
const PICKUP_TYPES = [
    { id:'spread', weight:3 }, { id:'rapid', weight:3 }, { id:'heavy', weight:2 },
    { id:'laser', weight:2 },  { id:'burst', weight:2 }, { id:'homing', weight:1 },
    { id:'shield', weight:4 }, { id:'heart', weight:2 }
];
const PICKUP_TOTAL_WEIGHT = PICKUP_TYPES.reduce((s,p) => s + p.weight, 0);
const BEAM_DUR = 60, BEAM_CD = 54, BEAM_RANGE = 450, BEAM_HIT_INTERVAL = 8;
const STREAK_WINDOW = 240;
const STREAK_NAMES = ['','','DOUBLE KILL','TRIPLE KILL','MULTI KILL','MEGA KILL','ULTRA KILL','MONSTER KILL'];
const MAPS = {
    caves:    { name:'THE CAVES',      w:3600, h:2000 },
    canyon:   { name:'DEEP CANYON',     w:2800, h:2800 },
    asteroid: { name:'ASTEROID FIELD', w:4000, h:2400, gravity:0.032 },
    fortress: { name:'TWIN FORTRESS',  w:4400, h:2000 },
    tunnels:  { name:'THE LABYRINTH',  w:4000, h:2400 },
    arena:    { name:'THE ARENA',      w:3200, h:1800 }
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function dist(x1, y1, x2, y2, wW) {
    let dx = Math.abs(x2 - x1);
    if (wW && dx > wW / 2) dx = wW - dx;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}
function ptInRect(px, py, rx, ry, rw, rh) { return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh; }
function rd(n) { return Math.round(n * 10) / 10; }
function rdA(n) { return Math.round(n * 1000) / 1000; } // higher precision for angles
function getTerrainYAt(x, arr) {
    for (let i = 0; i < arr.length - 1; i++) {
        if (x >= arr[i].x && x <= arr[i + 1].x) {
            const f = (x - arr[i].x) / (arr[i + 1].x - arr[i].x);
            return { y: arr[i].y + f * (arr[i + 1].y - arr[i].y), slope: Math.atan2(arr[i + 1].y - arr[i].y, arr[i + 1].x - arr[i].x) };
        }
    }
    return null;
}
function canLand(p, surface) {
    const speed = Math.sqrt(p.vx ** 2 + p.vy ** 2);
    const upright = Math.abs(p.angle + Math.PI / 2);
    return speed < LAND_MAX_SPD && upright < LAND_MAX_ANGLE && Math.abs(surface.slope) < 0.7 && p.vy >= 0 && p.vy < LAND_MAX_SPD * 1.5;
}
function randomCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
}
function randomPickupType() {
    let r = Math.random() * PICKUP_TOTAL_WEIGHT;
    for (const pt of PICKUP_TYPES) { r -= pt.weight; if (r <= 0) return pt.id; }
    return PICKUP_TYPES[PICKUP_TYPES.length - 1].id;
}

// =====================================================
// MAP GENERATION (identical to client)
// =====================================================
function generateMap(key) {
    const m = MAPS[key];
    const w = m.w, h = m.h;
    const t = [], c = [], p = [];
    const seg = Math.round(w / 36), sw = w / seg;
    let seed = key.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) * 137 + 42;
    function srand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    for (let i = 0; i <= seg; i++) {
        const x = i * sw;
        const ph = (i / seg) * Math.PI * 2;
        let ty, cy;
        switch (key) {
            case 'caves':
                ty = h-80+Math.sin(ph*2)*30+Math.sin(ph*5)*55+Math.cos(ph*3)*40+Math.sin(ph*8)*25+Math.cos(ph*13)*18+Math.sin(ph*11)*15+Math.cos(ph*17)*8;
                cy = 80+Math.sin(ph*3)*30+Math.sin(ph*7)*50+Math.cos(ph*5)*25+Math.sin(ph*11)*20+Math.cos(ph*15)*15+Math.sin(ph*9)*12;
                break;
            case 'canyon':
                ty = h-60+Math.sin(ph*2)*25+Math.sin(ph*4)*45+Math.cos(ph*7)*35+Math.sin(ph*9)*20+Math.cos(ph*14)*15+Math.sin(ph*6)*28+Math.cos(ph*11)*10;
                cy = 55+Math.sin(ph*3)*30+Math.sin(ph*6)*25+Math.cos(ph*10)*20+Math.sin(ph*8)*22+Math.cos(ph*13)*12+Math.sin(ph*16)*8;
                break;
            case 'asteroid':
                ty = h-50+Math.sin(ph*3)*30+Math.sin(ph*7)*25+Math.cos(ph*5)*35+Math.sin(ph*11)*20+Math.cos(ph*9)*15+Math.sin(ph*16)*10+Math.cos(ph*13)*12;
                cy = 45+Math.sin(ph*4)*20+Math.sin(ph*8)*30+Math.cos(ph*12)*18+Math.sin(ph*6)*15+Math.cos(ph*14)*12+Math.sin(ph*10)*10;
                break;
            case 'fortress':
                ty = h-70+Math.sin(ph*2)*20+Math.sin(ph*6)*50+Math.cos(ph*4)*30+Math.sin(ph*10)*25+Math.cos(ph*8)*20+Math.sin(ph*14)*12+Math.cos(ph*12)*15;
                cy = 60+Math.sin(ph*3)*25+Math.sin(ph*7)*35+Math.cos(ph*5)*20+Math.sin(ph*11)*22+Math.cos(ph*9)*15+Math.sin(ph*15)*8;
                break;
            case 'tunnels':
                ty = h-65+Math.sin(ph*2)*25+Math.sin(ph*5)*45+Math.cos(ph*3)*30+Math.sin(ph*9)*20+Math.cos(ph*7)*18+Math.sin(ph*12)*22+Math.cos(ph*15)*10;
                cy = 70+Math.sin(ph*3)*30+Math.sin(ph*6)*45+Math.cos(ph*4)*20+Math.sin(ph*10)*25+Math.cos(ph*13)*15+Math.sin(ph*8)*18;
                break;
            case 'arena':
                ty = h-40+Math.sin(ph*2)*8+Math.sin(ph*4)*5;
                cy = 40+Math.sin(ph*3)*6+Math.sin(ph*5)*4;
                break;
        }
        t.push({ x, y: ty });
        c.push({ x, y: cy });
    }

    const MIN_GAP = key === 'tunnels' ? 100 : key === 'arena' ? 300 : 140;
    for (let i = 0; i <= seg; i++) {
        if (t[i].y - c[i].y < MIN_GAP) {
            const mid = (t[i].y + c[i].y) / 2;
            t[i].y = mid + MIN_GAP / 2;
            c[i].y = mid - MIN_GAP / 2;
        }
        if (t[i].y > h - 10) t[i].y = h - 10;
        if (c[i].y < 10) c[i].y = 10;
    }

    const numLZ = 5 + Math.floor(srand() * 3);
    const lzSpacing = Math.floor(seg / (numLZ + 1));
    for (let z = 0; z < numLZ; z++) {
        const center = lzSpacing * (z + 1) + Math.floor((srand() - 0.5) * lzSpacing * 0.5);
        const span = 2 + Math.floor(srand() * 2);
        const ci = Math.max(1, Math.min(seg - span, center));
        const avgY = t[ci].y;
        for (let j = ci; j <= ci + span && j <= seg; j++) t[j].y = avgY;
    }

    switch (key) {
        case 'caves':
            for (let i = 0; i < 10; i++) p.push({ x: w * .05 + srand() * w * .9, y: h * .15 + srand() * h * .55, width: 40 + srand() * 60, height: 8 });
            p.push({ x: w * .25, y: h * .25, width: 14, height: h * .18 });
            p.push({ x: w * .45, y: h * .30, width: 14, height: h * .22 });
            p.push({ x: w * .65, y: h * .20, width: 12, height: h * .20 });
            p.push({ x: w * .80, y: h * .28, width: 14, height: h * .15 });
            break;
        case 'canyon':
            for (let j = 0; j < 7; j++) {
                p.push({ x: 10, y: h * .10 + j * h * .12, width: 50 + srand() * 60, height: 7 });
                p.push({ x: w - 70 - srand() * 50, y: h * .07 + j * h * .12 + 40, width: 50 + srand() * 60, height: 7 });
            }
            p.push({ x: w * .30, y: h * .25, width: 100, height: 7 });
            p.push({ x: w * .50, y: h * .45, width: 120, height: 7 });
            p.push({ x: w * .35, y: h * .65, width: 90, height: 7 });
            p.push({ x: w * .60, y: h * .35, width: 80, height: 7 });
            break;
        case 'asteroid':
            for (let i = 0; i < 18; i++) p.push({ x: w * .06 + srand() * w * .88, y: h * .08 + srand() * h * .75, width: 25 + srand() * 65, height: 5 + srand() * 5 });
            break;
        case 'fortress':
            p.push({ x: w * .12, y: h * .12, width: 14, height: h * .55 });
            p.push({ x: w * .04, y: h * .12, width: w * .08 + 14, height: 10 });
            p.push({ x: w * .04, y: h * .40, width: w * .08 + 14, height: 10 });
            p.push({ x: w * .04, y: h * .65, width: w * .08 + 14, height: 10 });
            p.push({ x: w * .84, y: h * .12, width: 14, height: h * .55 });
            p.push({ x: w * .84, y: h * .12, width: w * .12, height: 10 });
            p.push({ x: w * .84, y: h * .40, width: w * .12, height: 10 });
            p.push({ x: w * .84, y: h * .65, width: w * .12, height: 10 });
            p.push({ x: w * .30, y: h * .22, width: 120, height: 8 });
            p.push({ x: w * .50, y: h * .45, width: 100, height: 8 });
            p.push({ x: w * .38, y: h * .60, width: 110, height: 8 });
            p.push({ x: w * .60, y: h * .30, width: 90, height: 8 });
            for (let i = 0; i < 6; i++) p.push({ x: w * .20 + srand() * w * .60, y: h * .15 + srand() * h * .55, width: 40 + srand() * 50, height: 7 });
            break;
        case 'tunnels':
            p.push({ x: w * .08, y: h * .25, width: w * .38, height: 8 });
            p.push({ x: w * .54, y: h * .25, width: w * .38, height: 8 });
            p.push({ x: w * .12, y: h * .50, width: w * .32, height: 8 });
            p.push({ x: w * .56, y: h * .50, width: w * .36, height: 8 });
            p.push({ x: w * .10, y: h * .75, width: w * .35, height: 8 });
            p.push({ x: w * .55, y: h * .75, width: w * .35, height: 8 });
            p.push({ x: w * .25, y: h * .06, width: 12, height: h * .17 });
            p.push({ x: w * .50, y: h * .27, width: 12, height: h * .20 });
            p.push({ x: w * .72, y: h * .06, width: 12, height: h * .17 });
            p.push({ x: w * .35, y: h * .52, width: 12, height: h * .20 });
            p.push({ x: w * .80, y: h * .52, width: 12, height: h * .20 });
            break;
        case 'arena':
            break;
    }

    const st = [];
    const starCount = Math.round(w * h / 5000);
    for (let i = 0; i < starCount; i++) st.push({ x: Math.random() * w, y: Math.random() * h, sz: Math.random() * 2 + .5, br: Math.random() * .5 + .3, tw: Math.random() * Math.PI * 2 });
    return { terrain: t, ceiling: c, platforms: p, stars: st, worldW: w, worldH: h };
}

function computeSpawns(numPlayers, wW, wH, terr) {
    const spawns = [], bases = [];
    for (let i = 0; i < numPlayers; i++) {
        const pct = numPlayers === 1 ? 0.5 : 0.08 + 0.84 * i / (numPlayers - 1);
        const x = wW * pct;
        const si = getTerrainYAt(x, terr);
        const surfY = si ? si.y : wH * 0.8;
        bases.push({ x: x - BASE_W / 2, y: surfY - BASE_H - 8, w: BASE_W, h: BASE_H });
        spawns.push({ x, y: surfY - BASE_H - 70 });
    }
    return { spawns, bases };
}

// =====================================================
// ROOM CLASS
// =====================================================
const rooms = new Map();
const wsRoomMap = new Map(); // ws → room code

class Room {
    constructor(code, mapKey, creatorWs, creatorName, isPublic) {
        this.code = code;
        this.mapKey = mapKey;
        this.isPublic = !!isPublic;
        this.lobbyPlayers = [{ ws: creatorWs, name: creatorName, index: 0, color: COLORS[0], ready: false }];
        this.creatorWs = creatorWs;
        this.running = false;
        this.autoTimer = null; // 60s countdown interval
        this.autoCountdown = -1; // seconds remaining (-1 = not started)
        this.gameLoop = null;
        this.frame = 0;
        this.worldW = 0;
        this.worldH = 0;
        this.mapGrav = G;
        this.terrain = [];
        this.ceiling = [];
        this.platforms = [];
        this.stars = [];
        this.players = [];
        this.bullets = [];
        this.beams = [];
        this.pickups = [];
        this.baseExps = [];
        this.playerInputs = [];
        this.playerDeaths = [];
        this.ending = false;
    }

    addPlayer(ws, name) {
        if (this.lobbyPlayers.length >= 8) return -1;
        const idx = this.lobbyPlayers.length;
        this.lobbyPlayers.push({ ws, name, index: idx, color: COLORS[idx], ready: false });
        this.checkAutoCountdown();
        return idx;
    }

    toggleReady(ws) {
        const p = this.lobbyPlayers.find(p => p.ws === ws);
        if (!p || this.running) return;
        p.ready = !p.ready;
        this.broadcastLobby();
        this.checkAutoCountdown();
    }

    checkAutoCountdown() {
        if (this.running) return;
        const count = this.lobbyPlayers.length;
        if (count < 2) {
            // Cancel any running timer
            if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; this.autoCountdown = -1; }
            this.broadcastLobby();
            return;
        }
        // Check if all players are ready
        const allReady = this.lobbyPlayers.every(p => p.ready);
        if (allReady && count >= 2) {
            if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
            this.autoCountdown = -1;
            this.startGame();
            return;
        }
        // For public rooms, start 60s auto-countdown when 2+ players
        if (this.isPublic && !this.autoTimer) {
            this.autoCountdown = 60;
            this.broadcastLobby();
            this.autoTimer = setInterval(() => {
                this.autoCountdown--;
                if (this.autoCountdown <= 0) {
                    clearInterval(this.autoTimer); this.autoTimer = null;
                    if (this.lobbyPlayers.length >= 2 && !this.running) this.startGame();
                } else {
                    this.broadcastLobby();
                }
            }, 1000);
        }
    }

    removePlayer(ws) {
        const idx = this.lobbyPlayers.findIndex(p => p.ws === ws);
        if (idx < 0) return;

        if (this.running && this.players[idx]) {
            this.players[idx].alive = false;
            this.players[idx].lives = 0;
            this.players[idx].disconnected = true;
            this.checkGameEnd();
        }

        // If creator leaves, destroy room
        if (ws === this.creatorWs || this.lobbyPlayers.length <= 1) {
            this.destroy();
            return;
        }

        if (!this.running) {
            this.lobbyPlayers.splice(idx, 1);
            this.lobbyPlayers.forEach((p, i) => { p.index = i; p.color = COLORS[i]; });
            this.checkAutoCountdown();
            this.broadcastLobby();
        }
    }

    broadcastLobby() {
        const lobbyData = this.lobbyPlayers.map(p => ({ name: p.name, color: p.color, index: p.index, ready: p.ready }));
        for (const p of this.lobbyPlayers) {
            this.sendTo(p.ws, {
                t: 'lobby',
                players: lobbyData,
                you: p.index,
                map: this.mapKey,
                code: this.code,
                isCreator: p.ws === this.creatorWs,
                isPublic: this.isPublic,
                autoCountdown: this.autoCountdown
            });
        }
    }

    broadcast(data) {
        const msg = JSON.stringify(data);
        for (const p of this.lobbyPlayers) {
            if (p.ws.readyState === WebSocket.OPEN) {
                try { p.ws.send(msg); } catch (e) { }
            }
        }
    }

    sendTo(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify(data)); } catch (e) { }
        }
    }

    startGame() {
        if (this.running || this.lobbyPlayers.length < 2) return;
        if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; this.autoCountdown = -1; }
        let c = 3;
        this.broadcast({ t: 'countdown', v: c });
        const iv = setInterval(() => {
            c--;
            if (c > 0) {
                this.broadcast({ t: 'countdown', v: c });
            } else {
                clearInterval(iv);
                this.broadcast({ t: 'countdown', v: 'GO!' });
                setTimeout(() => this.beginGame(), 600);
            }
        }, 1000);
    }

    beginGame() {
        const mapData = generateMap(this.mapKey);
        const sb = computeSpawns(this.lobbyPlayers.length, mapData.worldW, mapData.worldH, mapData.terrain);

        this.worldW = mapData.worldW;
        this.worldH = mapData.worldH;
        this.mapGrav = MAPS[this.mapKey]?.gravity || G;
        this.terrain = mapData.terrain;
        this.ceiling = mapData.ceiling;
        this.platforms = mapData.platforms;
        this.stars = mapData.stars;
        this.frame = 0;
        this.ending = false;

        this.players = [];
        this.playerInputs = [];
        for (let i = 0; i < this.lobbyPlayers.length; i++) {
            const bs = sb.bases[i];
            this.players.push({
                id: i,
                x: bs.x + (bs.w || BASE_W) / 2,
                y: bs.y - SHIP_SZ,
                vx: 0, vy: 0,
                angle: -Math.PI / 2,
                lives: LIVES, alive: true, respawnT: 0, invT: 0, score: 0,
                color: COLORS[i], name: this.lobbyPlayers[i].name,
                spawnX: bs.x + (bs.w || BASE_W) / 2,
                spawnY: bs.y - SHIP_SZ,
                base: { x: bs.x, y: bs.y, w: bs.w || BASE_W, h: bs.h || BASE_H },
                landed: true, landedTimer: 120,
                disconnected: false,
                weapon: 'normal', shield: 1,
                streak: 0, lastKillFrame: -999,
                thrusting: false, revThrusting: false, firing: false, fireCd: 0
            });
            this.playerInputs.push({ rot: 0, thrust: false, revThrust: false, fire: false });
        }

        this.bullets = [];
        this.beams = [];
        this.pickups = [];
        this.baseExps = [];
        this.playerDeaths = new Array(this.lobbyPlayers.length).fill(0);

        // Send start data to all clients
        const startData = {
            t: 'start',
            map: this.mapKey,
            terrain: mapData.terrain,
            ceiling: mapData.ceiling,
            platforms: mapData.platforms,
            stars: mapData.stars,
            worldW: mapData.worldW,
            worldH: mapData.worldH,
            spawns: sb.spawns,
            bases: sb.bases,
            players: this.lobbyPlayers.map(p => ({ name: p.name, color: p.color, index: p.index }))
        };
        this.broadcast(startData);

        this.running = true;
        this.gameLoop = setInterval(() => {
            try { this.update(); } catch (e) { console.error('Game loop error:', e); }
        }, 1000 / 60);
    }

    // === MAIN GAME TICK ===
    update() {
        this.frame++;

        for (let pi = 0; pi < this.players.length; pi++) {
            const p = this.players[pi];
            if (p.disconnected) continue;
            if (!p.alive) {
                p.respawnT--;
                if (p.respawnT <= 0 && p.lives > 0) this.respawnPlayer(p);
                continue;
            }
            const inp = this.playerInputs[pi] || { rot: 0, thrust: false, revThrust: false, fire: false };

            if (p.landed) {
                if (inp.thrust || inp.revThrust) p.landed = false;
                p.angle += inp.rot * ROT_SPD_MAX;
                if (p.landed) {
                    p.vy = 0; p.vx *= 0.92;
                    if (inp.fire && p.fireCd <= 0) this.fireBullets(p, pi);
                    if (p.fireCd > 0) p.fireCd--;
                    if (p.invT > 0) p.invT--;
                    continue;
                }
            }

            p.angle += inp.rot * ROT_SPD_MAX;
            p.thrusting = inp.thrust;
            p.revThrusting = inp.revThrust;
            p.firing = inp.fire;

            if (p.thrusting) {
                p.vx += Math.cos(p.angle) * THRUST;
                p.vy += Math.sin(p.angle) * THRUST;
            }
            if (p.revThrusting) {
                p.vx -= Math.cos(p.angle) * REV_THRUST;
                p.vy -= Math.sin(p.angle) * REV_THRUST;
            }

            p.vy += this.mapGrav;
            p.vx *= 0.997; p.vy *= 0.997;

            const spd = Math.sqrt(p.vx ** 2 + p.vy ** 2);
            if (spd > MAX_SPD) { p.vx *= MAX_SPD / spd; p.vy *= MAX_SPD / spd; }
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x += this.worldW;
            if (p.x > this.worldW) p.x -= this.worldW;
            if (p.invT > 0) p.invT--;
            if (p.fireCd > 0) p.fireCd--;

            if (p.firing && p.fireCd <= 0) this.fireBullets(p, pi);

            const col = this.shipCollision(p);
            if (col) {
                if (col.type === 'land') this.landShip(p, col.surfY);
                else this.killPlayer(p);
            }

            // Ship-to-ship collision — both ships take damage
            if (p.alive) {
                for (let oi = pi + 1; oi < this.players.length; oi++) {
                    const op = this.players[oi];
                    if (!op.alive || op.invT > 0 || op.landed) continue;
                    if (dist(p.x, p.y, op.x, op.y, this.worldW) < SHIP_SZ * 2) {
                        this.emitEvent({ t: 'e', n: 'shipCollide', x1: p.x, y1: p.y, x2: op.x, y2: op.y });
                        this.killPlayer(p);
                        this.killPlayer(op);
                        break;
                    }
                }
            }

            // Base collisions (THE BUG)
            if (p.alive) {
                for (let oi = 0; oi < this.players.length; oi++) {
                    if (oi === pi) continue;
                    const ob = this.players[oi].base;
                    if (ptInRect(p.x, p.y, ob.x, ob.y, ob.w, ob.h)) {
                        this.baseExps.push({ x: ob.x + ob.w / 2, y: ob.y + ob.h / 2, r: BASE_EXP_R, dur: BASE_EXP_DUR, t: 0, owner: oi, phase: 0 });
                        this.emitEvent({ t: 'e', n: 'baseExp', x: ob.x + ob.w / 2, y: ob.y + ob.h / 2, o: oi });
                        this.killPlayer(p, true);
                        break;
                    }
                }
            }
        }

        // === BULLETS ===
        const gBul = this.mapGrav * 0.15;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx; b.y += b.vy; b.vy += gBul; b.life--;
            if (b.life <= 0 || b.y < 0 || b.y > this.worldH) { this.bullets.splice(i, 1); continue; }
            if (b.x < 0) b.x += this.worldW;
            if (b.x > this.worldW) b.x -= this.worldW;

            // Homing
            if (b.homing) {
                let nearest = null, nearD = Infinity;
                for (const p of this.players) {
                    if (p.id === b.owner || !p.alive) continue;
                    const d = dist(b.x, b.y, p.x, p.y, this.worldW);
                    if (d < nearD) { nearD = d; nearest = p; }
                }
                if (nearest && nearD < 500) {
                    let hdx = nearest.x - b.x;
                    if (hdx > this.worldW / 2) hdx -= this.worldW;
                    if (hdx < -this.worldW / 2) hdx += this.worldW;
                    const hdy = nearest.y - b.y, ta = Math.atan2(hdy, hdx), ca = Math.atan2(b.vy, b.vx);
                    let ad = ta - ca; while (ad > Math.PI) ad -= Math.PI * 2; while (ad < -Math.PI) ad += Math.PI * 2;
                    const na = ca + ad * 0.06, sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                    b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
                }
            }

            // Hit detection
            let hit = false;
            for (const p of this.players) {
                const hitR = SHIP_SZ + (b.sz || 2.5);
                if (p.id !== b.owner && p.alive && p.invT <= 0 && dist(b.x, b.y, p.x, p.y, this.worldW) < hitR) {
                    this.killPlayer(p);
                    if (!p.alive) this.awardKill(this.players[b.owner]);
                    if (b.pierce && b.pierce > 0) { b.pierce--; } else { this.bullets.splice(i, 1); hit = true; }
                    break;
                }
            }
            if (hit) continue;

            // Terrain/platform collision
            const bt = getTerrainYAt(b.x, this.terrain);
            if (bt && b.y > bt.y) { this.bullets.splice(i, 1); continue; }
            const ct = getTerrainYAt(b.x, this.ceiling);
            if (ct && b.y < ct.y) { this.bullets.splice(i, 1); continue; }
            for (const pl of this.platforms) {
                if (ptInRect(b.x, b.y, pl.x, pl.y, pl.width, pl.height)) { this.bullets.splice(i, 1); break; }
            }
        }

        // === LASER BEAMS ===
        for (let i = this.beams.length - 1; i >= 0; i--) {
            const bm = this.beams[i]; bm.life--;
            if (bm.life <= 0) { this.beams.splice(i, 1); continue; }
            const p = this.players[bm.owner];
            if (!p || !p.alive) { this.beams.splice(i, 1); continue; }
            bm.x = p.x; bm.y = p.y; bm.angle = p.angle;

            let endDist = BEAM_RANGE;
            const step = 8;
            for (let d = SHIP_SZ * 2; d < BEAM_RANGE; d += step) {
                const tx = bm.x + Math.cos(bm.angle) * d, ty = bm.y + Math.sin(bm.angle) * d;
                const wx = ((tx % this.worldW) + this.worldW) % this.worldW;
                if (ty < 0 || ty > this.worldH) { endDist = d; break; }
                const bt = getTerrainYAt(wx, this.terrain); if (bt && ty > bt.y) { endDist = d; break; }
                const ct2 = getTerrainYAt(wx, this.ceiling); if (ct2 && ty < ct2.y) { endDist = d; break; }
                let platHit = false;
                for (const pl of this.platforms) { if (ptInRect(wx, ty, pl.x, pl.y, pl.width, pl.height)) { platHit = true; break; } }
                if (platHit) { endDist = d; break; }
            }
            bm.endDist = endDist;

            if (bm.hitCd > 0) { bm.hitCd--; } else {
                for (const pl of this.players) {
                    if (pl.id === bm.owner || !pl.alive || pl.invT > 0) continue;
                    for (let d = SHIP_SZ * 2; d < endDist; d += step) {
                        const tx = bm.x + Math.cos(bm.angle) * d, ty = bm.y + Math.sin(bm.angle) * d;
                        if (dist(tx, ty, pl.x, pl.y, this.worldW) < SHIP_SZ + 4) {
                            this.killPlayer(pl);
                            if (!pl.alive) this.awardKill(this.players[bm.owner]);
                            bm.hitCd = BEAM_HIT_INTERVAL;
                            break;
                        }
                    }
                }
            }
        }

        // === BASE EXPLOSIONS ===
        for (let i = this.baseExps.length - 1; i >= 0; i--) {
            const be = this.baseExps[i]; be.t++; be.phase += 0.1;
            for (const p of this.players) {
                if (!p.alive || p.id !== be.owner) continue;
                if (be.t < be.dur && dist(p.x, p.y, be.x, be.y, this.worldW) < RESPAWN_KILL_R) {
                    p.invT = 0;
                    this.killPlayer(p, true);
                }
            }
            if (be.t >= be.dur) this.baseExps.splice(i, 1);
        }

        // === PICKUPS ===
        if (this.frame % PICKUP_SPAWN_INTERVAL === 0 && this.pickups.length < PICKUP_MAX) {
            this.spawnPickup();
        }
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pk = this.pickups[i];
            pk.bobPhase = (pk.bobPhase || 0) + 0.05;
            for (const p of this.players) {
                if (!p.alive) continue;
                if (dist(p.x, p.y, pk.x, pk.y, this.worldW) < PICKUP_R + SHIP_SZ) {
                    this.applyPickup(p, pk.type);
                    this.pickups.splice(i, 1);
                    break;
                }
            }
        }

        // === BROADCAST STATE ===
        if (this.frame % STATE_INTERVAL === 0) {
            this.broadcast({
                t: 's',
                f: this.frame,
                p: this.players.map(p => ({
                    x: rd(p.x), y: rd(p.y), vx: rd(p.vx), vy: rd(p.vy), a: rdA(p.angle),
                    al: p.alive, l: p.lives, s: p.score, iv: p.invT > 0,
                    th: p.thrusting, rv: p.revThrusting, la: p.landed, fi: p.firing,
                    rT: p.respawnT, wp: p.weapon, sh: p.shield
                })),
                b: this.bullets.map(b => ({
                    x: rd(b.x), y: rd(b.y), vx: rd(b.vx), vy: rd(b.vy),
                    o: b.owner, c: b.color, sz: b.sz || 2.5
                })),
                bm: this.beams.map(bm => ({
                    x: rd(bm.x), y: rd(bm.y), a: rdA(bm.angle), o: bm.owner,
                    c: bm.color, ed: rd(bm.endDist || BEAM_RANGE), l: bm.life, ml: bm.maxLife
                })),
                be: this.baseExps.map(e => ({
                    x: rd(e.x), y: rd(e.y), t: e.t, d: e.dur, o: e.owner, p: rd(e.phase)
                })),
                pk: this.pickups.map(pk => ({
                    x: rd(pk.x), y: rd(pk.y), tp: pk.type, bp: rd(pk.bobPhase || 0)
                }))
            });
        }
    }

    // === SHIP COLLISION ===
    shipCollision(p) {
        const ob = p.base;
        if (p.x > ob.x - 3 && p.x < ob.x + ob.w + 3 && p.y + SHIP_SZ > ob.y && p.y + SHIP_SZ < ob.y + ob.h + 14 && p.vy >= 0) {
            return { type: 'land', surfY: ob.y };
        }
        const bt = getTerrainYAt(p.x, this.terrain);
        if (bt && p.y + SHIP_SZ - 2 > bt.y) {
            if (canLand(p, bt)) return { type: 'land', surfY: bt.y };
            return { type: 'crash' };
        }
        const ct = getTerrainYAt(p.x, this.ceiling);
        if (ct && p.y - SHIP_SZ + 2 < ct.y) return { type: 'crash' };
        for (const pl of this.platforms) {
            if (p.x > pl.x - 3 && p.x < pl.x + pl.width + 3 && p.y + SHIP_SZ - 2 > pl.y && p.y + SHIP_SZ - 2 < pl.y + pl.height + 14 && p.vy >= 0) {
                if (canLand(p, { y: pl.y, slope: 0 })) return { type: 'land', surfY: pl.y };
                return { type: 'crash' };
            }
            if (ptInRect(p.x, p.y, pl.x - 3, pl.y - 2, pl.width + 6, pl.height + 4)) return { type: 'crash' };
        }
        if (p.y < 5 || p.y > this.worldH - 5) return { type: 'crash' };
        return null;
    }

    landShip(p, surfY) {
        p.y = surfY - SHIP_SZ; p.vx *= 0.7; p.vy = 0; p.landed = true; p.landedTimer = 60;
        this.emitEvent({ t: 'e', n: 'land', i: p.id, x: p.x, y: p.y });
    }

    fireBullets(p, pi) {
        const a = p.angle, bx = p.x + Math.cos(a) * SHIP_SZ * 1.5, by = p.y + Math.sin(a) * SHIP_SZ * 1.5;
        const vbx = p.vx * .3, vby = p.vy * .3;
        switch (p.weapon) {
            case 'spread':
                for (const off of [-0.3, -0.15, 0, 0.15, 0.3]) {
                    const sa = a + off;
                    this.bullets.push({ x: bx, y: by, vx: Math.cos(sa) * BULLET_SPD * 1.05 + vbx, vy: Math.sin(sa) * BULLET_SPD * 1.05 + vby, owner: pi, life: BULLET_LIFE * 0.8, color: p.color, sz: 2.5 });
                }
                p.fireCd = FIRE_CD; break;
            case 'rapid':
                this.bullets.push({ x: bx + Math.cos(a + Math.PI / 2) * 3, y: by + Math.sin(a + Math.PI / 2) * 3, vx: Math.cos(a) * BULLET_SPD * 1.15 + vbx, vy: Math.sin(a) * BULLET_SPD * 1.15 + vby, owner: pi, life: BULLET_LIFE, color: p.color, sz: 2 });
                this.bullets.push({ x: bx + Math.cos(a - Math.PI / 2) * 3, y: by + Math.sin(a - Math.PI / 2) * 3, vx: Math.cos(a) * BULLET_SPD * 1.15 + vbx, vy: Math.sin(a) * BULLET_SPD * 1.15 + vby, owner: pi, life: BULLET_LIFE, color: p.color, sz: 2 });
                p.fireCd = Math.floor(FIRE_CD * 0.4); break;
            case 'heavy':
                this.bullets.push({ x: bx, y: by, vx: Math.cos(a) * BULLET_SPD * 0.9 + vbx, vy: Math.sin(a) * BULLET_SPD * 0.9 + vby, owner: pi, life: Math.floor(BULLET_LIFE * 1.5), color: p.color, sz: 7, heavy: true, pierce: 1 });
                p.fireCd = Math.floor(FIRE_CD * 1.2); break;
            case 'laser':
                this.beams.push({ x: p.x, y: p.y, angle: a, owner: pi, life: BEAM_DUR, maxLife: BEAM_DUR, color: p.color, hitCd: 0 });
                p.fireCd = BEAM_DUR + BEAM_CD;
                this.emitEvent({ t: 'e', n: 'laser', x: p.x, y: p.y });
                return;
            case 'burst':
                for (let n = 0; n < 7; n++) {
                    const j = (Math.random() - 0.5) * 0.12;
                    this.bullets.push({ x: bx, y: by, vx: Math.cos(a + j) * BULLET_SPD * 1.05 + vbx, vy: Math.sin(a + j) * BULLET_SPD * 1.05 + vby, owner: pi, life: Math.floor(BULLET_LIFE * 0.8), color: p.color, sz: 2.5 });
                }
                p.fireCd = Math.floor(FIRE_CD * 1.3); break;
            case 'homing':
                this.bullets.push({ x: bx, y: by, vx: Math.cos(a) * BULLET_SPD * 0.9 + vbx, vy: Math.sin(a) * BULLET_SPD * 0.9 + vby, owner: pi, life: Math.floor(BULLET_LIFE * 1.5), color: p.color, sz: 3.5, homing: true });
                p.fireCd = Math.floor(FIRE_CD * 1.1); break;
            default:
                this.bullets.push({ x: bx, y: by, vx: Math.cos(a) * BULLET_SPD + vbx, vy: Math.sin(a) * BULLET_SPD + vby, owner: pi, life: BULLET_LIFE, color: p.color, sz: 2.5 });
                p.fireCd = FIRE_CD;
        }
        this.emitEvent({ t: 'e', n: 'shoot', x: bx, y: by });
    }

    killPlayer(p, force) {
        if (!p.alive || p.invT > 0) return;
        if (p.shield > 0 && !force) {
            p.shield--;
            p.invT = 30;
            this.emitEvent({ t: 'e', n: 'shieldHit', x: p.x, y: p.y });
            return;
        }
        p.alive = false; p.lives--; p.respawnT = RESPAWN_T; p.vx = 0; p.vy = 0; p.landed = false;
        if (this.playerDeaths[p.id] !== undefined) this.playerDeaths[p.id]++;
        p.weapon = 'normal'; p.shield = 0;
        this.emitEvent({ t: 'e', n: 'kill', i: p.id, x: p.x, y: p.y });
        this.checkGameEnd();
    }

    awardKill(killer) {
        if (!killer) return;
        killer.score++;
        if (this.frame - killer.lastKillFrame < STREAK_WINDOW) {
            killer.streak++;
        } else {
            killer.streak = 1;
        }
        killer.lastKillFrame = this.frame;
        if (killer.streak >= 2) {
            const sn = STREAK_NAMES[Math.min(killer.streak, STREAK_NAMES.length - 1)];
            this.emitEvent({ t: 'e', n: 'streak', i: killer.id, x: killer.x, y: killer.y, sn: sn, sk: killer.streak });
        }
    }

    respawnPlayer(p) {
        p.x = p.spawnX; p.y = p.spawnY; p.vx = 0; p.vy = 0; p.angle = -Math.PI / 2;
        p.alive = true; p.invT = INVINCE_T; p.landed = true; p.landedTimer = 60;
        p.shield = 1;
        for (const be of this.baseExps) {
            if (be.owner === p.id && be.t < be.dur && dist(p.x, p.y, be.x, be.y, this.worldW) < RESPAWN_KILL_R) {
                p.alive = false; p.lives--; p.respawnT = Math.floor(RESPAWN_T / 2); p.shield = 0;
                this.emitEvent({ t: 'e', n: 'bugKill', i: p.id, x: p.x, y: p.y });
                this.checkGameEnd();
                return;
            }
        }
    }

    checkGameEnd() {
        if (this.ending) return;
        if (this.players.length <= 1) return;
        const alive = this.players.filter(p => p.lives > 0 && !p.disconnected);
        if (alive.length <= 1) {
            this.ending = true;
            const winner = alive.length === 1 ? alive[0].name + ' WINS!' : 'DRAW!';
            const stats = this.players.map((p, i) => ({
                name: p.name, color: p.color, kills: p.score, deaths: this.playerDeaths[i] || 0, lives: p.lives
            }));
            setTimeout(() => {
                this.broadcast({ t: 'over', w: winner, stats: stats });
                this.stopGame();
            }, 1000);
        }
    }

    spawnPickup() {
        for (let attempt = 0; attempt < 20; attempt++) {
            const x = 50 + Math.random() * (this.worldW - 100);
            const ti = getTerrainYAt(x, this.terrain);
            const ci = getTerrainYAt(x, this.ceiling);
            if (!ti || !ci) continue;
            let placed = false;
            if (Math.random() < 0.5) {
                for (const pl of this.platforms) {
                    if (x > pl.x && x < pl.x + pl.width) {
                        const py = pl.y - PICKUP_R - 5;
                        if (py > ci.y + 20 && py < ti.y - 20) {
                            this.pickups.push({ x, y: py, type: randomPickupType(), bobPhase: Math.random() * Math.PI * 2 });
                            placed = true; break;
                        }
                    }
                }
            }
            if (placed) return;
            const minY = ci.y + 40, maxY = ti.y - 40;
            if (maxY - minY < 60) continue;
            const y = minY + Math.random() * (maxY - minY);
            let tooClose = false;
            for (const p of this.players) {
                if (dist(x, y, p.base.x + p.base.w / 2, p.base.y, this.worldW) < 80) { tooClose = true; break; }
            }
            if (tooClose) continue;
            this.pickups.push({ x, y, type: randomPickupType(), bobPhase: Math.random() * Math.PI * 2 });
            return;
        }
    }

    applyPickup(p, type) {
        if (type === 'heart') { p.lives = (p.lives || 0) + 1; }
        else if (type === 'shield') { p.shield = (p.shield || 0) + 1; }
        else { p.weapon = type; }
        this.emitEvent({ t: 'e', n: 'pickup', i: p.id, x: p.x, y: p.y });
    }

    emitEvent(evt) { this.broadcast(evt); }

    stopGame() {
        this.running = false;
        if (this.gameLoop) { clearInterval(this.gameLoop); this.gameLoop = null; }
    }

    rematch() {
        this.stopGame();
        this.startGame();
    }

    destroy() {
        if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
        this.stopGame();
        for (const p of this.lobbyPlayers) {
            this.sendTo(p.ws, { t: 'over', w: 'Room closed', stats: null });
        }
        rooms.delete(this.code);
        console.log(`Room ${this.code} destroyed`);
    }
}

// =====================================================
// HTTP SERVER — serve static files
// =====================================================
const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0]; // strip query string
    if (url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        return;
    }
    // Serve index.html for root and any other path (single-page app)
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error('Failed to read index.html:', err.message);
            res.writeHead(500);
            res.end('Server error');
        } else {
            res.writeHead(200, {
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache'
            });
            res.end(data);
        }
    });
});

// =====================================================
// WEBSOCKET SERVER
// =====================================================
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
        let data;
        try { data = JSON.parse(raw); } catch (e) { return; }

        switch (data.t) {
            case 'create': {
                let code;
                do { code = randomCode(); } while (rooms.has(code));
                const isPublic = !!data.pub;
                const room = new Room(code, data.map, ws, data.name || 'HOST', isPublic);
                rooms.set(code, room);
                wsRoomMap.set(ws, code);
                room.broadcastLobby();
                console.log(`Room ${code} created (${data.map}, ${isPublic ? 'public' : 'private'}) — ${rooms.size} active rooms`);
                break;
            }
            case 'join': {
                const code = (data.code || '').toUpperCase();
                const room = rooms.get(code);
                if (!room) { ws.send(JSON.stringify({ t: 'error', msg: 'Room not found' })); return; }
                if (room.running) { ws.send(JSON.stringify({ t: 'error', msg: 'Game already started' })); return; }
                if (room.lobbyPlayers.length >= 8) { ws.send(JSON.stringify({ t: 'error', msg: 'Room is full' })); return; }
                const idx = room.addPlayer(ws, data.name || 'PLAYER');
                if (idx < 0) { ws.send(JSON.stringify({ t: 'error', msg: 'Could not join' })); return; }
                wsRoomMap.set(ws, code);
                room.broadcastLobby();
                console.log(`Player joined ${code} (${room.lobbyPlayers.length} players)`);
                break;
            }
            case 'start': {
                const code = wsRoomMap.get(ws);
                if (!code) return;
                const room = rooms.get(code);
                if (!room || room.creatorWs !== ws) return;
                room.startGame();
                break;
            }
            case 'ready': {
                const code = wsRoomMap.get(ws);
                if (!code) return;
                const room = rooms.get(code);
                if (!room) return;
                room.toggleReady(ws);
                break;
            }
            case 'browse': {
                const publicRooms = [];
                for (const [code, room] of rooms) {
                    if (room.isPublic && !room.running && room.lobbyPlayers.length < 8) {
                        publicRooms.push({
                            code: code,
                            map: room.mapKey,
                            mapName: MAPS[room.mapKey] ? MAPS[room.mapKey].name : room.mapKey,
                            players: room.lobbyPlayers.length,
                            max: 8,
                            host: room.lobbyPlayers[0] ? room.lobbyPlayers[0].name : '?'
                        });
                    }
                }
                ws.send(JSON.stringify({ t: 'browse', rooms: publicRooms }));
                break;
            }
            case 'rematch': {
                const code = wsRoomMap.get(ws);
                if (!code) return;
                const room = rooms.get(code);
                if (!room || room.creatorWs !== ws) return;
                room.rematch();
                break;
            }
            case 'i': {
                const code = wsRoomMap.get(ws);
                if (!code) return;
                const room = rooms.get(code);
                if (!room || !room.running) return;
                const playerIdx = room.lobbyPlayers.findIndex(p => p.ws === ws);
                if (playerIdx >= 0 && room.playerInputs[playerIdx]) {
                    room.playerInputs[playerIdx] = {
                        rot: data.r || 0,
                        thrust: !!data.th,
                        revThrust: !!data.rv,
                        fire: !!data.f
                    };
                }
                break;
            }
            case 'leave': {
                const code = wsRoomMap.get(ws);
                if (!code) return;
                const room = rooms.get(code);
                if (room) room.removePlayer(ws);
                wsRoomMap.delete(ws);
                break;
            }
        }
    });

    ws.on('close', () => {
        const code = wsRoomMap.get(ws);
        if (code) {
            const room = rooms.get(code);
            if (room) room.removePlayer(ws);
            wsRoomMap.delete(ws);
        }
    });

    ws.on('error', () => {
        const code = wsRoomMap.get(ws);
        if (code) {
            const room = rooms.get(code);
            if (room) room.removePlayer(ws);
            wsRoomMap.delete(ws);
        }
    });
});

// =====================================================
// START
// =====================================================
const os = require('os');
function getLanIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) return net.address;
        }
    }
    return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
    const ip = getLanIP();
    console.log(`\n${'='.repeat(48)}`);
    console.log(` GRAVITATION SERVER v2.2`);
    console.log(` Port: ${PORT}`);
    console.log(` Local:   http://localhost:${PORT}`);
    console.log(` Network: http://${ip}:${PORT}`);
    console.log(`${'='.repeat(48)}`);
    console.log(` Share the Network URL with friends on the`);
    console.log(` same Wi-Fi, or use port-forwarding for`);
    console.log(` internet play.`);
    console.log(`${'='.repeat(48)}\n`);
});
