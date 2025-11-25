const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID || '__GOOGLE_CLIENT_ID__';

// Read manifest template
let manifest = fs.readFileSync('src/manifest.json', 'utf8');

// Replace placeholder
manifest = manifest.replace(/__GOOGLE_CLIENT_ID__/g, googleClientId);

// Write to dist
fs.writeFileSync('dist/manifest.json', JSON.stringify(JSON.parse(manifest), null, 2));

console.log('✅ Manifest generated with Client ID:', googleClientId.substring(0, 20) + '...');
console.log('📁 Manifest saved to: dist/manifest.json');