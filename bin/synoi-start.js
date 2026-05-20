#!/usr/bin/env node
/**
 * synoi-start — bootstrap a SynOI gateway in the current directory.
 *
 *   npx @synoi/start init [dir]   default dir: ./synoi
 *   npx @synoi/start --help
 *
 * Writes docker-compose.yml + .env from bundled templates, then prints
 * the next two commands the user needs to run.
 */

'use strict'

const fs   = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const args = process.argv.slice(2)
const cmd  = args[0]

const os = require('node:os')

function help() {
  process.stdout.write([
    '',
    'synoi-start — bootstrap a SynOI gateway in the current directory.',
    '',
    'Usage:',
    '  npx @synoi/start init [dir]    Create dir (default: ./synoi) with',
    '                                 docker-compose.yml + .env template.',
    '  npx @synoi/start link          Pair this machine with your SynOI account',
    '                                 (device-flow). Writes a fresh license key',
    '                                 to ~/.synoi/license.key on approval.',
    '  npx @synoi/start --help        Show this message.',
    '',
    'After init:',
    '  cd synoi',
    '  docker compose up',
    '',
    '  Gateway will be available at http://localhost:3000.',
    '  Dashboard at http://localhost:3000/dashboard (admin key in .env).',
    '',
    'See https://synoi.systems/quickstart for the full guide.',
    '',
  ].join('\n'))
}

if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
  help()
  process.exit(0)
}

if (cmd === 'link') {
  runLink().then(
    () => process.exit(0),
    (err) => {
      process.stderr.write(`\nlink failed: ${err.message}\n`)
      process.exit(1)
    },
  )
} else if (cmd === 'init') {
  runInit()
} else {
  process.stderr.write(`Unknown command: ${cmd}\n`)
  help()
  process.exit(1)
}

