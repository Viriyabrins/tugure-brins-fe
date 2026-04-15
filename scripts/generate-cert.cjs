const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const ip = process.argv[2] || process.env.CERT_IP || '127.0.0.1';
const outDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const attrs = [{ name: 'commonName', value: ip }];
const altNames = [{ type: 7, ip }];
const generateOptions = {
  days: 3650,
  algorithm: 'sha256',
  keySize: 2048,
  extensions: [{ name: 'subjectAltName', altNames }]
};

function writePems(pems) {
  console.log('writePems received type:', typeof pems);
  try {
    console.log('writePems keys:', pems && Object.keys(pems));
  } catch (e) {}
  if (!pems || !(pems.private || pems.privateKey || pems.cert || pems.public)) {
    console.error('selfsigned.generate returned invalid output:', pems);
    process.exit(1);
  }

  const keyPath = path.join(outDir, 'dev-key.pem');
  const certPath = path.join(outDir, 'dev-cert.pem');

  const key = pems.private || pems.privateKey || pems.pem || pems.private_pem;
  const cert = pems.cert || pems.public || pems.certificates || pems.cert_pem;

  if (!key || !cert) {
    console.error('Cannot find key/cert fields in generated object:', { keyPresent: !!key, certPresent: !!cert });
    console.error('Full object:', pems);
    process.exit(1);
  }

  fs.writeFileSync(keyPath, key, 'utf8');
  fs.writeFileSync(certPath, cert, 'utf8');

  console.log('Wrote key:', keyPath);
  console.log('Wrote cert:', certPath);
}

try {
  const maybePems = selfsigned.generate(attrs, generateOptions);
  if (maybePems && typeof maybePems.then === 'function') {
    maybePems.then(writePems).catch((err) => {
      console.error('Failed to generate certificate (async):', err && err.stack ? err.stack : err);
      process.exit(1);
    });
  } else {
    writePems(maybePems);
  }
} catch (err) {
  console.error('Failed to generate certificate:', err && err.stack ? err.stack : err);
  process.exit(1);
}
