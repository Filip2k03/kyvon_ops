#!/usr/bin/env sh
# ==============================================================================
# KyvonOPS Node Provisioner & Low-Privilege Discovery Probe
# Target: POSIX Compliant Linux (Debian, Ubuntu, RHEL, Rocky, Alpine, Arch, SUSE)
# ==============================================================================

set -eu

AGENT_VERSION="2.0.0"
BASE_DIR="/opt/kyvon"
FALLBACK_DIR="${HOME}/.kyvon"
LOG_PREFIX="[KYVON-BOOTSTRAP]"

echo "${LOG_PREFIX} Initiating infrastructure assessment..."

# 1. Architecture Identification
ARCH=$(uname -m)
case "${ARCH}" in
    x86_64|amd64) TARGET_ARCH="x86_64" ;;
    aarch64|arm64) TARGET_ARCH="aarch64" ;;
    armv7l)       TARGET_ARCH="armv7" ;;
    *) echo "${LOG_PREFIX} Error: Unsupported architecture ${ARCH}" >&2; exit 1 ;;
esac

# 2. Kernel & OS Matrix Detection
OS="unknown"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS="${ID:-unknown}"
fi
echo "${LOG_PREFIX} Detected OS: ${OS}, Arch: ${TARGET_ARCH}, Kernel: $(uname -r)"

# 3. Path & Privilege Elevation Validation
INSTALL_PATH="${BASE_DIR}"
if [ "$(id -u)" -ne 0 ]; then
    echo "${LOG_PREFIX} Non-root execution. Re-routing runtime to user space: ${FALLBACK_DIR}"
    INSTALL_PATH="${FALLBACK_DIR}"
fi

mkdir -p "${INSTALL_PATH}/bin" "${INSTALL_PATH}/run" "${INSTALL_PATH}/logs"
chmod 700 "${INSTALL_PATH}"

# 4. Fallback Inline Agent Creation (Embedded POSIX Collector)
cat << 'EOF' > "${INSTALL_PATH}/bin/kyvon-collector.sh"
#!/bin/sh
set -eu
LC_ALL=C

M='%%KYVON/1'
INTERVAL=${KYVON_INTERVAL:-1}

now_ms() {
    date +%s000
}

stream_metrics() {
    echo "$M HELLO $(hostname)|$(uname -r)|$(uname -m)"
    SEQ=0
    while true; do
        echo "$M TICK $(now_ms) $SEQ"
        echo "$M SEC stat"
        cat /proc/stat
        echo "$M SEC meminfo"
        cat /proc/meminfo
        echo "$M SEC loadavg"
        cat /proc/loadavg
        echo "$M SEC net"
        cat /proc/net/dev
        echo "$M END"
        SEQ=$((SEQ + 1))
        sleep "$INTERVAL"
    done
}

stream_metrics
EOF

chmod +x "${INSTALL_PATH}/bin/kyvon-collector.sh"

echo "${LOG_PREFIX} Bootstrap completed successfully. Collector ready at ${INSTALL_PATH}/bin/kyvon-collector.sh"
