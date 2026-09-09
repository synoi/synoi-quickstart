# synoi-quickstart

5-minute setup for the SynOI gateway — the drop-in trust layer for AI tools.

## What this gets you

Point any AI tool that speaks OpenAI or Anthropic protocol at the gateway and immediately get:

- **L1/L2/L3 cache** that survives restarts
- **60%+ input-token reduction** via lossless body-shrink
- **Cost routing** (cheap models for trivial queries, premium for complex)
- **Decision Receipts** — every call signed and publicly verifiable
- **Per-tenant budgets** with webhook alerts when you cross thresholds
- **Dashboard** at `http://localhost:3000/dashboard`
- **Prometheus metrics** at `http://localhost:3000/metrics`
- **HITL approval gates** on dangerous tool actions (when paired with `@synoi/sdk`, published; `@synoi/openclaw-guard` and `@synoi/guard` are in-repo but not yet on npm)

Zero changes to your tool's code. Change one env var.

## Start it

### Three commands (recommended)

```bash
npx @synoi/start init
cd synoi
docker compose up
```

That's the whole flow. `npx @synoi/start init` writes a `docker-compose.yml` + an `.env` (with a fresh 32-byte admin key, mode 0600) into `./synoi/`. `docker compose up` pulls `ghcr.io/foundationx/synoi-gateway:latest` and starts the gateway on port 3000.

Gateway: `http://localhost:3000` · Dashboard: `http://localhost:3000/dashboard` (admin key in `.env`).

### Docker Compose by hand

```bash
git clone https://github.com/synoi/synoi-quickstart
cd synoi-quickstart
docker compose up
```

### From source (developers)

```bash
git clone https://github.com/foundationx/synoi-gateway
cd synoi-gateway
yarn install
yarn dev
```

## Then point your tool at it

### Claude Code

```bash
export ANTHROPIC_BASE_URL=http://localhost:3000/anthropic
claude   # or however you launch it
```

Works for both API-key and subscription (OAuth) modes.

### Hermes Agent (Nous Research)

Hermes speaks OpenAI-compatible HTTP, so it points at the gateway the same way Cursor does. During `hermes setup`, when prompted for the LLM provider URL, use:

```
http://localhost:3000/v1
```

Or, if you've already run `hermes setup`, edit `~/.hermes/config.toml`:

```toml
[provider]
type     = "openai"
base_url = "http://localhost:3000/v1"
api_key  = "<your-synoi-license-key>"
```

You get the same governance + signed receipts as any other client. **Hermes' agent-generated skills will be signed by SynOI in a future release** — see [SKILL_SIGNING_SPEC.md](../synoi-brain/libraries/v1/SKILL_SIGNING_SPEC.md). For now, every LLM call through Hermes already produces a receipt.

### Cursor

Cursor → Settings → Models → Override OpenAI Base URL → `http://localhost:3000/v1`

### Aider

```bash
export OPENAI_API_BASE=http://localhost:3000/v1
aider
```

### Continue.dev

`~/.continue/config.json`:
```json
{
  "models": [{
    "title": "via SynOI",
    "provider": "openai",
    "apiBase": "http://localhost:3000/v1",
    "model": "claude-opus-4-7"
  }]
}
```

### Anthropic / OpenAI SDK (any language)

```python
# Python
from anthropic import Anthropic
client = Anthropic(base_url="http://localhost:3000/anthropic")
```

```typescript
// TypeScript
import Anthropic from "@anthropic-ai/sdk"
const client = new Anthropic({ baseURL: "http://localhost:3000/anthropic" })
```

For the full list of 17+ tools tested, see [`docs/COMPAT-MATRIX.md`](https://github.com/synoi/synoi-gateway/blob/main/docs/COMPAT-MATRIX.md) in the gateway repo.

## Verify it's working

Hit the gateway from any of the tools above, then check the dashboard:

```
http://localhost:3000/dashboard
```

You'll see cache hit rate, cost saved, tier distribution, latency p50/p95, and the receipt audit trail.

Or grab a receipt ID from a response header and verify it cryptographically:

```bash
curl -i http://localhost:3000/anthropic/v1/messages \
  -H "x-api-key: sk-ant-..." \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model": "claude-opus-4-7", "max_tokens": 16, "messages": [{"role": "user", "content": "hi"}]}'

# Response includes: X-SynOI-Receipt-Id: rcpt_xxx_xxxxx
# Open in browser:
open http://localhost:3000/verify/rcpt_xxx_xxxxx
```

## Next steps

- **Set a budget** — see `examples/set-budget.sh`
- **Add a risk policy** — see `examples/risk-policy.sh`
- **Enable HITL on tool execution** — install `@synoi/sdk` (any agent) or `@synoi/openclaw-guard` (OpenClaw)
- **Production deployment** — see `docs/DEPLOY.md` in the gateway repo for Docker / systemd / Cloudflare Tunnel patterns

## Connecting an agent to a gateway on a different machine

Common pattern: the agent runs in a cloud VPS (Hostinger / DigitalOcean / Modal), but you want it to reach a SynOI gateway running on your home / office network. Or vice-versa: the gateway is in the cloud and your laptop is at a coffee shop. Three patterns we recommend, in order of operational simplicity:

### Tailscale (recommended for solo + small teams)

[Tailscale](https://tailscale.com) creates a private mesh between your machines using WireGuard. Each machine gets a stable `100.x.x.x` IP that follows it across networks.

```bash
# On the gateway host:
tailscale up
# Note the assigned name (e.g. "mac.tail-scale.ts.net")

# On the agent host:
tailscale up
export ANTHROPIC_BASE_URL=http://mac.tail-scale.ts.net:3000/anthropic
```

Free for up to 100 devices. Outbound-only — no firewall holes. Works across NAT, restrictive Wi-Fi, the coffee shop.

### Twingate (recommended for teams with identity-aware access policies)

[Twingate](https://www.twingate.com) is the enterprise-positioned equivalent. Identity-based zero-trust access; integrates with your identity provider (Okta, Google Workspace, etc.). Same outbound-only connector pattern, but with team-level access policies layered on top.

NetworkChuck demonstrated this exact pattern on YouTube: Hermes agent in Hostinger VPS reaches his home studio network through a Twingate headless client.

```bash
# On the gateway host: install Twingate connector
curl https://binaries.twingate.com/connector/setup.sh | sudo bash

# On the agent host: install Twingate client + auth via SSO
# Then the gateway is reachable at its private hostname:
export ANTHROPIC_BASE_URL=http://gateway.internal:3000/anthropic
```

### Direct LAN + mDNS (zero-deps, same network only)

If both machines are on the same LAN (home or office), just use the gateway's `.local` hostname — the gateway announces itself via mDNS / Bonjour as `synoi-gateway.local`:

```bash
# On the agent host (Mac, modern Windows, or Linux with Avahi):
export ANTHROPIC_BASE_URL=http://synoi-gateway.local:3000/anthropic
```

No setup, no third-party service. Breaks when either machine moves to a different network — for that, use Tailscale or Twingate.

We don't ship our own peer-transport solution; pick whichever fits your IT environment.

## What if my tool isn't in the compat list?

If your tool speaks the Anthropic Messages API or OpenAI Chat Completions API and lets you set a base URL, it works. If it doesn't have a config option, try:

- `HTTPS_PROXY=http://localhost:3000` (for tools that respect proxy env)
- A `127.0.0.1 api.anthropic.com` hosts entry + TLS on 443 (last resort)

Or open an issue and we'll add a row.
