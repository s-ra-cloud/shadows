---
name: PDF OCR environment
description: Which PDF/OCR binaries exist in this Replit env and how they were provisioned.
---
- `pdftoppm` and `pdfinfo` (poppler) are already on PATH via the Replit runtime path — no install needed.
- `tesseract` is NOT preinstalled; install the nix system dependency `tesseract` (the name `poppler-utils` does not exist in the nix index).
- ImageMagick (`magick`) is on PATH but needs an explicit `-font <path>` (find one via `fc-list`) to render text — handy for fabricating image-only test PDFs.
**Why:** rediscovering which binaries exist cost time; installs reboot workflows.
**How to apply:** any OCR/PDF tooling work — check PATH first, only install tesseract.
