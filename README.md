# synoi-quickstart

Two ways to run SynOI locally: **Gateway Lite**, which is free and works with the
commands below, and the **licensed SynOI Gateway**, which needs an Operator or
Team license.

| | Gateway Lite | SynOI Gateway |
|---|---|---|
| Price | Free, Apache-2.0 | 14-day trial, then Operator or Team |
| What it governs | Actions your code hands it via `gate()` | LLM traffic, by base-URL swap, plus actions |
| Account | None | SynOI account |
| Network | None required | Control plane for licensing |
| Install | `npx @synoi/gateway-lite` | Container image, see below |

Lite is not a trial of the Gateway and not a crippled build of it. It is a
smaller product: local approval with operator-signed receipts. It does not proxy
LLM calls, so it has no cache, no cost routing, and no base-URL swap. If you came
here to put a governance layer in front of Claude Code or Cursor, that is the
licensed Gateway.

## Gateway Lite (free, no account)

```bash
npm i @synoi/sdk
npx @synoi/gateway-lite
```

The daemon listens on `http://127.0.0.1:8787`. Open
`http://127.0.0.1:8787/local/dashboard` to enroll your operator identity and to
approve or deny pending actions.

Then gate an action in your own code:

```ts
import { gate } from '@synoi/sdk'

await gate(
  {
    action_kind: 'command',
    args: { to: 'ops@example.com', subject: 'deploy complete' },
    daemonUrl: 'http://127.0.0.1:8787',
  },
  async () => {
    // runs only after you approve it in the dashboard
    await sendEmail(...)
  },
)
```

**Set `daemonUrl` (or `SYNOI_DAEMON_URL`) explicitly.** As published today,
`@synoi/sdk` defaults to port 7990 while `@synoi/gateway-lite` listens on 8787,
so the default does not reach the daemon. The two will be aligned in a later
release; until then, name the port.

Receipts are self-signed with an Ed25519 key generated on your machine and never
transmitted. Verify one offline with the published `@synoi/verify`:

```ts
import { verifyReceiptByScheme } from '@synoi/verify'

const result = await verifyReceiptByScheme({
  receipt,                 // from GET /local/receipts/:oid
  gap_ed25519_pub: pubkey,
})
```

That proves the receipt was signed by the key on your machine and has not been
altered since. It does not prove to anyone else that the key belongs to a party
they should trust: the neutral resolver that would establish that is not live.
Do not call a self-signed receipt independently verified.

Lite's own status, key custody details and platform caveats are in its
[package README](https://www.npmjs.com/package/@synoi/gateway-lite). It is
labeled PARTIAL, so read that before relying on it for more than local use.

## SynOI Gateway (licensed)

The Gateway is the governed LLM proxy. Point any tool that speaks the Anthropic
or OpenAI protocol at it and get caching, lossless body-shrink, cost routing
across models, signed Decision Receipts, per-tenant budgets with webhook alerts,
a dashboard, Prometheus metrics, and HITL approval gates.

It is commercial software: a 14-day trial, then Operator or Team. Start at
[app.synoi.systems](https://app.synoi.systems).

**Availability note.** The container image referenced by the compose files in
this repo is not published publicly. Until trial image distribution ships, the
`init` command below writes a valid compose file that cannot pull yet. Use
Gateway Lite for a local install that works today.

```bash
npx @synoi/start init
cd synoi
docker compose up
```

`init` writes `docker-compose.yml` and an `.env` with a freshly generated 32-byte
admin key at mode 0600. The Gateway serves on port 3000, with its dashboard at
`/dashboard` behind the admin key.

### Pairing a licensed install

```bash
npx @synoi/start link
```

An RFC 8628 device flow: it prints a code, you approve in the browser, and it
writes the license key to `~/.synoi/license.key`. Pass `--gateway <url>` (or set
`SYNOI_GATEWAY_URL`) to pair against a local gateway rather than the control
plane.

### Pointing tools at a licensed Gateway

```bash
# Claude Code (API key or subscription OAuth)
export ANTHROPIC_BASE_URL=http://localhost:3000/anthropic

# OpenAI-protocol tools: Cursor, Aider, Continue.dev, Hermes
export OPENAI_API_BASE=http://localhost:3000/v1
```

Cursor: Settings, then Models, then Override OpenAI Base URL. Continue.dev: set
`apiBase` in `~/.continue/config.json`. Hermes: set `base_url` under `[provider]`
in `~/.hermes/config.toml`. Any SDK in any language takes the same base URL:

```python
from anthropic import Anthropic
client = Anthropic(base_url="http://localhost:3000/anthropic")
```

Responses carry `X-SynOI-Receipt-Id`; open `/verify/<id>` to check one.

## Reaching a gateway on another machine

Either product binds to localhost by default. To reach one from a different
machine, in order of operational simplicity:

- **Tailscale** for solo and small teams. A WireGuard mesh, stable `100.x.x.x`
  addresses that follow the machine, outbound only, free up to 100 devices.
- **Twingate** when you want identity-aware access policies tied to Okta or
  Google Workspace. Same outbound-only connector shape.
- **LAN plus mDNS**, same network only: the licensed Gateway announces itself as
  `synoi-gateway.local`.

We do not ship a peer transport. Pick whatever fits your environment.

## Examples

The scripts in `examples/` target the licensed Gateway's admin and proxy routes
(budgets, risk policy, receipt verification), so they need a running Gateway.
`04-verify-receipt.sh` is the exception: it verifies a receipt with openssl and
works against any receipt you can fetch.

## License

Apache-2.0. This repo holds only the bootstrap CLI and templates, no product
code.
