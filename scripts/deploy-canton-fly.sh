#!/usr/bin/env bash
# Sandbox-as-deployer: provisions a Canton 3.4 participant on Fly.io that
# trusts JWTs signed with our own RS256 keypair. The Lovable Cloud backend
# mints short-lived (5 min) tokens with the private key; Canton verifies
# them with the public certificate baked into its config.
#
# Emits three secrets for Project Settings → Secrets:
#   CANTON_JSON_API_URL       — base URL of the JSON API
#   CANTON_JWT_PRIVATE_KEY    — RSA private key (base64-encoded PEM)
#   DEPLOY_ADMIN_TOKEN        — random shared secret guarding /deploy
#
# Prereqs (you):
#   /tmp/fly.txt   — your FlyV1 token (paste each turn; sandbox is ephemeral)
set -euo pipefail

FLY_API_TOKEN="$(cat /tmp/fly.txt 2>/dev/null || true)"
: "${FLY_API_TOKEN:?paste your FlyV1 token to /tmp/fly.txt first}"
export FLY_API_TOKEN

FLY_REGION="${FLY_REGION:-lhr}"
SHORT_ID="$(echo -n "$FLY_API_TOKEN" | sha256sum | head -c 6)"
APP_NAME="${APP_NAME:-nhs-canton-${SHORT_ID}}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLY_ASSETS="${REPO_ROOT}/docs/canton-deploy/assets/fly"
SHARED_ASSETS="${REPO_ROOT}/docs/canton-deploy/assets"
DAR_PATH="${REPO_ROOT}/daml/dist/nhs-budget-0.1.0.dar"
OUT_DIR="/mnt/documents"
mkdir -p "$OUT_DIR" 2>/dev/null || true

# 1) flyctl
FLYCTL_DIR="/root/.fly"
export FLYCTL_INSTALL="$FLYCTL_DIR"
export PATH="${FLYCTL_DIR}/bin:$PATH"
if ! command -v flyctl >/dev/null 2>&1; then
  echo "→ installing flyctl"
  curl -sSLf https://fly.io/install.sh | sh >/dev/null
fi
flyctl version | head -1

# 2) random shared secret for /deploy
rand_hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
DEPLOY_ADMIN_TOKEN="$(rand_hex 32)"

# 3) keypair (idempotent; reuse persisted copy at /mnt/documents/canton-jwt/)
KEY_DIR="${OUT_DIR}/canton-jwt"
mkdir -p "$KEY_DIR"
KEY_PEM="${KEY_DIR}/jwt-private.pem"
CRT_PEM="${KEY_DIR}/jwt-public.crt"
if [ ! -s "$KEY_PEM" ] || [ ! -s "$CRT_PEM" ]; then
  echo "→ generating fresh RSA-2048 keypair + self-signed cert"
  python3 -m pip install -q cryptography 2>&1 | tail -1 || true
  python3 - <<PY
import datetime
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "canton-jwt")])
now = datetime.datetime.utcnow()
cert = (
    x509.CertificateBuilder()
    .subject_name(subject).issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now - datetime.timedelta(minutes=5))
    .not_valid_after(now + datetime.timedelta(days=3650))
    .sign(key, hashes.SHA256())
)
Path("${KEY_PEM}").write_bytes(key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
))
Path("${CRT_PEM}").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
PY
else
  echo "→ reusing existing keypair from ${KEY_DIR}"
fi
PRIVATE_KEY_B64="$(base64 -w0 < "$KEY_PEM")"

# 4) stage build context
STAGE="$(mktemp -d -t canton-fly-XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT

cp "${FLY_ASSETS}/Dockerfile" "${STAGE}/Dockerfile"
cp "${SHARED_ASSETS}/canton.conf" "${STAGE}/canton.conf"
cp "${SHARED_ASSETS}/bootstrap.canton" "${STAGE}/bootstrap.canton" 2>/dev/null || true
cp "$CRT_PEM" "${STAGE}/jwt-public.crt"
mkdir -p "${STAGE}/dars"
[ -f "$DAR_PATH" ] && cp "$DAR_PATH" "${STAGE}/dars/" || \
  echo "! ${DAR_PATH} missing — upload via /deploy later"

sed -e "s|__APP_NAME__|${APP_NAME}|g" -e "s|__REGION__|${FLY_REGION}|g" \
  "${FLY_ASSETS}/fly.toml.template" > "${STAGE}/fly.toml"

# 5) create or reuse app, drop obsolete secrets
cd "$STAGE"
if ! flyctl status -a "$APP_NAME" >/dev/null 2>&1; then
  echo "→ creating app ${APP_NAME} in ${FLY_REGION}"
  flyctl apps create "$APP_NAME" ${FLY_ORG:+--org "$FLY_ORG"}
