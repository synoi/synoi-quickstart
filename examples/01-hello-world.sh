#!/usr/bin/env bash
# 01-hello-world.sh — minimum viable SynOI call.
# Verifies the gateway is up + returns a signed Decision Receipt.
set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:3000}"
API_KEY="${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY first}"

echo "→ POST $GATEWAY/anthropic/v1/messages"
echo

# -D - dumps response headers; -o /dev/null discards body for brevity here
RESP_HEADERS=$(curl -s -D - -o /dev/null \
  "$GATEWAY/anthropic/v1/messages" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "model": "claude-opus-4-7",
    "max_tokens": 32,
    "messages": [{"role": "user", "content": "Say hello in 5 words"}]
  }')

echo "$RESP_HEADERS" | grep -iE "^(HTTP|X-SynOI-)" || true

RECEIPT_ID=$(echo "$RESP_HEADERS" | grep -i "^X-SynOI-Receipt-Id" | awk '{print $2}' | tr -d '\r')

echo
echo "→ Receipt ID: $RECEIPT_ID"
echo "→ Verify in browser: $GATEWAY/verify/$RECEIPT_ID"
echo "→ JSON verification: curl -s $GATEWAY/verify/$RECEIPT_ID -H 'Accept: application/json'"
