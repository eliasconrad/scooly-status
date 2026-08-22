-- Scooly Status - Nachtrag: was der Ausfall für die Leute bedeutet
-- Im SQL-Editor einfügen und ausführen. Gefahrlos mehrfach ausführbar.
--
-- Bisher stand in der Meldung nur die Technik: HTTP 502, 18,2 s, Grenzwert.
-- Für jemanden, der gerade lernen will, sagt das nichts. Diese zwei Sätze
-- je Dienst beantworten die eigentliche Frage: Was geht gerade nicht?

alter table services
  add column if not exists wirkung_ausfall text,   -- wenn gar nichts geht
  add column if not exists wirkung_langsam text;   -- wenn es nur zäh ist

update services set
  wirkung_ausfall = 'Scooly lässt sich gerade nicht öffnen.',
  wirkung_langsam = 'Scooly lädt gerade langsam.'
 where slug = 'scooly-web';

update services set
  wirkung_ausfall = 'Anmelden und Registrieren geht gerade nicht. Wer schon angemeldet ist, kann normal weiterarbeiten.',
  wirkung_langsam = 'Das Anmelden dauert gerade länger als sonst.'
 where slug = 'scooly-anmeldung';

update services set
  wirkung_ausfall = 'Die App auf iPhone und iPad kann gerade nichts laden. Bereits geladene Inhalte bleiben sichtbar.',
  wirkung_langsam = 'Die App auf iPhone und iPad reagiert gerade träge.'
 where slug = 'scooly-app';

update services set
  wirkung_ausfall = 'Neue Aufgaben, Quizze und Karteikarten lassen sich gerade nicht erstellen. Was schon da ist, kannst du weiter lernen.',
  wirkung_langsam = 'Neue Aufgaben, Quizze und Karteikarten brauchen gerade deutlich länger.'
 where slug = 'scooly-ki';

update services set
  wirkung_ausfall = 'Fotos und Handschrift werden gerade nicht erkannt. Hochladen kannst du trotzdem, die Erkennung holt es nach.',
  wirkung_langsam = 'Die Handschrift-Erkennung braucht gerade länger als sonst.'
 where slug = 'scooly-handschrift';

update services set
  wirkung_ausfall = 'Speichern und Laden geht gerade nicht. Schreib nichts Wichtiges, es könnte verlorengehen.',
  wirkung_langsam = 'Speichern und Laden dauert gerade länger.'
 where slug = 'scooly-daten';

-- Zur Kontrolle
select slug, wirkung_ausfall from services order by sort_order;
