// Build script — copies web assets into dist/ for Capacitor
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');

// Read versionName from build.gradle to inject into HTML
function readVersionName() {
    try {
        const gradle = fs.readFileSync(path.join(__dirname, 'android/app/build.gradle'), 'utf8');
        const m = gradle.match(/versionName "([^"]+)"/);
        return m ? 'v' + m[1] : 'v?';
    } catch (e) { return 'v?'; }
}
const VERSION = readVersionName();

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
        if (f === 'index.html') {
            // Inject version string
            const html = fs.readFileSync(src, 'utf8').replace(/__VERSION__/g, VERSION);
            fs.writeFileSync(path.join(DIST, f), html);
        } else {
            fs.copyFileSync(src, path.join(DIST, f));
        }
        console.log(`  ${f} ${f === 'index.html' ? '(' + VERSION + ')' : ''}`);
    }
}

// Copy icons directory
const iconsDir = path.join(__dirname, 'icons');
if (fs.existsSync(iconsDir)) {
    copyRecursive(iconsDir, path.join(DIST, 'icons'));
    console.log('  icons/');
}

console.log('Build complete → dist/');
