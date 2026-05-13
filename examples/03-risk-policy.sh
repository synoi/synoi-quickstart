#!/usr/bin/env bash
# 03-risk-policy.sh — install a deny rule + a require_approval rule.
# Pairs with @synoi/sdk or @synoi/openclaw-guard for tool-execution gates.
set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:3000}"
ADMIN="${SYNOI_ADMIN_KEY:?Set SYNOI_ADMIN_KEY first}"
TENANT="${TENANT:-founder}"

echo "→ Installing risk policy for tenant '$TENANT'"

curl -s -X PUT "$GATEWAY/admin/tenants/$TENANT/settings/risk.policy" \
  -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "value": {
      "deny": [
        { "id": "no-rm-rf",  "match": { "tool_input.command": { "contains": "rm -rf" } } },
        { "id": "no-drop-db","match": { "tool_input.command": { "regex": "(?i)\\bdrop\\s+(table|database)\\b" } } }
      ],
      "require_approval": [
        { "id": "gate-kubectl-delete", "match": { "tool_input.command": { "starts_with": "kubectl delete" } } },
        { "id": "gate-prod-deploy",    "match": { "tool_name": "Deploy", "tool_input.env": "production" } }
      ],
      "timeout_seconds": 60,
      "risk_level": "high"
    }
  }'

echo
echo "→ Test it (no agent needed — call the risk evaluator directly):"
curl -s -X POST "$GATEWAY/v1/risk/evaluate" \
  -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"tool_name":"Bash","tool_input":{"command":"rm -rf /tmp/test"}}' \
  | python3 -m json.tool
