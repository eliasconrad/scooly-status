-- Scooly Status - Schema, Schritt 8 von 8: Startbelegung der Dienste
-- Im SQL-Editor des Supabase-Projekts einfügen und ausführen.
-- Die Schritte müssen in dieser Reihenfolge laufen.

-- --------------------------------------------------------------------------
-- Startbelegung der Dienste. URLs anpassen!
-- --------------------------------------------------------------------------
insert into services (slug, name, probe_url, degraded_ms, sort_order) values
  ('scooly-web',         'Scooly (scooly.dev)',           'https://scooly.dev',                     2500,  1),
  ('scooly-anmeldung',   'Anmeldung & Konten',            'https://scooly.dev/api/health/auth',      2500,  2),
  ('scooly-app',         'Scooly App (iPhone & iPad)',    'https://scooly.dev/api/health/app',       3000,  3),
  ('scooly-ki',          'Scooly KI (Aufgaben, Quiz, Karteikarten)', 'https://scooly.dev/api/health/ki',       12000,  4),
  ('scooly-handschrift', 'Handschrift-Erkennung',         'https://scooly.dev/api/health/ocr',      15000,  5),
  ('scooly-daten',       'Datenbank & Dateien',           'https://scooly.dev/api/health/db',        2000,  6)
on conflict (slug) do nothing;
