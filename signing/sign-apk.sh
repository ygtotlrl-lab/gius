#!/bin/bash
# Sign an APK with the PERMANENT gius key — signing/pwabuilder.keystore.
#
# This is the keystore PWABuilder generated when it built the APK, and it is the
# key every installed copy of gius is signed with. Signing with any other key
# produces a foreign app: existing users hit INSTALL_FAILED_UPDATE_INCOMPATIBLE
# and have to uninstall and reinstall. See CLAUDE.md, "חתימת APK".
#
# signing/gius.keystore is the old hand-made key and is NOT used. Never sign with it.
#
# Requires Android build-tools on PATH (zipalign + apksigner).
# Usage: ./sign-apk.sh <unsigned.apk> [output.apk]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
KS="$HERE/pwabuilder.keystore"
ALIAS='my-key-alias'
PASS='uqNfubfXeOyp'
EXPECTED_SHA256='DA:61:B1:4D:3E:46:B7:AE:82:8C:E6:D0:77:4A:6E:43:4D:1F:F6:E0:91:B7:0C:7C:EF:29:2D:02:A1:31:FC:4C'

IN="${1:?usage: sign-apk.sh <unsigned.apk> [output.apk]}"
OUT="${2:-gius-signed.apk}"
ALIGNED="${OUT%.apk}-aligned.apk"

for tool in zipalign apksigner; do
  command -v "$tool" >/dev/null || { echo "❌ $tool not on PATH (Android build-tools)" >&2; exit 1; }
done
[ -f "$KS" ] || { echo "❌ missing keystore: $KS" >&2; exit 1; }

# Fail before touching the APK if the keystore is not the key we expect. A wrong
# key here is unrecoverable for every existing install, so this is a hard gate.
if ! keytool -list -v -keystore "$KS" -storepass "$PASS" 2>/dev/null \
     | grep -qF "SHA256: $EXPECTED_SHA256"; then
  echo "❌ keystore fingerprint does NOT match the expected key. Refusing to sign." >&2
  echo "   expected SHA256: $EXPECTED_SHA256" >&2
  exit 1
fi

# zipalign must run before apksigner — apksigner preserves alignment, zipalign
# after signing would invalidate the v2/v3 signature.
zipalign -p -f 4 "$IN" "$ALIGNED"
apksigner sign \
  --ks "$KS" --ks-key-alias "$ALIAS" \
  --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$OUT" "$ALIGNED"
rm -f "$ALIGNED"

apksigner verify --print-certs "$OUT"

# Verify what actually landed in the APK, not just what we asked for.
if ! apksigner verify --print-certs "$OUT" | grep -qiF "$EXPECTED_SHA256"; then
  echo "❌ signed APK does not carry the expected certificate!" >&2
  exit 1
fi

echo "✅ Signed with the permanent gius key -> $OUT"
echo "   SHA256 $EXPECTED_SHA256"
echo "   This must stay identical to .well-known/assetlinks.json, or the TWA"
echo "   loses ownership verification and opens as a browser."
