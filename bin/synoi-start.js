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

function help() {
  process.stdout.write([
    '',
    'synoi-start — bootstrap a SynOI gateway in the current directory.',
    '',
    'Usage:',
    '  npx @synoi/start init [dir]    Create dir (default: ./synoi) with',
    '                                 docker-compose.yml + .env template.',
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

if (cmd !== 'init') {
  process.stderr.write(`Unknown command: ${cmd}\n`)
  help()
  process.exit(1)
}

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
