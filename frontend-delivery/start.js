const qrcode = require('qrcode-terminal');
const os = require('os');
const { spawn } = require('child_process');

// Find the LAN IP
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const ip = getLanIP();
const port = 3002;
const url = `http://${ip}:${port}`;

console.log('\n');
console.log('  🛵 MEDORA Delivery Rider');
console.log('  ========================');
console.log(`  Local:   http://localhost:${port}`);
console.log(`  Network: ${url}`);
console.log('\n  Scan QR code to open on your phone:\n');
qrcode.generate(url, { small: true }, (code) => {
  console.log(code);
  console.log(`\n  📱 Open Expo Go or Safari and scan above\n`);
  
  // Now start Next.js
  const next = spawn('npx', ['next', 'dev', '-p', String(port), '-H', '0.0.0.0'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });
  next.on('close', (code) => process.exit(code));
});
