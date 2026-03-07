// Build script — copies web assets into dist/ for Capacitor
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');

function copyRecursive(src, dest) {
    if (fs.statSync(src).isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
            copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Clean and recreate dist
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

// Copy web assets
const files = ['index.html', 'manifest.json', 'sw.js', 'privacy.html', 'terms.html'];
for (const f of files) {
    const src = path.join(__dirname, f);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(DIST, f));
        console.log(`  ${f}`);
    }
}

// Copy icons directory
const iconsDir = path.join(__dirname, 'icons');
if (fs.existsSync(iconsDir)) {
    copyRecursive(iconsDir, path.join(DIST, 'icons'));
    console.log('  icons/');
}

console.log('Build complete → dist/');
