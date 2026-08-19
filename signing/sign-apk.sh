#!/bin/bash
# Sign an APK with the PERMANENT gius key — signing/gius.keystore.
#
# ⚠️ המפתח הוחלף ב-2026-08-19 (סבב 39), בהחלטת המנהל. הטביעה הישנה
# (DA:61:B1:4D…, pwabuilder.keystore) אינה בשימוש עוד, ושני קובצי ה-keystore
# הקודמים נמחקו. APK שנחתם במפתח החדש ⛔ אינו מתקין על גבי התקנה קיימת —
# נדרשת הסרה והתקנה מחדש, פעם אחת.
#
# מכאן והלאה זה המפתח היחיד: חתימה בכל מפתח אחר מייצרת אפליקציה זרה, וכל
# המשתמשים ייתקלו ב-INSTALL_FAILED_UPDATE_INCOMPATIBLE. ר' CLAUDE.md, "חתימת APK".
#
# Requires Android build-tools on PATH (zipalign + apksigner).
# Usage: ./sign-apk.sh <unsigned.apk> [output.apk]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
KS="$HERE/gius.keystore"
ALIAS='gius'
PASS='gius123'
EXPECTED_SHA256='92:33:21:96:75:17:2D:54:91:35:12:1D:64:46:A6:74:E0:E2:0C:24:9F:68:4A:C3:FA:A2:B7:CC:B8:D3:81:7D'

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
# apksigner prints the digest lowercase and WITHOUT colons ("923321…"), while
# keytool prints it uppercase WITH colons — so both sides get normalised before
# comparing. Matching the colon form against apksigner output never succeeds.
normalise() { tr -d ':' | tr 'A-Z' 'a-z'; }
WANT="$(printf '%s' "$EXPECTED_SHA256" | normalise)"
GOT="$(apksigner verify --print-certs "$OUT" \
       | grep -i 'SHA-256 digest' | head -1 | awk '{print $NF}' | normalise)"
if [ "$WANT" != "$GOT" ]; then
  echo "❌ signed APK does not carry the expected certificate!" >&2
  echo "   expected: $WANT" >&2
  echo "   actual:   $GOT" >&2
  exit 1
fi

echo "✅ Signed with the permanent gius key -> $OUT"
echo "   SHA256 $EXPECTED_SHA256"
