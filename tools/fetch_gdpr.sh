#!/usr/bin/env bash
# Downloads the authentic Official Journal rendition of Regulation (EU) 2016/679 in the 24 official EU languages
# from the EU Publications Office (Cellar) into tools/source/gdpr/. Then run: python -X utf8 -I tools/extract_gdpr.py
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p source/gdpr && cd source/gdpr
CELLAR="https://publications.europa.eu/resource/cellar/3e485e15-11bd-11e6-ba9a-01aa75ed71a1"
for l in bul spa ces dan deu est ell eng fra gle hrv ita lav lit hun mlt nld pol por ron slk slv fin swe; do
  curl -fsSL -o "$l.xhtml" -H "Accept: application/xhtml+xml" -H "Accept-Language: $l" "$CELLAR"
  echo "$l $(wc -c < "$l.xhtml") bytes"
done