function runInit() {
  const targetDir = path.resolve(process.cwd(), args[1] || 'synoi')
  const templatesDir = path.join(__dirname, '..', 'templates')

  if (fs.existsSync(targetDir)) {
    const contents = fs.readdirSync(targetDir)
    if (contents.length > 0) {
      process.stderr.write(`Target directory ${targetDir} is not empty.\n`)
      process.stderr.write(`Refusing to overwrite. Pass an empty / new directory:\n`)
      process.stderr.write(`  npx @synoi/start init my-synoi\n`)
      process.exit(1)
    }
  } else {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const adminKey = crypto.randomBytes(32).toString('hex')

  const composeSrc = path.join(templatesDir, 'docker-compose.yml')
  const envSrc     = path.join(templatesDir, 'env.template')

  if (!fs.existsSync(composeSrc) || !fs.existsSync(envSrc)) {
    process.stderr.write(`FATAL: templates missing from package (${templatesDir}).\n`)
    process.stderr.write(`This is a packaging bug — please report it.\n`)
    process.exit(2)
  }

  fs.copyFileSync(composeSrc, path.join(targetDir, 'docker-compose.yml'))

  const envTemplate = fs.readFileSync(envSrc, 'utf8')
  const envFilled = envTemplate.replace('{{ADMIN_KEY}}', adminKey)
  fs.writeFileSync(path.join(targetDir, '.env'), envFilled, { mode: 0o600 })

  process.stdout.write([
    '',
    `  ✓ Created ${path.relative(process.cwd(), targetDir) || '.'}/`,
    '    ├── docker-compose.yml',
    '    └── .env  (admin key generated, mode 0600)',
    '',
    '  Next steps:',
    '',
    `    cd ${path.relative(process.cwd(), targetDir) || '.'}`,
    '    docker compose up',
    '',
    '  Gateway will start at http://localhost:3000',
    '  Dashboard at http://localhost:3000/dashboard (admin key in .env)',
    '',
    '  To point a tool at it:',
    '    export ANTHROPIC_BASE_URL=http://localhost:3000/anthropic    # Claude Code',
    '    export OPENAI_API_BASE=http://localhost:3000/v1              # OpenAI SDKs',
    '',
    '  Full guide: https://synoi.systems/quickstart',
    '',
  ].join('\n'))
}

// ── synoi-start link ───────────────────────────────────────────────────────
//
// RFC 8628 device-authorization-grant flow:
//   1. POST /v1/device/code           → device_code + user_code
//   2. Show user_code, open browser to /device?user_code=...
//   3. Poll GET /v1/device/poll/<device_code> every `interval`s
//   4. On approved → write license to ~/.synoi/license.key (mode 0600)

const API_BASE = process.env.SYNOI_CONTROL_URL || 'https://api.synoi.systems'

async function runLink() {
  const out = process.stdout
  out.write('\nLinking this machine to your SynOI account…\n\n')

  const clientHint = `${os.userInfo().username}@${os.hostname()} (synoi-start)`
  const startRes = await httpJson('POST', `${API_BASE}/v1/device/code`, { client_hint: clientHint })
  if (startRes.status >= 400) {
    throw new Error(`device/code returned HTTP ${startRes.status}: ${JSON.stringify(startRes.body).slice(0, 200)}`)
  }
  const { device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval } = startRes.body

  out.write(`  1. Open this URL in your browser:\n\n`)
  out.write(`     ${verification_uri_complete || verification_uri}\n\n`)
  out.write(`  2. Enter this code (already pre-filled from the URL above):\n\n`)
  out.write(`     ${user_code}\n\n`)
  out.write(`  Waiting for approval (expires in ${Math.floor(expires_in / 60)} min)…\n`)

  // Best-effort: try to open the browser
  tryOpenBrowser(verification_uri_complete || verification_uri)

  const pollIntervalMs = (interval || 3) * 1000
  const deadline = Date.now() + expires_in * 1000
  let lastPrint = 0
  while (Date.now() < deadline) {
    await sleep(pollIntervalMs)
    const r = await httpJson('GET', `${API_BASE}/v1/device/poll/${encodeURIComponent(device_code)}`)
    if (r.status !== 200) {
      throw new Error(`device/poll returned HTTP ${r.status}`)
    }
    const status = r.body && r.body.status
    if (status === 'approved') {
      out.write(`\n  ✓ Approved.\n`)
      const dir = path.join(os.homedir(), '.synoi')
      fs.mkdirSync(dir, { recursive: true })
      const keyPath = path.join(dir, 'license.key')
      fs.writeFileSync(keyPath, r.body.license_key + '\n', { mode: 0o600 })
      out.write(`  ✓ Wrote license key to ${keyPath} (mode 0600)\n\n`)
      out.write(`  tenant_id: ${r.body.tenant_id}\n`)
      if (r.body.approved_by_email) out.write(`  approved by: ${r.body.approved_by_email}\n`)
      out.write(`\n  Next steps:\n\n`)
      out.write(`    export SYNOI_API_KEY="$(cat ~/.synoi/license.key)"\n`)
      out.write(`    export ANTHROPIC_BASE_URL=https://gateway.synoi.systems/anthropic\n\n`)
      out.write(`  Then run your tool. Receipts will appear at https://app.synoi.systems/dashboard/receipts.\n\n`)
      return
    }
    if (status === 'denied')  throw new Error('approval denied in the browser')
    if (status === 'expired') throw new Error('code expired (15 min limit) — run `synoi-start link` again')
    // 'pending' — print a heartbeat every 15s so the user knows we're alive
    if (Date.now() - lastPrint > 15_000) {
      out.write('.')
      lastPrint = Date.now()
    }
  }
  throw new Error('timed out waiting for approval')
}

function httpJson(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? require('node:https') : require('node:http')
    const opts = {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
    }
    const req = lib.request(u, opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8')
        let parsed
        try { parsed = text ? JSON.parse(text) : null } catch { parsed = text }
        resolve({ status: res.statusCode || 0, body: parsed })
      })
    })
    req.on('error', reject)
    req.setTimeout(10_000, () => req.destroy(new Error('timeout')))
    if (body !== undefined) req.write(JSON.stringify(body))
    req.end()
  })
}

function tryOpenBrowser(url) {
  // Best-effort across macOS/Linux/Windows. Failure is silent — we already
  // printed the URL.
  const { spawn } = require('node:child_process')
  const platform = process.platform
  const cmd = platform === 'darwin' ? 'open'
            : platform === 'win32'  ? 'cmd'
            :                          'xdg-open'
  const args = platform === 'win32' ? ['/c', 'start', '""', url] : [url]
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
    child.unref()
  } catch { /* ignore */ }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
