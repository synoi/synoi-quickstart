#!/usr/bin/env bash
# verify-up.sh — quick smoke test that the gateway is healthy and signing receipts.
# Run after `docker compose up` to confirm everything is wired correctly.
set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:3000}"

echo "→ Health"
HEALTH=$(curl -s "$GATEWAY/health" || echo '{}')
echo "$HEALTH" | python3 -m json.tool || (echo "✗ Gateway is not responding at $GATEWAY"; exit 1)

echo
echo "→ Prometheus metrics endpoint"
METRICS_COUNT=$(curl -s "$GATEWAY/metrics" | grep -c '^# HELP synoi_' || true)
echo "✓ $METRICS_COUNT series exposed"

echo
echo "→ Public key (for offline receipt verification)"
curl -s "$GATEWAY/verify/pubkey" | python3 -m json.tool

echo
echo "→ Verification scheme (so any 3rd party can implement their own verifier)"
curl -s "$GATEWAY/verify/scheme" | python3 -c "import json,sys; print(json.dumps({k:v for k,v in json.load(sys.stdin).items() if k != 'example_code'}, indent=2))"

echo
echo "✓ Gateway healthy."
echo "  Dashboard:    $GATEWAY/dashboard  (Authorization: Bearer \$SYNOI_ADMIN_KEY)"
echo "  Metrics:      $GATEWAY/metrics"
echo "  Health:       $GATEWAY/health"
echo "  Verify any:   $GATEWAY/verify/<receipt-id>"
