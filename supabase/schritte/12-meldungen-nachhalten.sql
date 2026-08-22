-- Scooly Status - Nachtrag: keine Meldung geht verloren, keine doppelt raus
-- Im SQL-Editor einfügen und ausführen. Gefahrlos mehrfach ausführbar.

alter table incident_updates
  add column if not exists notified_at timestamptz;

-- Nur die noch nicht verschickten interessieren - dafür ein schmaler Index.
create index if not exists incident_updates_offen_idx
  on incident_updates (created_at)
  where notified_at is null;

-- Alles, was es jetzt schon gibt, gilt als erledigt. Sonst würde beim
-- ersten Lauf die gesamte bisherige Historie hinausgeschickt.
update incident_updates
   set notified_at = created_at
 where notified_at is null;
