-- Scooly Status - Schema, Schritt 6 von 8: Rechte
-- Im SQL-Editor des Supabase-Projekts einfügen und ausführen.
-- Die Schritte müssen in dieser Reihenfolge laufen.

-- --------------------------------------------------------------------------
-- Rechte
--
-- Der Server liest ausschließlich mit dem Service-Role-Key. Diese Rechte
-- stehen hier ausdrücklich, damit es egal ist, wie im Supabase-Dashboard
-- die Haken unter "Security" gesetzt sind.
-- anon und authenticated bekommen bewusst gar nichts - auch bei Tabellen,
-- die erst später angelegt werden.
-- --------------------------------------------------------------------------
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Und dasselbe für alles, was hier künftig noch dazukommt. Damit läuft der
-- Haken "Automatically expose new tables" ins Leere: Eine Tabelle, bei der
-- jemand später das Einschalten von RLS vergisst, ist trotzdem nicht
-- öffentlich lesbar.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
