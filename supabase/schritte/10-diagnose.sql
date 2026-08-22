-- Scooly Status - Nachtrag: genauere Diagnose
-- Im SQL-Editor einfügen und ausführen. Gefahrlos mehrfach ausführbar.
--
-- Bisher stand in der Tagesbilanz nur, WIE LANGE etwas kaputt war.
-- Jetzt auch, WAS kaputt war und WIE langsam es genau ging.

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
