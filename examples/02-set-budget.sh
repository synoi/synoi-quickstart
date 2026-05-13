#!/usr/bin/env bash
# 02-set-budget.sh — configure a per-tenant daily spend cap with webhook alerts.
set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:3000}"
ADMIN="${SYNOI_ADMIN_KEY:?Set SYNOI_ADMIN_KEY first}"
TENANT="${TENANT:-founder}"

echo "→ Setting daily budget for tenant '$TENANT'"

# Daily cap of $5
curl -s -X PUT "$GATEWAY/admin/tenants/$TENANT/settings/budget.daily_usd" \
  -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"value": 5.00}'

# Warn at 80%
curl -s -X PUT "$GATEWAY/admin/tenants/$TENANT/settings/budget.warn_threshold" \
  -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"value": 0.8}'

# Optional webhook (replace with your URL)
# curl -s -X PUT "$GATEWAY/admin/tenants/$TENANT/settings/budget.webhook_url" \
#   -H "Authorization: Bearer $ADMIN" \
#   -H "Content-Type: application/json" \
#   -d '{"value": "https://hooks.slack.com/services/..."}'

echo
echo "→ Current snapshot:"
curl -s "$GATEWAY/budgets/$TENANT" -H "Authorization: Bearer $ADMIN" | python3 -m json.tool