fi

flyctl secrets unset CANTON_AUTH_SECRET -a "$APP_NAME" 2>/dev/null || true

echo "→ destroying any pre-existing machines"
flyctl machines list -a "$APP_NAME" --json 2>/dev/null \
  | grep -oE '"id":\s*"[a-z0-9]+"' | awk -F'"' '{print $4}' \
  | while read -r mid; do
      [ -n "$mid" ] && flyctl machines destroy "$mid" -a "$APP_NAME" --force || true
    done

echo "→ deploying (4 GB / 2 shared CPUs — Canton needs ≥3 GB headroom)"
flyctl deploy -a "$APP_NAME" --vm-memory 4096 --vm-cpus 2 --remote-only --yes

# Belt-and-braces: ensure existing machines are resized too.
flyctl scale memory 4096 -a "$APP_NAME" --yes 2>/dev/null || true

# Canton is stateful — pin to exactly one machine. Running 2+ creates
# independent participants and party allocations diverge.
echo "→ pinning to a single machine (Canton is stateful)"
flyctl scale count 1 -a "$APP_NAME" --yes 2>/dev/null || true

URL="https://${APP_NAME}.fly.dev"

# 6) wait for JSON API readiness (401 on unauth = ready)
echo "→ waiting for ${URL}/v2/state/ledger-end"
code=000
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${URL}/v2/state/ledger-end" || echo 000)
  [ "$code" = "401" ] || [ "$code" = "200" ] && { echo "  ready (${code})"; break; }
  sleep 5
done
if [ "$code" != "401" ] && [ "$code" != "200" ]; then
  echo "! participant didn't come up (status ${code}). Recent logs:"
  flyctl logs -a "$APP_NAME" --no-tail | tail -n 80 || true
  exit 1
fi

# 7) mint a local admin JWT and verify Canton accepts it
echo "→ minting test admin JWT and verifying Canton accepts it"
ADMIN_JWT="$(python3 - <<PY
import base64, json, time
from pathlib import Path
try:
    import jwt
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "PyJWT[crypto]"])
    import jwt
key = Path("${KEY_PEM}").read_text()
now = int(time.time())
tok = jwt.encode(
    {
        "sub": "participant_admin",
        "aud": "canton-ledger-api",
        "scope": "daml_ledger_api daml_ledger_api.admin",
        "participantAdmin": True,
        "iat": now,
        "exp": now + 300,
    },
    key,
    algorithm="RS256",
)
print(tok)
PY
)"

auth_code=$(curl -s -o /tmp/cantonresp.txt -w "%{http_code}" \
  -H "Authorization: Bearer ${ADMIN_JWT}" \
  "${URL}/v2/state/ledger-end")
if [ "$auth_code" != "200" ]; then
  echo "! Canton rejected our admin JWT (status ${auth_code})."
  echo "  Response body:"; head -c 800 /tmp/cantonresp.txt; echo
  echo "  Recent Canton logs:"
  flyctl logs -a "$APP_NAME" --no-tail | tail -n 80 || true
  exit 1
fi
echo "  ✓ Canton returned 200"

# 8) write secrets file + print
{
  echo "# Generated $(date -u +%FT%TZ) by scripts/deploy-canton-fly.sh"
  echo "CANTON_JSON_API_URL=${URL}"
  echo "CANTON_JWT_PRIVATE_KEY=${PRIVATE_KEY_B64}"
  echo "DEPLOY_ADMIN_TOKEN=${DEPLOY_ADMIN_TOKEN}"
} > "${OUT_DIR}/canton-secrets.txt" 2>/dev/null || true

echo
echo "════════════════════════════════════════════════════════════════"
echo " Paste these into Project Settings → Secrets:"
echo "════════════════════════════════════════════════════════════════"
echo "CANTON_JSON_API_URL     = ${URL}"
echo "CANTON_JWT_PRIVATE_KEY  = (base64 PEM, ${#PRIVATE_KEY_B64} chars) — see ${OUT_DIR}/canton-secrets.txt"
echo "DEPLOY_ADMIN_TOKEN      = ${DEPLOY_ADMIN_TOKEN}"
echo "────────────────────────────────────────────────────────────────"
echo "Saved to ${OUT_DIR}/canton-secrets.txt"
echo "Keypair persisted at ${KEY_DIR}/ (re-runs reuse it)"
echo
echo "Next: open /deploy, paste DEPLOY_ADMIN_TOKEN, click 'Deploy now'"
