-- Scooly Status - Nachtrag: Bremse gegen massenhaftes Eintragen
-- Im SQL-Editor einfügen und ausführen. Gefahrlos mehrfach ausführbar.
--
-- WARUM DAS NÖTIG WURDE: /api/subscribe ist offen - es muss offen sein, sonst
-- kann sich niemand eintragen. Die vorhandene Sperrfrist gilt aber je ADRESSE:
-- Sie verhindert, dass jemand einer fremden Adresse zwanzig Bestätigungsmails
-- schickt. Sie verhindert NICHT, dass jemand zwanzigtausend verschiedene
-- Adressen einträgt. Jede davon wäre eine echte Mail von status@scooly.dev -
-- das kostet Resend-Kontingent und beschädigt den Ruf der Absenderdomain,
-- bis Mails von Scooly generell im Spam landen.
--
-- WARUM NUR EIN HASH DER IP: Die IP selbst wird nicht gebraucht, nur die
-- Frage "schon wieder derselbe?". Gespeichert wird sha256(IP + Salz); ohne
-- das Salz ist der Hash nicht zurückzurechnen (bei IPv4 wären es sonst nur
-- vier Milliarden Möglichkeiten, also Sekunden).

create table if not exists abo_versuche (
  ip_hash text primary key,
  stunde  timestamptz not null,
  anzahl  integer not null default 0
);

alter table abo_versuche enable row level security;
revoke all on table abo_versuche from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- Zählt die Versuche dieser Stunde hoch und sagt, ob noch etwas übrig war.
--
-- Rückgabe:  0 = Kontingent aufgebraucht
--          > 0 = der wievielte Versuch dieser Stunde es war
--
-- Prüfen und Hochzählen in EINER Anweisung, genau wie bei mail_kontingent:
-- Getrennt könnten zwei gleichzeitige Anfragen beide "noch frei" lesen.
-- --------------------------------------------------------------------------
create or replace function abo_kontingent(
  p_ip_hash text,
  p_grenze  integer default 5
) returns integer
language plpgsql
as $$
declare
  v_zaehler integer;
  v_stunde  timestamptz := date_trunc('hour', now());
begin
  insert into abo_versuche as a (ip_hash, stunde, anzahl)
  values (p_ip_hash, v_stunde, 1)
  on conflict (ip_hash) do update
     set anzahl = case when a.stunde = v_stunde then a.anzahl + 1 else 1 end,
         stunde = v_stunde
   where a.stunde is distinct from v_stunde or a.anzahl < p_grenze
  returning a.anzahl into v_zaehler;

  return coalesce(v_zaehler, 0);
end;
$$;

revoke all on function abo_kontingent(text, integer) from public, anon, authenticated;
grant execute on function abo_kontingent(text, integer) to service_role;

-- Alte Zeilen brauchen wir nicht aufbewahren.
create or replace function prune_abo_versuche() returns void language sql as $$
  delete from abo_versuche where stunde < now() - interval '2 hours';
$$;
