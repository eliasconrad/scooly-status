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
  avg_response_ms  integer,                      -- Schnitt der geglückten Messungen
  max_response_ms  integer,                      -- langsamste Messung des Tages
  top_error        text,                         -- häufigster Fehlertext des Tages
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
  created_at  timestamptz not null default now(),
  notified_at timestamptz                    -- gesetzt, sobald verschickt
);
create index if not exists incident_updates_incident_idx on incident_updates (incident_id, created_at desc);

-- Nur die noch nicht verschickten interessieren den Wächter.
create index if not exists incident_updates_offen_idx
  on incident_updates (created_at)
  where notified_at is null;

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
  confirmed_at   timestamptz,
  mail_day       date,                       -- Tag des laufenden Kontingents
  mail_count     integer not null default 0  -- verbrauchte Meldungen an diesem Tag
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

alter table daily_uptime
  add column if not exists avg_response_ms integer,   -- Schnitt der geglückten Messungen
  add column if not exists max_response_ms integer,   -- langsamste Messung des Tages
  add column if not exists top_error       text;      -- häufigster Fehlertext des Tages

-- --------------------------------------------------------------------------
-- Die Tagesbilanz wird ab jetzt in der Datenbank gerechnet, nicht mehr in
-- der Anwendung.
--
-- Grund: Der Wächter musste die Messungen zeilenweise holen, um Schnitt und
-- häufigsten Fehler zu bestimmen. Supabase liefert höchstens 1000 Zeilen -
-- bei einem Minutentakt wären es 1440 am Tag und die Bilanz wäre still
-- falsch. Hier rechnet Postgres über alle Zeilen, egal wie viele.
-- --------------------------------------------------------------------------
create or replace function rollup_day(
  p_slug             text,
  p_day              date,
  p_interval_minutes integer default 5
) returns void
language plpgsql
as $$
declare
  v_von      timestamptz := (p_day::text || ' 00:00:00')::timestamp at time zone 'UTC';
  v_bis      timestamptz := v_von + interval '1 day';
  v_checks   integer;
  v_failed   integer;
  v_degraded integer;
  v_avg      integer;
  v_max      integer;
  v_error    text;
  v_uptime   numeric;
begin
  select count(*),
         count(*) filter (where not ok),
         count(*) filter (where ok and degraded),
         round(avg(response_ms) filter (where ok))::integer,
         max(response_ms) filter (where ok)
    into v_checks, v_failed, v_degraded, v_avg, v_max
    from checks
   where service_slug = p_slug
     and checked_at >= v_von
     and checked_at <  v_bis;

  -- Häufigster Fehlertext des Tages - der sagt mehr als eine Zahl.
  select error
    into v_error
    from checks
   where service_slug = p_slug
     and checked_at >= v_von
     and checked_at <  v_bis
     and error is not null
   group by error
   order by count(*) desc, max(checked_at) desc
   limit 1;

  -- Beeinträchtigte Messungen zählen halb: erreichbar, aber zäh.
  v_uptime := case
                when coalesce(v_checks, 0) = 0 then 1
                else (v_checks - v_failed - v_degraded * 0.5)::numeric / v_checks
              end;

  insert into daily_uptime (service_slug, day, checks, failed, degraded, uptime,
                            downtime_minutes, degraded_minutes,
                            avg_response_ms, max_response_ms, top_error)
  values (p_slug, p_day, coalesce(v_checks,0), coalesce(v_failed,0), coalesce(v_degraded,0),
          round(v_uptime, 6),
          coalesce(v_failed,0) * p_interval_minutes,
          coalesce(v_degraded,0) * p_interval_minutes,
          v_avg, v_max, v_error)
  on conflict (service_slug, day) do update set
    checks           = excluded.checks,
    failed           = excluded.failed,
    degraded         = excluded.degraded,
    uptime           = excluded.uptime,
    downtime_minutes = excluded.downtime_minutes,
    degraded_minutes = excluded.degraded_minutes,
    avg_response_ms  = excluded.avg_response_ms,
    max_response_ms  = excluded.max_response_ms,
    top_error        = excluded.top_error;
end;
$$;

-- Nur der Server darf sie aufrufen.
revoke all on function rollup_day(text, date, integer) from public, anon, authenticated;
grant execute on function rollup_day(text, date, integer) to service_role;

-- --------------------------------------------------------------------------
-- Zählt das Tageskontingent hoch und sagt, ob noch etwas übrig war.
--
-- Rückgabe:  0 = Kontingent aufgebraucht, es darf nichts raus
--            1 = erste Meldung des Tages
--            2 = zweite und damit letzte des Tages
--
-- Prüfen und Hochzählen passieren in EINER Anweisung. Getrennt gemacht
-- könnten zwei gleichzeitige Durchläufe beide "ist noch frei" lesen und
-- eine dritte Mail durchlassen. Die Bedingung steht deshalb im WHERE:
-- Trifft sie nicht zu, wird keine Zeile geändert und es kommt NULL zurück.
-- --------------------------------------------------------------------------
create or replace function mail_kontingent(
  p_email  text,
  p_grenze integer default 2
) returns integer
language plpgsql
as $$
declare
  v_zaehler integer;
begin
  update subscribers
     set mail_day   = current_date,
         mail_count = case when mail_day = current_date then mail_count + 1 else 1 end
   where email = p_email
     and (mail_day is distinct from current_date or mail_count < p_grenze)
  returning mail_count into v_zaehler;

  return coalesce(v_zaehler, 0);
end;
$$;

revoke all on function mail_kontingent(text, integer) from public, anon, authenticated;
grant execute on function mail_kontingent(text, integer) to service_role;

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
  ('scooly-ki',          'Scooly KI (Aufgaben, Quiz, Karteikarten)', 'https://scooly.dev/api/health/ki',       12000,  4),
  ('scooly-handschrift', 'Handschrift-Erkennung',         'https://scooly.dev/api/health/ocr',      15000,  5),
  ('scooly-daten',       'Datenbank & Dateien',           'https://scooly.dev/api/health/db',        2000,  6)
on conflict (slug) do nothing;
