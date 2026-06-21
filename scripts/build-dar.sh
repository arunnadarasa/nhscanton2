#!/usr/bin/env bash
# Build daml/Nhs.daml → daml/dist/nhs-budget-0.1.0.dar inside the Lovable sandbox.
# Works because the sandbox has nix + curl + 126 GB /tmp. The runtime workerd
# can't do this; the sandbox can.
#
# Usage:  bash scripts/build-dar.sh
# Output: daml/dist/nhs-budget-0.1.0.dar  (also copied to /mnt/documents/)
set -euo pipefail

DPM_VERSION="${DPM_VERSION:-3.5.1}"
DPM_ROOT="/tmp/dpm-${DPM_VERSION}"
DPM_BIN="${DPM_ROOT}/linux-amd64/bin/dpm"

if [ ! -x "$DPM_BIN" ]; then
  echo "→ installing dpm ${DPM_VERSION} to ${DPM_ROOT}"
  ARCH="$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')"
  OS="$(uname | tr '[:upper:]' '[:lower:]')"
  TARBALL="dpm-${DPM_VERSION}-${OS}-${ARCH}.tar.gz"
  mkdir -p "$DPM_ROOT"
  curl -sSLf "https://get.digitalasset.com/install/dpm-sdk/${TARBALL}" \
    -o "/tmp/${TARBALL}"
  tar -xzf "/tmp/${TARBALL}" -C "$DPM_ROOT"
fi

export PATH="${DPM_ROOT}/linux-amd64/bin:$PATH"

# Pull SDK components on first run (idempotent; cached in ~/.dpm)
dpm install "$DPM_VERSION" >/dev/null 2>&1 || true

cd "$(dirname "$0")/../daml"
dpm build

mkdir -p dist
cp .daml/dist/nhs-budget-*.dar dist/
if [ -d /mnt/documents ]; then cp dist/nhs-budget-*.dar /mnt/documents/; fi

echo "✓ built: $(ls -lh dist/nhs-budget-*.dar | awk '{print $9, $5}')"
