-- Scooly Status - Nachtrag: die KI als KI benennen
-- Im SQL-Editor einfügen und ausführen. Gefahrlos mehrfach ausführbar.

-- In der Liste stand "Aufgaben, Quiz & Karteikarten" - daran war nicht zu
-- erkennen, dass das die KI ist. Der Dienst bleibt derselbe (gleiches
-- Kürzel, gleiche Messwerte), nur die Anzeige ändert sich.
update services
   set name = 'Scooly KI (Aufgaben, Quiz, Karteikarten)'
 where slug = 'scooly-ki';

-- Zur Kontrolle: so sieht die Liste danach aus.
select sort_order, slug, name, probe_url, degraded_ms, active, status
  from services
 order by sort_order;
