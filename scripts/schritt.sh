#!/bin/sh
# Legt einen Schema-Schritt in die Zwischenablage.
#   ./scripts/schritt.sh 3
verzeichnis="$(dirname "$0")/../supabase/schritte"
datei=$(ls "$verzeichnis" | grep "^0*$1-" | head -1)
if [ -z "$datei" ]; then
  echo "Kein Schritt $1. Vorhanden:"
  ls "$verzeichnis" | sed 's/^/  /'
  exit 1
fi
pbcopy < "$verzeichnis/$datei"
echo "In der Zwischenablage: $datei"
