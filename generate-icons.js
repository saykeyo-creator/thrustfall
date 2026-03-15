// Generate all app icons for PWA manifest, Android adaptive icons, and Play Store
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const BG_COLOR = '#0a0a1a';
const SHIP_COLOR = '#00eeff';
const THRUST_COLOR_1 = '#ff6600';
const THRUST_COLOR_2 = '#ffcc00';

function drawShip(ctx, cx, cy, sz) {
    // Glow behind ship
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

    // Ship body (default arrowhead)
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

function drawTitle(ctx, cx, cy, fontSize) {
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = SHIP_COLOR;
    ctx.shadowBlur = fontSize * 0.4;
    ctx.fillText('T', cx, cy);
    ctx.shadowBlur = 0;
}

function generateIcon(size, showTitle) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, size, size);

    // Subtle radial gradient overlay
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.6);
    grad.addColorStop(0, 'rgba(0, 238, 255, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Draw ship centered — offset slightly upward if showing title
    const shipSize = size * 0.28;
    const shipY = showTitle ? size * 0.4 : size * 0.45;
    drawShip(ctx, size / 2, shipY, shipSize);

    // "T" lettermark on small icons, or nothing
    if (showTitle && size >= 192) {
        const fontSize = size * 0.12;
        drawTitle(ctx, size / 2, size * 0.78, fontSize);
    }

    return canvas.toBuffer('image/png');
}

function generateAdaptiveForeground(size) {
    // Adaptive icons have safe zone = inner 66% of 108dp
    // We draw on full size but keep content in center ~72%
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Transparent background (foreground layer only)
    ctx.clearRect(0, 0, size, size);

    const shipSize = size * 0.2;
    const shipY = size * 0.45;
    drawShip(ctx, size / 2, shipY, shipSize);

    return canvas.toBuffer('image/png');
}

function generateAdaptiveBackground(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, size, size);

    // Subtle radial glow
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.6);
    grad.addColorStop(0, 'rgba(0, 238, 255, 0.1)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    return canvas.toBuffer('image/png');
}

// Create output directories
const iconsDir = path.join(__dirname, 'icons');
const adaptiveDir = path.join(iconsDir, 'adaptive');
fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(adaptiveDir, { recursive: true });

// PWA manifest icons + Play Store
const sizes = [48, 72, 96, 144, 192, 512];
for (const size of sizes) {
    const buf = generateIcon(size, size >= 192);
    const outPath = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(outPath, buf);
    console.log(`Created ${outPath} (${size}x${size})`);
}

// Android adaptive icon layers (432px = 108dp * 4 for xxxhdpi)
const adaptiveSize = 432;
fs.writeFileSync(path.join(adaptiveDir, 'foreground.png'), generateAdaptiveForeground(adaptiveSize));
console.log(`Created adaptive/foreground.png (${adaptiveSize}x${adaptiveSize})`);
fs.writeFileSync(path.join(adaptiveDir, 'background.png'), generateAdaptiveBackground(adaptiveSize));
console.log(`Created adaptive/background.png (${adaptiveSize}x${adaptiveSize})`);

// Favicon (32x32)
fs.writeFileSync(path.join(iconsDir, 'favicon-32.png'), generateIcon(32, false));
console.log('Created favicon-32.png');

console.log('\nAll icons generated successfully!');
