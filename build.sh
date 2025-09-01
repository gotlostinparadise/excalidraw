#!/usr/bin/env bash
set -euo pipefail

# Defaults
HOSTS="localhost,127.0.0.1"
OUT_DIR="conf"
DAYS=825
RSA_BITS=2048
FORCE=0
COMPOSE_ARGS=""

usage() {
  cat <<EOF
Usage: $0 [options] [-- <docker-compose-args>]

Options:
  --hosts "h1,h2,ip3"   Comma-separated DNS/IPs for SAN (default: ${HOSTS})
  --out DIR             Output directory for certs (default: ${OUT_DIR})
  --days N              Validity days (default: ${DAYS})
  --rsa-bits N          RSA key size (default: ${RSA_BITS})
  --force               Regenerate even if files exist
  -h, --help            Show help

Example:
  $0 --hosts "dev.local,localhost,127.0.0.1" --out conf
EOF
}

# Parse args
while [[ ${1:-} ]]; do
  case "$1" in
    --hosts) HOSTS="$2"; shift 2;;
    --out) OUT_DIR="$2"; shift 2;;
    --days) DAYS="$2"; shift 2;;
    --rsa-bits) RSA_BITS="$2"; shift 2;;
    --force) FORCE=1; shift;;
    -h|--help) usage; exit 0;;
    --) shift; COMPOSE_ARGS="$*"; break;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

mkdir -p "$OUT_DIR"
CRT="$OUT_DIR/site.crt"
KEY="$OUT_DIR/site.key"
CSR="$OUT_DIR/site.csr"

# Guard against accidental directories from previous bad mounts
for p in "$CRT" "$KEY"; do
  if [[ -d "$p" ]]; then
    echo "ERROR: $p is a directory; remove it and rerun (it must be a file)"; exit 1
  fi
done

need_gen=0
if [[ $FORCE -eq 1 || ! -s "$CRT" || ! -s "$KEY" ]]; then
  need_gen=1
fi

gen_with_openssl() {
  echo ">> Generating self-signed cert for hosts: $HOSTS"
  TMP_CONF="$(mktemp)"
  # Clean temp on exit of the whole script
  trap 'rm -f "$TMP_CONF"' EXIT

  # Prepare SAN entries
  DNS_IDX=1
  IP_IDX=1
  SAN_LINES=()
  IFS=',' read -ra H <<<"$HOSTS"
  for h in "${H[@]}"; do
    if [[ "$h" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
      SAN_LINES+=("IP.${IP_IDX} = ${h}")
      IP_IDX=$((IP_IDX+1))
    else
      SAN_LINES+=("DNS.${DNS_IDX} = ${h}")
      DNS_IDX=$((DNS_IDX+1))
    fi
  done

  cat > "$TMP_CONF" <<EOF
[ req ]
prompt             = no
default_md         = sha256
req_extensions     = req_ext
distinguished_name = dn

[ dn ]
CN = ${H[0]}

[ req_ext ]
subjectAltName = @alt_names

[ alt_names ]
$(printf "%s\n" "${SAN_LINES[@]}")
EOF

  # Private key (OpenSSL 3 friendly)
  openssl genpkey -algorithm RSA -pkeyopt "rsa_keygen_bits:${RSA_BITS}" -out "$KEY"

  # CSR
  openssl req -new -key "$KEY" -out "$CSR" -config "$TMP_CONF"

  # Self-signed cert
  openssl x509 -req -days "${DAYS}" -in "$CSR" -signkey "$KEY" \
    -out "$CRT" -extensions req_ext -extfile "$TMP_CONF"

  chmod 600 "$KEY"
  chmod 644 "$CRT"

  echo ">> Subject CN: ${H[0]}"
}

if [[ $need_gen -eq 1 ]]; then
  gen_with_openssl
else
  echo ">> Existing cert/key found at ${CRT} and ${KEY}; use --force to regenerate."
fi

# Verify SANs (more robust than grepping the text blob)
echo ">> Verifying certificate SANs..."
openssl x509 -in "$CRT" -noout -ext subjectAltName || true

# Check key <-> cert match via public key digest
echo ">> Verifying key and cert match..."
CERT_PUB_SHA=$(openssl x509 -in "$CRT" -noout -pubkey | openssl pkey -pubin -outform der | openssl sha256 | awk '{print $2}')
KEY_PUB_SHA=$(openssl pkey -in "$KEY" -pubout -outform der | openssl sha256 | awk '{print $2}')
if [[ "$CERT_PUB_SHA" != "$KEY_PUB_SHA" ]]; then
  echo "!! ERROR: key and certificate public keys do not match"
  exit 2
fi

echo ">> Certs ready:"
echo "   CRT: $CRT"
echo "   KEY: $KEY"

# Start docker compose
echo ">> Running: docker compose up --build ${COMPOSE_ARGS}"
docker compose up --build ${COMPOSE_ARGS}
