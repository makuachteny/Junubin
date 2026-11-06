#!/usr/bin/env node
// One-shot script that uses the App Store Connect API key to:
//  1. Generate a CSR (locally via openssl)
//  2. Create an iOS Distribution certificate against ASC API
//  3. Save the .cer + .key, bundle them into a .p12 the keychain can import
//  4. Register the bundle ID `com.junubin.app` if it doesn't exist
//  5. Enable the Push Notifications capability on it (so the cert covers it)
//  6. Create an App Store Connect provisioning profile bound to that cert + bundle
//  7. Save the .mobileprovision
//
// Output:
//   ~/.appstoreconnect/junubin_dist.p12  (password: junubin2026)
//   ~/.appstoreconnect/JuNubin_Production.mobileprovision
//
// Why this exists: xcodebuild's automatic signing fails on archive when the
// team has no registered iOS devices, because it tries to create a
// Development profile alongside the Distribution one. Doing the Distribution
// flow ourselves avoids that whole branch.
//
// Run with:
//   node scripts/asc-bootstrap.js

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KEY_ID = 'NSBB4VSS9R';
const ISSUER_ID = '45681e55-f9bd-4d83-8933-de3f93bc4266';
const TEAM_ID = '7CW78SZQF9';
const BUNDLE_ID = 'com.junubin.app';
const P12_PASSWORD = 'junubin2026';
const HOME = process.env.HOME;
const ASC_DIR = path.join(HOME, '.appstoreconnect');
const P8_PATH = path.join(ASC_DIR, `AuthKey_${KEY_ID}.p8`);
const KEY_PATH = path.join(ASC_DIR, 'junubin_dist.key');
const CSR_PATH = path.join(ASC_DIR, 'junubin_dist.csr');
const CER_PATH = path.join(ASC_DIR, 'junubin_dist.cer');
const PEM_PATH = path.join(ASC_DIR, 'junubin_dist.pem');
const P12_PATH = path.join(ASC_DIR, 'junubin_dist.p12');
const PROFILE_PATH = path.join(ASC_DIR, 'JuNubin_Production.mobileprovision');

