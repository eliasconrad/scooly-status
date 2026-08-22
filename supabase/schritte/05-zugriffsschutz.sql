-- Scooly Status - Schema, Schritt 5 von 8: Zugriffsschutz (RLS)
-- Im SQL-Editor des Supabase-Projekts einfügen und ausführen.
-- Die Schritte müssen in dieser Reihenfolge laufen.

-- --------------------------------------------------------------------------
-- Zugriff: die Seite liest ausschließlich über den Service-Role-Key im Server.
-- Anonyme Zugriffe werden komplett gesperrt.
-- --------------------------------------------------------------------------
alter table services         enable row level security;
alter table checks           enable row level security;
alter table daily_uptime     enable row level security;
alter table incidents        enable row level security;
alter table incident_updates enable row level security;
alter table subscribers      enable row level security;
