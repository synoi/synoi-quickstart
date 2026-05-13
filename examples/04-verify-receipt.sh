#!/usr/bin/env bash
# 04-verify-receipt.sh — fetch a receipt + verify its Ed25519 signature
# OFFLINE using openssl, without trusting the gateway's response.
set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:3000}"
RECEIPT_ID="${1:?Usage: $0 <receipt-id>}"

echo "→ Fetching receipt $RECEIPT_ID + canonical bytes + public key"
RAW=$(curl -s "$GATEWAY/verify/$RECEIPT_ID/raw")
SIG=$(curl -s "$GATEWAY/verify/$RECEIPT_ID" -H 'Accept: application/json' | python3 -c "import json,sys; print(json.load(sys.stdin)['receipt']['signature'])")
PUB=$(curl -s "$GATEWAY/verify/pubkey" | python3 -c "import json,sys; print(json.load(sys.stdin)['public_key'])")

# Write to temp files
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo -n "$RAW" > "$TMP/canonical.bin"
echo "$SIG"   | xxd -r -p > "$TMP/sig.bin"
echo "$PUB"   > "$TMP/pub.pem"

echo "→ Verifying via openssl..."
if openssl pkeyutl -verify -pubin -inkey "$TMP/pub.pem" -rawin -in "$TMP/canonical.bin" -sigfile "$TMP/sig.bin"; then
  echo "✓ Signature valid — receipt is authentic."
else
  echo "✗ Signature INVALID — receipt has been tampered with or forged."
  exit 1
fi
