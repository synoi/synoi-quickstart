# Using SynOI with Claude Code

Two ways to wire it up — pick based on which auth mode you use.

## API key (Anthropic console)

```bash
export ANTHROPIC_BASE_URL=http://localhost:3000/anthropic
export ANTHROPIC_API_KEY=sk-ant-...
claude
```

The gateway forwards the `x-api-key` header unchanged. Every request gets cached, body-shrunk, and audited.

## Subscription (Claude Pro/Max — OAuth)

```bash
export ANTHROPIC_BASE_URL=http://localhost:3000/anthropic
claude   # Claude Code handles OAuth internally
```

The gateway forwards your OAuth `Authorization: Bearer` header unchanged AND automatically disables body-mutating features (KB inject, House Style, prune, DOI, body-shrink) so Anthropic's anti-relay detection doesn't trip a 429. You still get:

- L1 cache
- Latency tracking
- Decision Receipts
- Cost reporting
- Dashboard visibility

The body-mutating features are skipped to preserve byte-identical relay behavior. If you want them, switch to API-key auth.

## Verify it's working

```bash
# Make a request through Claude Code, then check the dashboard:
open http://localhost:3000/dashboard
```

You'll see every Claude Code request as a line in the receipts log, with the receipt's verification URL one click away.

## What you'll measure

Run Claude Code through the gateway for a day. Expected outcomes on a typical coding session:

- **Cache hit rate: 15–40%** — most code questions get asked variants of "what does this do?"
- **Cost saved: $0–$X depending on tier** — for subscription users this is informational (you're flat-rate); for API users it's real dollars
- **Body-shrink reduction: 0% (OAuth) or 30–60% (API key)** — agentic conversations with tool schemas compress hardest

Open the dashboard at `/dashboard` to see live numbers.
