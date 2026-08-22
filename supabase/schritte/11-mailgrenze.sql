-- Scooly Status - Nachtrag: höchstens zwei Meldungen je Person und Tag
-- Im SQL-Editor einfügen und ausführen. Gefahrlos mehrfach ausführbar.

alter table subscribers
  add column if not exists mail_day   date,
  add column if not exists mail_count integer not null default 0;

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
