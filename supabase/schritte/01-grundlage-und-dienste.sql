-- Scooly Status - Schema, Schritt 1 von 8: Grundlage und Dienste
-- Im SQL-Editor des Supabase-Projekts einfügen und ausführen.
-- Die Schritte müssen in dieser Reihenfolge laufen.

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
