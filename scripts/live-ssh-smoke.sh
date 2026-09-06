#!/usr/bin/env bash
# Read-only live-host smoke test for the KyvonOPS SSH onboarding path.
set -euo pipefail

: "${SSH_HOST:?Set SSH_HOST to the approved test host}"
: "${SSH_USER:?Set SSH_USER to the approved login}"
: "${SSH_KEY:?Set SSH_KEY to the approved private-key path}"

exec ssh \
  -i "${SSH_KEY}" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o ConnectTimeout=15 \
  "${SSH_USER}@${SSH_HOST}" \
  'set -eu
   printf "host=%s\n" "$(hostname -f 2>/dev/null || hostname)"
   printf "kernel=%s\n" "$(uname -sr)"
   printf "os=%s\n" "$(. /etc/os-release && printf "%s %s" "$ID" "${VERSION_ID:-unknown}")"
   printf "disk=%s\n" "$(df -Pk / | awk "NR==2 {print \$4}")KB-free"
   command -v nginx >/dev/null && echo nginx=present || echo nginx=missing
   command -v systemctl >/dev/null && echo systemd=present || echo systemd=missing
   test -r /proc/loadavg && echo proc=readable
   test -r /proc/meminfo && echo memory=readable
   if ss -ltn "sport = :8080" 2>/dev/null | grep -q LISTEN; then
     echo port8080=occupied
   else
     echo port8080=available
   fi'
