#!/bin/sh
# Typeset psalms.pdf from build/pdf.html with headless Chromium.
cd "$(dirname "$0")/.." || exit 1
chromium-browser --headless --disable-gpu \
  --virtual-time-budget=20000 \
  --no-pdf-header-footer \
  --print-to-pdf=psalms.pdf \
  build/pdf.html
