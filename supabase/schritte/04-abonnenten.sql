-- Scooly Status - Schema, Schritt 4 von 8: Abonnenten
-- Im SQL-Editor des Supabase-Projekts einfügen und ausführen.
-- Die Schritte müssen in dieser Reihenfolge laufen.

-- --------------------------------------------------------------------------
-- Abonnenten
-- --------------------------------------------------------------------------
create table if not exists subscribers (
  id             uuid primary key default gen_random_uuid(),
  email          text unique not null,
  token          text not null,             -- Bestätigungsschlüssel
  unsubscribe    text not null,             -- Abmeldeschlüssel, bleibt gültig
  confirmed      boolean not null default false,
  created_at     timestamptz not null default now(),
  confirmed_at   timestamptz
);
