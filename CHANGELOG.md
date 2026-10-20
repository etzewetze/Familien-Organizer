# Änderungsübersicht

## 0.8.3 · 2026-10-20

Übersichtlicher Familienalltag und einfache Aufgaben für Kinder

- **Heute** zeigt Aufgaben, heutige Termine, farbige Personenkarten mit eigenem Fortschritt, Punkte und den Abstand zur günstigsten Belohnung. Die Wochenübersicht ist aufklappbar. Der Aufgabenfilter der Planungsansicht verändert die Tagesübersicht nicht.
- Aufgabennamen, Bild/Emoji und Punkte sind dauerhaft sichtbar. Ein Tipp erledigt die Aufgabe; ein späterer Tipp öffnet sie wieder. Schnelle Doppeltipps und parallele Anfragen lösen keine zweite Buchung aus. Tastaturbedienung funktioniert mit einer Aktivierung. Bei einem Schreibfehler wird keine Erledigung vorgetäuscht.
- Jede Person hat einen eigenen Fortschrittsbalken. Kinder stehen in der Aufgabenansicht zuerst; gemeinsame Aufgaben stehen unter **Gemeinsam**. Der sichtbare Stift öffnet Optionen, der separate Griff verschiebt offene Aufgaben. Vorlagen, Nummernsuche, Zuordnung und Layoutauswahl bleiben verfügbar.
- Nachtschichten mit Ende am nächsten Tag vor der Startuhrzeit erscheinen in Wochenübersicht, Monat, Jahr, Liste, Tagesinfos und Heute nur am Starttag. **22:00–06:00 (morgen)** zeigt das Ende an. Aufeinanderfolgende Schichten werden so nicht doppelt gezählt. Im Stundenraster bleiben die echten Fortsetzungen sichtbar, mit **00:00–06:00 · vom Vortag** gekennzeichnet. Ein Ende genau um Mitternacht erzeugt kein leeres Folgetagsereignis; ganztägige und längere mehrtägige Termine bleiben sichtbar.
- Der Kalender startet mit der einfachen Ansicht **Woche**. Das bisherige Stundenraster steht unter **Uhrzeiten** zur Verfügung. Kalenderdaten- und Stundenplanschalter sind aufklappbar; der Import bleibt dort und in den Einstellungen erreichbar.
- Das Menü zeigt die sechs Alltagsbereiche mit Bildsymbolen; Geburtstage, Stundenpläne, Notizen und Bilderrahmen stehen unter **Mehr entdecken**. Bestehende Farben, Familiendaten, Punkte und Aufgaben bleiben erhalten; kein Datenbankschemawechsel.

## 0.8.2 · 2026-10-16

Termine duplizieren und Einkaufsmodus (LXC-Version)

- Im Terminformular **Duplizieren** öffnen, Zieldatum und Kalender auswählen und **Duplikat anlegen** wählen. Uhrzeiten, Personen, Beschreibung, Ort, Farbe und Symbole werden übernommen. Mehrtägige und ganztägige Termine behalten ihre Länge; feste Startzeiten bleiben ohne Ende.
- Die Kopie ist unabhängig vom Original. Für Google entsteht eine neue Termin-ID; schreibgeschützte Quellen lassen sich in den Familienkalender oder einen anderen schreibbaren Kalender kopieren. Importierte ICS-Termine lassen sich ebenfalls als eigene Termine duplizieren.
- Quellrevision und Zielkalender werden serverseitig geprüft. Wiederholung derselben bestätigten Anfrage nach einem Verbindungsfehler erzeugt keine weitere Kopie. Kopierkennungen bleiben bei Bearbeitung, Google-Abgleich und Sicherung erhalten.
- In jeder Liste zwischen **Bearbeiten** und **Einkauf** wechseln. Im Einkaufsmodus hakt ein Doppeltipp auf die gesamte Lebensmittelzeile ab und streicht Titel und Menge durch; derselbe Doppeltipp öffnet sie wieder.
- Erledigte Einträge bleiben im Einkaufsmodus an derselben Position. Mengen und Kategorien bleiben sichtbar; Einträge lassen sich weiterhin ergänzen. Tastatur und Vorlesefunktion können mit einer Aktivierung umschalten.
- Der Einkaufsmodus wird pro Liste im jeweiligen Browser gespeichert; der Erledigungsstand bleibt gemeinsam und revisionsgeschützt. Die gewohnte Bearbeitungsansicht mit Kästchen und Stift bleibt verfügbar.

## 0.8.1 · 2026-10-16

Kompakter Monat und Arbeitstage (LXC-Version)

- Feiertage markieren in Monat und Jahr den ganzen Tag in einer gemeinsamen, unter Einstellungen → Darstellung anpassbaren Farbe. Standard ist Hellgrün. Die Beschriftung erhält passenden Kontrast; Heute bleibt erkennbar.
- Im Monat entfallen die Terminblöcke für Feiertage und Geburtstage. Kompakte Zeilen zeigen einzelne Einträge; mehrere Einträge derselben Art werden zusammengefasst und öffnen per Tipp eine vollständige Liste mit Bearbeitung. Gewöhnliche Termine bleiben sichtbar.
- Die bestehende Darstellung von Feiertagen und Geburtstagen in Woche und Liste bleibt erhalten.
- ICS-Dienstpläne können ausdrücklich als Arbeitstage einer Person importiert werden. Uhrzeiten, Nachtdienste, offene Endzeiten und Serien bleiben erhalten. Arbeitstage erscheinen als Tageskennzeichnung mit 💼 statt als Termin im Stundenraster; im Jahr als kleines Symbol.
- Eigene Aktivierung und Verwaltung für Arbeitstage. Bereits importierte Termine können im Bearbeitungsformular auf Arbeitstag umgestellt werden. Arbeitstage lösen keine Schul-/Kitapause aus.
- Bestehende Einstellungen erhalten die neue Feiertagsfarbe und den Arbeitstagsschalter automatisch. Ältere Speichervorgänge bewahren die neuen Werte. Sicherungen und Exporte enthalten Farben, Dienste und Zuordnungen.

