#!/usr/bin/env node
/**
 * @synoi/start quickstart tests.
 *
 * Functional tests using child_process.spawnSync — runs the CLI directly
 * in temp directories to verify the init command output and template
 * substitution, without needing to refactor the CLI module.
 */

'use strict'

const { spawnSync } = require('node:child_process')
const fs            = require('node:fs')
const os            = require('node:os')
const path          = require('node:path')

const CLI = path.join(__dirname, '..', 'bin', 'synoi-start.js')

let passed = 0, failed = 0
function ok(label, cond, detail) {
  if (cond) { passed++; process.stdout.write(`OK   ${label}\n`) }
  else      { failed++; process.stdout.write(`FAIL ${label}${detail ? ' — ' + detail : ''}\n`) }
}

function run(...args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    timeout:  5_000,
  })
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synoi-quickstart-test-'))
}

// ── A: help ───────────────────────────────────────────────────────────────────

{
  const r = run('--help')
  ok('A1: --help exits 0', r.status === 0)
  ok('A1: --help mentions init', r.stdout.includes('init'))
  ok('A1: --help mentions link', r.stdout.includes('link'))
  ok('A1: --help mentions docker compose', r.stdout.toLowerCase().includes('docker'))
  ok('A1: --help mentions the free lite path', r.stdout.includes('lite'))
}

{
  const r = run('-h')
  ok('A2: -h exits 0', r.status === 0)
}

{
  const r = run('help')
  ok('A3: help command exits 0', r.status === 0)
}

{
  const r = run()  // no args
  ok('A4: no args exits 0 (shows help)', r.status === 0)
  ok('A4: no args shows usage', r.stdout.includes('init'))
}

// ── B: unknown command ────────────────────────────────────────────────────────

{
  const r = run('invalid-command-xyz')
  ok('B1: unknown command exits non-zero', r.status !== 0)
  ok('B1: unknown command mentions the command name', r.stderr.includes('invalid-command-xyz'))
}

// ── C: init — creates expected files ─────────────────────────────────────────

{
  const base   = tmpDir()
  const target = path.join(base, 'my-gateway')
  const r      = run('init', target)
  ok('C1: init exits 0', r.status === 0, `stderr: ${r.stderr}`)
  ok('C1: target dir created', fs.existsSync(target))
  ok('C1: docker-compose.yml created', fs.existsSync(path.join(target, 'docker-compose.yml')))
  ok('C1: .env created', fs.existsSync(path.join(target, '.env')))
  ok('C1: stdout mentions localhost:3000', r.stdout.includes('localhost:3000'))
  ok('C1: stdout mentions docker compose up', r.stdout.includes('docker compose up'))
  // The Gateway image is not published publicly yet, so init must say so and
  // must point at the free path that does work today. Without this, the whole
  // flow ends in an unexplained docker pull failure.
  ok('C1: stdout says the image is not published publicly yet',
    r.stdout.includes('not published publicly'))
  ok('C1: stdout points at the free lite path', r.stdout.includes('start lite'))
  ok('C1: generated compose carries the same caveat',
    fs.readFileSync(path.join(target, 'docker-compose.yml'), 'utf8').includes('NOT published publicly'))
  ok('C1: generated .env states there is no free tier', (() => {
    const env = fs.readFileSync(path.join(target, '.env'), 'utf8')
    // The old text told operators to "leave blank for free-tier features",
    // which is exactly the promise the 2026-09-15 pricing decision retired.
    return /no free tier/i.test(env) && !/leave blank for free/i.test(env)
  })())
  fs.rmSync(base, { recursive: true, force: true })
}

// ── D: init — .env substitution ──────────────────────────────────────────────

{
  const base   = tmpDir()
  const target = path.join(base, 'gw')
  run('init', target)
  const env = fs.readFileSync(path.join(target, '.env'), 'utf8')

  ok('D1: SYNOI_ADMIN_KEY present', env.includes('SYNOI_ADMIN_KEY='))
  ok('D1: {{ADMIN_KEY}} placeholder replaced', !env.includes('{{ADMIN_KEY}}'))
  ok('D1: admin key is a 64-char hex string', (() => {
    const match = env.match(/SYNOI_ADMIN_KEY=([0-9a-f]+)/)
    return match && match[1].length === 64
  })())
  ok('D1: SYNOI_SHRINK_ENABLE present', env.includes('SYNOI_SHRINK_ENABLE=1'))
  ok('D1: RATE_LIMIT_RPM present', env.includes('RATE_LIMIT_RPM='))

  fs.rmSync(base, { recursive: true, force: true })
}

