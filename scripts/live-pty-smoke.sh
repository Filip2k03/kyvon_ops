#!/usr/bin/env bash
# Read-only interactive PTY smoke test for the approved KyvonOPS test host.
set -euo pipefail

: "${SSH_HOST:?Set SSH_HOST to the approved test host}"
: "${SSH_USER:?Set SSH_USER to the approved login}"
: "${SSH_KEY:?Set SSH_KEY to the approved private-key path}"

output=$(ssh \
  -tt \
  -i "${SSH_KEY}" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o ConnectTimeout=15 \
  "${SSH_USER}@${SSH_HOST}" \
  'printf "kyvon-pty-start\\n"; stty size; printf "kyvon-pty-end\\n"; exit 0' 2>&1 | tr -d '\r')

printf '%s\n' "$output"
grep -Fq 'kyvon-pty-start' <<<"$output"
grep -Eq '^[0-9]+ [0-9]+$' <<<"$output"
grep -Fq 'kyvon-pty-end' <<<"$output"
echo 'pty=verified'
