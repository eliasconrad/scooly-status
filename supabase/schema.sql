-- Scooly Status - Schema
-- Eigene Supabase-Instanz, bewusst getrennt von der von Scooly.
-- Einmal im SQL-Editor der neuen Instanz ausführen.

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Dienste
-- --------------------------------------------------------------------------
create table if not exists services (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  probe_url   text,                        -- null = wird nur von Hand gepflegt
  degraded_ms integer not null default 3000,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  status      text not null default 'operational'
              check (status in ('operational','degraded_performance','partial_outage',
                                'major_outage','under_maintenance')),
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Rohmessungen
-- --------------------------------------------------------------------------
create table if not exists checks (
  id           bigserial primary key,
  service_slug text not null references services(slug) on delete cascade,
  checked_at   timestamptz not null default now(),
  ok           boolean not null,
  degraded     boolean not null default false,
  status_code  integer,
  response_ms  integer,
  error        text
);
create index if not exists checks_service_time_idx
  on checks (service_slug, checked_at desc);

-- --------------------------------------------------------------------------
-- Tagesbilanz - das, was die 90-Tage-Leiste zeichnet
-- --------------------------------------------------------------------------
create table if not exists daily_uptime (
  service_slug     text not null references services(slug) on delete cascade,
  day              date not null,
  checks           integer not null default 0,
  failed           integer not null default 0,
  degraded         integer not null default 0,
  uptime           numeric(9,6) not null default 1,
  downtime_minutes integer not null default 0,   -- Minuten ohne Antwort
  degraded_minutes integer not null default 0,   -- Minuten über dem Grenzwert
  primary key (service_slug, day)
);

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

-- --------------------------------------------------------------------------
-- Rechte
--
-- Der Server liest ausschließlich mit dem Service-Role-Key. Diese Rechte
-- stehen hier ausdrücklich, damit es egal ist, wie im Supabase-Dashboard
-- der Haken "Automatically expose new tables" gesetzt ist.
-- anon und authenticated bekommen bewusst gar nichts.
-- --------------------------------------------------------------------------
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

revoke all on all tables in schema public from anon, authenticated;

-- --------------------------------------------------------------------------
-- Aufräumen: Rohmessungen älter als 120 Tage brauchen wir nicht mehr,
-- die Tagesbilanz bleibt.
-- --------------------------------------------------------------------------
create or replace function prune_checks() returns void language sql as $$
  delete from checks where checked_at < now() - interval '120 days';
$$;

-- --------------------------------------------------------------------------
-- Startbelegung der Dienste. URLs anpassen!
-- --------------------------------------------------------------------------
insert into services (slug, name, probe_url, degraded_ms, sort_order) values
  ('scooly-web',         'Scooly (scooly.dev)',           'https://scooly.dev',                     2500,  1),
  ('scooly-anmeldung',   'Anmeldung & Konten',            'https://scooly.dev/api/health/auth',      2500,  2),
  ('scooly-app',         'Scooly App (iPhone & iPad)',    'https://scooly.dev/api/health/app',       3000,  3),
  ('scooly-ki',          'Aufgaben, Quiz & Karteikarten', 'https://scooly.dev/api/health/ki',       12000,  4),
  ('scooly-handschrift', 'Handschrift-Erkennung',         'https://scooly.dev/api/health/ocr',      15000,  5),
  ('scooly-daten',       'Datenbank & Dateien',           'https://scooly.dev/api/health/db',        2000,  6)
on conflict (slug) do nothing;