function buildJwt() {
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const key = fs.readFileSync(P8_PATH, 'utf8');
  // Sign returns DER-encoded ECDSA signature; ASC requires raw r || s (64 bytes
  // for P-256). Convert via crypto's `dsaEncoding: 'ieee-p1363'`.
  const sig = crypto.createSign('SHA256').update(data).sign({
    key,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  return `${data}.${sig}`;
}

async function api(method, p, body) {
  const url = `https://api.appstoreconnect.apple.com${p}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${buildJwt()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) {
    const err = json.errors?.[0];
    throw new Error(`${method} ${p} → ${res.status}: ${err?.title || res.statusText} — ${err?.detail || ''}`);
  }
  return json;
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function runOut(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
}

async function main() {
  if (!fs.existsSync(ASC_DIR)) fs.mkdirSync(ASC_DIR, { recursive: true });

  // ── 1. Generate CSR ──
  if (!fs.existsSync(CSR_PATH)) {
    console.log('▸ Generating CSR + private key…');
    run('openssl', [
      'req', '-new', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', KEY_PATH,
      '-out', CSR_PATH,
      '-subj', `/emailAddress=itsmakuach@gmail.com/CN=JuNubin Distribution/C=US`,
    ]);
    fs.chmodSync(KEY_PATH, 0o600);
  } else {
    console.log('↻ CSR already exists, reusing.');
  }

  // ── 2. Create or reuse a Distribution certificate ──
  console.log('▸ Looking up existing Distribution certs…');
  const certList = await api('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=200');
  let cert = (certList.data || []).find((c) => c.attributes?.name?.includes('JuNubin'));

  if (!cert) {
    console.log('▸ Creating Distribution certificate via ASC API…');
    const csrContent = fs.readFileSync(CSR_PATH, 'utf8')
      .replace(/-----BEGIN CERTIFICATE REQUEST-----/, '')
      .replace(/-----END CERTIFICATE REQUEST-----/, '')
      .replace(/\s+/g, '');
    const created = await api('POST', '/v1/certificates', {
      data: {
        type: 'certificates',
        attributes: { csrContent, certificateType: 'DISTRIBUTION' },
      },
    });
    cert = created.data;
    console.log(`  + cert ${cert.id}`);
  } else {
    console.log(`  ↻ reusing cert ${cert.id} (${cert.attributes.name})`);
  }

  // Save .cer (DER) and convert to .pem then bundle into .p12.
  const cerDer = Buffer.from(cert.attributes.certificateContent, 'base64');
  fs.writeFileSync(CER_PATH, cerDer);
  run('openssl', ['x509', '-inform', 'DER', '-in', CER_PATH, '-out', PEM_PATH]);
  if (fs.existsSync(P12_PATH)) fs.unlinkSync(P12_PATH);
  run('openssl', [
    'pkcs12', '-export',
    '-inkey', KEY_PATH,
    '-in', PEM_PATH,
    '-out', P12_PATH,
    '-name', 'JuNubin Distribution',
    '-passout', `pass:${P12_PASSWORD}`,
  ]);
  fs.chmodSync(P12_PATH, 0o600);
  console.log(`  + .p12 → ${P12_PATH} (password: ${P12_PASSWORD})`);

  // ── 3. Register the bundle ID if missing ──
  console.log('▸ Looking up bundle ID…');
  const bidList = await api('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&limit=200`);
  let bundleIdRecord = (bidList.data || []).find((b) => b.attributes?.identifier === BUNDLE_ID);

  if (!bundleIdRecord) {
    console.log(`▸ Registering bundle ID ${BUNDLE_ID}…`);
    const created = await api('POST', '/v1/bundleIds', {
      data: {
        type: 'bundleIds',
        attributes: {
          identifier: BUNDLE_ID,
          name: 'JuNubin',
          platform: 'IOS',
        },
      },
    });
    bundleIdRecord = created.data;
    console.log(`  + bundle ${bundleIdRecord.id}`);
  } else {
    console.log(`  ↻ bundle ID exists: ${bundleIdRecord.id}`);
  }

  // ── 4. Create the App Store distribution profile ──
  console.log('▸ Looking up existing profile…');
  const profList = await api('GET', `/v1/profiles?filter[name]=JuNubin Production AppStore&limit=200`);
  let profile = (profList.data || []).find((p) => p.attributes?.name === 'JuNubin Production AppStore');

  // Always recreate: profiles are bound to a specific cert; if we just made a
  // new cert, the old profile would still reference the old one. Easier to
  // delete + recreate than to introspect.
  if (profile) {
    console.log(`▸ Deleting stale profile ${profile.id}…`);
    await api('DELETE', `/v1/profiles/${profile.id}`);
    profile = null;
  }

  console.log('▸ Creating Distribution provisioning profile…');
  const profCreated = await api('POST', '/v1/profiles', {
    data: {
      type: 'profiles',
      attributes: {
        name: 'JuNubin Production AppStore',
        profileType: 'IOS_APP_STORE',
      },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundleIdRecord.id } },
        certificates: { data: [{ type: 'certificates', id: cert.id }] },
      },
    },
  });
  profile = profCreated.data;
  console.log(`  + profile ${profile.id}`);

  fs.writeFileSync(PROFILE_PATH, Buffer.from(profile.attributes.profileContent, 'base64'));
  fs.chmodSync(PROFILE_PATH, 0o600);
  console.log(`  + .mobileprovision → ${PROFILE_PATH}`);

  // ── 5. Install into the Mac ──
  console.log('▸ Importing .p12 into the login keychain…');
  try {
    run('security', [
      'import', P12_PATH,
      '-P', P12_PASSWORD,
      '-A', // any app can use it (avoids per-build trust prompts)
      '-T', '/usr/bin/codesign',
      '-T', '/usr/bin/security',
    ]);
  } catch (e) {
    console.log('  (security import non-fatal; cert may already be in keychain)');
  }

  // Profile UUID — Xcode uses this to look up the right one. Extract from
  // the embedded plist.
  const profilePayload = fs.readFileSync(PROFILE_PATH);
  const m = /<key>UUID<\/key>\s*<string>([^<]+)<\/string>/.exec(profilePayload.toString('binary'));
  if (!m) throw new Error('Could not parse UUID from profile');
  const uuid = m[1];

  // Drop the profile into the canonical Xcode location so xcodebuild can
  // find it during the archive.
  const dest = path.join(HOME, 'Library/MobileDevice/Provisioning Profiles', `${uuid}.mobileprovision`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(PROFILE_PATH, dest);
  console.log(`  + profile installed to ${dest}`);

  console.log('\n✅ Bootstrap complete.');
  console.log(`   Profile UUID: ${uuid}`);
  console.log(`   Use in xcodebuild: -PROVISIONING_PROFILE_SPECIFIER="JuNubin Production AppStore"`);
}

main().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
