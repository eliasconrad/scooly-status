#!/bin/sh
# Schreibt den Inhalt der Zwischenablage in .env.local, ohne ihn anzuzeigen.
#   ./scripts/setze.sh SUPABASE_URL
name="$1"
[ -z "$name" ] && { echo "Aufruf: ./scripts/setze.sh NAME_DER_VARIABLE"; exit 1; }

datei="$(dirname "$0")/../.env.local"
wert=$(pbpaste)
[ -z "$wert" ] && { echo "Die Zwischenablage ist leer."; exit 1; }

# Zeilenumbrüche entfernen, die beim Kopieren gerne mitkommen
wert=$(printf '%s' "$wert" | tr -d '\r\n')

touch "$datei"
# vorhandene Zeile ersetzen, sonst anhängen
if grep -q "^${name}=" "$datei" 2>/dev/null; then
  grep -v "^${name}=" "$datei" > "$datei.tmp" && mv "$datei.tmp" "$datei"
fi
printf '%s=%s\n' "$name" "$wert" >> "$datei"
chmod 600 "$datei"

laenge=${#wert}
anfang=$(printf '%s' "$wert" | cut -c1-6)
echo "$name gesetzt  (${laenge} Zeichen, beginnt mit '${anfang}…')"
