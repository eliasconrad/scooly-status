-- Scooly Status - Schema, Schritt 3 von 8: Vorfälle und Meldungen
-- Im SQL-Editor des Supabase-Projekts einfügen und ausführen.
-- Die Schritte müssen in dieser Reihenfolge laufen.

-- --------------------------------------------------------------------------
-- Vorfälle
-- --------------------------------------------------------------------------
create table if not exists incidents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  impact        text not null default 'minor'
                check (impact in ('none','maintenance','minor','major','critical')),
  status        text not null default 'investigating',
  started_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  automatic     boolean not null default false,
  service_slugs text[] not null default '{}'
);
create index if not exists incidents_started_idx on incidents (started_at desc);
create index if not exists incidents_open_idx on incidents (resolved_at) where resolved_at is null;

create table if not exists incident_updates (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  status      text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists incident_updates_incident_idx on incident_updates (incident_id, created_at desc);
