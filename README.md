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
- **HITL approval gates** on dangerous tool actions (when paired with `@synoi/sdk` or `@synoi/openclaw-guard`)

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
git clone https://github.com/foundationx/synoi-quickstart
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

## What if my tool isn't in the compat list?

If your tool speaks the Anthropic Messages API or OpenAI Chat Completions API and lets you set a base URL, it works. If it doesn't have a config option, try:

- `HTTPS_PROXY=http://localhost:3000` (for tools that respect proxy env)
- A `127.0.0.1 api.anthropic.com` hosts entry + TLS on 443 (last resort)

Or open an issue and we'll add a row.
