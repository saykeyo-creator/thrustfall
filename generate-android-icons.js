// Copy generated icons into the Android project's mipmap directories
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const BG_COLOR = '#0a0a1a';
const SHIP_COLOR = '#00eeff';
const THRUST_COLOR_1 = '#ff6600';
const THRUST_COLOR_2 = '#ffcc00';

function drawShip(ctx, cx, cy, sz) {
    ctx.shadowColor = SHIP_COLOR;
    ctx.shadowBlur = sz * 0.6;
    // Thrust flame
    ctx.beginPath();
    ctx.moveTo(cx - sz * 0.35, cy + sz * 0.3);
    ctx.lineTo(cx, cy + sz * 1.1);
    ctx.lineTo(cx + sz * 0.35, cy + sz * 0.3);
    ctx.closePath();
    const thrustGrad = ctx.createLinearGradient(cx, cy + sz * 0.3, cx, cy + sz * 1.1);
    thrustGrad.addColorStop(0, THRUST_COLOR_2);
    thrustGrad.addColorStop(0.5, THRUST_COLOR_1);
    thrustGrad.addColorStop(1, 'rgba(255, 102, 0, 0)');
    ctx.fillStyle = thrustGrad;
    ctx.fill();
    // Ship body
    ctx.beginPath();
    ctx.moveTo(cx, cy - sz);
    ctx.lineTo(cx - sz * 0.7, cy + sz * 0.7);
    ctx.lineTo(cx, cy + sz * 0.3);
    ctx.lineTo(cx + sz * 0.7, cy + sz * 0.7);
    ctx.closePath();
    ctx.fillStyle = SHIP_COLOR;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, sz * 0.06);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function generateLauncherIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, size, size);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.6);
    grad.addColorStop(0, 'rgba(0, 238, 255, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    drawShip(ctx, size / 2, size * 0.45, size * 0.28);
    return canvas.toBuffer('image/png');
}

function generateRoundIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    // Clip to circle
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, size, size);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
    grad.addColorStop(0, 'rgba(0, 238, 255, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    drawShip(ctx, size / 2, size * 0.45, size * 0.22);
    return canvas.toBuffer('image/png');
}

function generateForeground(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    drawShip(ctx, size / 2, size * 0.45, size * 0.2);
    return canvas.toBuffer('image/png');
}

// Android mipmap density sizes (px)
const densities = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
};

const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

for (const [folder, size] of Object.entries(densities)) {
    const dir = path.join(resDir, folder);
    fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), generateLauncherIcon(size));
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), generateRoundIcon(size));
    // Foreground for adaptive icons (108dp = size * 108/48)
    const fgSize = Math.round(size * 108 / 48);
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), generateForeground(fgSize));

    console.log(`${folder}: ${size}px launcher, ${size}px round, ${fgSize}px foreground`);
}

console.log('\nAndroid icons deployed!');
