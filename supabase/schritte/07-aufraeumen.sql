-- Scooly Status - Schema, Schritt 7 von 8: Aufräumfunktion
-- Im SQL-Editor des Supabase-Projekts einfügen und ausführen.
-- Die Schritte müssen in dieser Reihenfolge laufen.

-- --------------------------------------------------------------------------
-- Aufräumen: Rohmessungen älter als 120 Tage brauchen wir nicht mehr,
-- die Tagesbilanz bleibt.
-- --------------------------------------------------------------------------
create or replace function prune_checks() returns void language sql as $$
  delete from checks where checked_at < now() - interval '120 days';
$$;
