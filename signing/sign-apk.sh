#!/bin/bash
# Re-sign an APK with the PERMANENT gius key (signing/gius.keystore).
# Requires Android build-tools on PATH (zipalign + apksigner). Run wherever those exist.
# Usage: ./sign-apk.sh <unsigned.apk> [output.apk]
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
KS="$HERE/gius.keystore"
IN="${1:?usage: sign-apk.sh <unsigned.apk> [output.apk]}"
OUT="${2:-gius-signed.apk}"
ALIGNED="${OUT%.apk}-aligned.apk"

zipalign -p -f 4 "$IN" "$ALIGNED"
apksigner sign \
  --ks "$KS" --ks-key-alias gius \
  --ks-pass pass:gius123 --key-pass pass:gius123 \
  --out "$OUT" "$ALIGNED"
rm -f "$ALIGNED"
apksigner verify --print-certs "$OUT"
echo "✅ Signed with permanent key -> $OUT"