// ── E: init — docker-compose.yml is valid YAML-shaped content ────────────────

{
  const base   = tmpDir()
  const target = path.join(base, 'gw')
  run('init', target)
  const compose = fs.readFileSync(path.join(target, 'docker-compose.yml'), 'utf8')
  ok('E1: compose file not empty', compose.length > 10)
  // Should mention a service or image
  ok('E1: compose mentions synoi or gateway',
    compose.toLowerCase().includes('synoi') || compose.toLowerCase().includes('gateway'))
  fs.rmSync(base, { recursive: true, force: true })
}

// ── F: init — default directory when no target provided ──────────────────────

{
  const base  = tmpDir()
  const r     = run('init', path.join(base, 'synoi'))
  ok('F1: init with explicit dir exits 0', r.status === 0, r.stderr)
  fs.rmSync(base, { recursive: true, force: true })
}

// ── G: init — refuses non-empty directory ────────────────────────────────────

{
  const base   = tmpDir()
  const target = path.join(base, 'nonempty')
  fs.mkdirSync(target, { recursive: true })
  fs.writeFileSync(path.join(target, 'existing-file.txt'), 'data')

  const r = run('init', target)
  ok('G1: refuses non-empty directory (exits non-zero)', r.status !== 0)
  ok('G1: error mentions non-empty', r.stderr.includes('not empty') || r.stderr.includes('empty'))
  fs.rmSync(base, { recursive: true, force: true })
}

// ── H: init — each run produces a unique admin key ──────────────────────────

{
  const keys = new Set()
  for (let i = 0; i < 3; i++) {
    const base   = tmpDir()
    const target = path.join(base, 'gw')
    run('init', target)
    const env   = fs.readFileSync(path.join(target, '.env'), 'utf8')
    const match = env.match(/SYNOI_ADMIN_KEY=([0-9a-f]+)/)
    if (match) keys.add(match[1])
    fs.rmSync(base, { recursive: true, force: true })
  }
  ok('H1: each init produces a unique admin key', keys.size === 3, `got ${keys.size} unique keys`)
}

// ── I: template files exist ────────────────────────────────────────────────

{
  const templatesDir = path.join(__dirname, '..', 'templates')
  ok('I1: templates/ dir exists', fs.existsSync(templatesDir))
  ok('I1: docker-compose.yml template exists', fs.existsSync(path.join(templatesDir, 'docker-compose.yml')))
  ok('I1: env.template exists', fs.existsSync(path.join(templatesDir, 'env.template')))
  const envTemplate = fs.readFileSync(path.join(templatesDir, 'env.template'), 'utf8')
  ok('I1: env.template contains placeholder', envTemplate.includes('{{ADMIN_KEY}}'))
}

// ── J: lite — the free path ──────────────────────────────────────────────────

{
  const r = run('lite')
  ok('J1: lite exits 0', r.status === 0, `stderr: ${r.stderr}`)
  ok('J1: lite names the package', r.stdout.includes('@synoi/gateway-lite'))
  ok('J1: lite names the sdk', r.stdout.includes('@synoi/sdk'))
  // The daemon listens on 8787 while @synoi/sdk still defaults to 7990, so the
  // port has to be stated or the documented flow silently fails to connect.
  ok('J1: lite gives the daemon port', r.stdout.includes('127.0.0.1:8787'))
  ok('J1: lite warns about the sdk default port', r.stdout.includes('7990'))
  ok('J1: lite says it does not proxy LLM calls', r.stdout.includes('does NOT proxy'))
}

{
  // lite is informational: it must not create files or install anything.
  const base = tmpDir()
  const r = spawnSync(process.execPath, [CLI, 'lite'], { encoding: 'utf8', timeout: 5_000, cwd: base })
  ok('J2: lite exits 0 in an empty cwd', r.status === 0)
  ok('J2: lite creates nothing', fs.readdirSync(base).length === 0)
  fs.rmSync(base, { recursive: true, force: true })
}

// ── Done ──────────────────────────────────────────────────────────────────────

process.stdout.write(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
