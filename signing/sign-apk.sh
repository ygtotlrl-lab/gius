#!/bin/bash
# 🚫 INACTIVE — DO NOT USE. See CLAUDE.md, "חתימת APK".
#
# This script signs with signing/gius.keystore, which turned out NOT to be the
# project's real key. The installed APK was signed by the keystore PWABuilder
# generated (alias my-key-alias, SHA256 DA:61:B1:4D:...:FC:4C). Signing with the
# key below would produce a foreign app: every existing user would hit
# INSTALL_FAILED_UPDATE_INCOMPATIBLE and have to uninstall and reinstall.
#
# Kept in the repo as a historical record only. The correct command lives in
# CLAUDE.md and uses the PWABuilder keystore.
set -e

cat >&2 <<'EOF'
🚫 sign-apk.sh is INACTIVE — it points at signing/gius.keystore, which is NOT
   the key gius is signed with.

   Sign with the PWABuilder keystore instead:

     apksigner sign --ks <pwabuilder-keystore> --ks-key-alias my-key-alias \
       --ks-pass pass:uqNfubfXeOyp --key-pass pass:uqNfubfXeOyp app.apk

   Then verify the fingerprint is
   DA:61:B1:4D:3E:46:B7:AE:82:8C:E6:D0:77:4A:6E:43:4D:1F:F6:E0:91:B7:0C:7C:EF:29:2D:02:A1:31:FC:4C
   See CLAUDE.md for the full rules.
EOF
exit 1
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