## 0.8.0 · 2026-10-16

Ferien, Feiertage und Kalenderimport (LXC-Version)

- Namen von Stunden- und Kitaplänen sind optional. Ohne Namen werden die Personennamen angezeigt.
- Unter Kalender → Ferien, Feiertage & Import sowie in den Einstellungen ist die neue Kalenderdatenverwaltung erreichbar.
- Ferien, Feiertage und importierte Termine sind gemeinsam aktivierbar. Auch ausgeblendete Einträge lassen sich ansehen, bearbeiten, Personen zuordnen und löschen.
- Ferien/Feiertage nach deutschem Bundesland und Jahr von OpenHolidays API laden; gegebenenfalls eine Schulart auswählen. Vor dem Speichern Einträge und Personenzuordnung prüfen.
- ICS-Datei bis 2 MB importieren: Vorschau, Zeitraum, Art, Auswahl einzelner Einträge und Zuordnung zu Alle oder einer Person. Keine Daten werden allein durch die Vorschau gespeichert.
- Häufige tägliche, wöchentliche, monatliche und jährliche Wiederholungen einschließlich Ausnahmen werden für höchstens drei Jahre aufgelöst. Nicht unterstützte Regeln werden gemeldet.
- Importe sind Momentaufnahmen. Erneute Importe derselben Person überspringen vorhandene Einträge und bewahren manuelle Änderungen. Die Zuordnung zu einer weiteren Person ist unabhängig möglich.
- Schulpläne pausieren auf Wunsch während zugeordneter Ferien/Feiertage. Kita pausiert standardmäßig an Feiertagen; die Ferienpause ist zusätzlich einschaltbar.
- Neue Kalenderdaten, Zuordnungen, Aktivierungen und namenlose Pläne bleiben in Sicherungen und Updates erhalten.

## 0.7.0 · 2026-10-16

Aufgabenbibliothek, Stundenpläne und Jahreskalender (LXC-Version)

- Namenssuche zwischen Titel und Hinzufügen im Geburtstagsreiter.
- Kalender mit zwölfmonatiger Jahresansicht; ein Monat öffnet die Monatsansicht, ein Tag die Terminliste seiner Woche.
- Wiederverwendbare Aufgabenvorlagen mit optionaler eindeutiger Nummer, Bild/Emoji, Titel und Punkten. Bestehende Aufgaben werden zusätzlich als Vorlagen übernommen.
- Vorlagen ziehen oder bei jeder Person nach Namen bzw. Nummer auswählen. Jede Verteilung ist eine unabhängige Aufgabe.
- Symbolansicht: einmal tippen zeigt den Titel, doppelt tippen schaltet erledigt/offen um. Erledigte Aufgaben sind grün. Gedrückt halten oder Rechtsklick öffnet Bearbeiten und Entfernen.
- Responsive Personenbereiche mit automatischer Aufteilung oder 2/3/4 Personen pro Reihe; auf kleinen Geräten weniger Spalten.
- Schulpläne Montag bis Freitag mit 6/8/10/12 Stunden, einstellbaren Uhrzeiten und Pausenbalken nach zwei Stunden.
- Eigene Kitapläne mit Bring-/Abholzeiten, optionalen Hinweisen und Gültigkeitszeitraum.
- Zuschaltbare Unterkalender mit Personeninitiale und Farbe. Im Wochenkalender schmale nebeneinanderliegende Balken mit Namen, Anfang und Ende.
- Einführung beim ersten zuschaltbaren Plan: Kalenderwechsel, abgedunkelte Umgebung und markierter Schalter; Bestätigung nach fünf Sekunden. Nach Löschen aller Pläne erneut verfügbar.
- Navigation auf Symbole einklappen und per Stift mit Auf-/Ab-Schaltern sortieren; Anzeigeeinstellungen werden pro Gerät gespeichert.
- Vorlagen, Pläne und Bilder bleiben angemeldet zugänglich und werden mit den Familiendaten gesichert. Bestehende Punkte und Aufgaben bleiben erhalten.

## 0.6.0 · 2026-10-09

Wetter, Tabletmodus und persönliche Symbole

- Nach einem Software-Update werden alle Geräte abgemeldet. Nach dem Anmelden erscheint diese Änderungsübersicht.
- Wetter neben der Uhr: aktuelle Temperatur, Wetterlage und Regenhinweis. Antippen öffnet die 14-Tage-Vorhersage mit mehreren speicherbaren Orten.
- Geräteeinstellungen für Inaktivität: dunkler Ruhebildschirm oder automatischer Bilderrahmen. Eine Berührung bringt den Organizer zurück.
- Termine und Aufgaben können ein eigenes Bild und ein Emoji erhalten. Die Emoji-Auswahl bietet Kategorien und eine Suche.

## 0.5.1 · 2026-10-09

Alle Personenfarben im Termin

- Termine für mehrere Personen zeigen einen durchgehenden Verlauf aller ausgewählten Personenfarben, auch bei Terminen ohne Endzeit.

## 0.5.0 · 2026-10-09

Mehr Gestaltung für eure Familie

- Zentrierte Profile mit eigenen Bildern, anpassbare Hintergrund- und Headerfarben, kompakterer Kalender und eigener Farbton für Alle.
- Waagerechter oder senkrechter Essensplan, Rezeptvorschaubilder und Geburtstage mit Kuchen und optionalem Alter.
