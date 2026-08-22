-- Scooly Status - Schema, Schritt 2 von 8: Rohmessungen und Tagesbilanz
-- Im SQL-Editor des Supabase-Projekts einfügen und ausführen.
-- Die Schritte müssen in dieser Reihenfolge laufen.

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
