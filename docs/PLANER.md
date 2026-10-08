# Kalender, Aufgaben und Wochenessen

## Kalender

Die Wochenansicht zeigt alle sieben Tage mit ausgeschriebenem Wochentag, Tag, Monat und Jahr. Das Plus steht rechts in derselben Kopfzeile. Links verläuft die Zeitachse von 00:00 bis 24:00. Das Raster lässt sich nach oben/unten und auf schmalen Geräten seitlich scrollen; es öffnet zunächst ab 06:00. Monats- und Listenansicht bleiben wählbar.

Termine stehen an ihrer Startzeit und sind entsprechend ihrer Dauer hoch: 07:00–09:00 erhält doppelt so viel Platz wie 07:00–08:00. Sich überschneidende Termine werden nebeneinander dargestellt. Ganztägige Termine und Geburtstage stehen oberhalb des Zeitrasters. Mehrtägige Zeitspannen werden pro Tag auf dessen sichtbare Stunden begrenzt.

**Termin hinzufügen:**

1. „Termin“ oben oder das Plus am gewünschten Tag drücken.
2. Alle, eine Person oder mehrere Personen auswählen.
3. Überschrift eingeben; Beschreibung und Adresse/Ort sind optional.
4. Datum auswählen. Beim Tages-Plus ist es bereits gesetzt, deshalb wird dieser Schritt übersprungen.
5. Ganztägig, Zeitspanne oder feste Zeit ohne Ende wählen und speichern.

Eine feste Zeit ohne Ende blendet über 15 Minuten nach unten aus. Es wird kein Endzeitpunkt als Familiendatum gespeichert. Bei Google ist ein Ende erforderlich: Dort wird ein 15-Minuten-Termin mit privater Kennzeichnung übertragen; die Familienzentrale zeigt ihn weiterhin ohne Ende. Ganztägige Termine und Zeitspannen können ein anderes Enddatum erhalten.

Die Personen oben im Header besitzen Initialen und einen Ring in ihrer zugeteilten Farbe. Antippen filtert die Kalenderanzeige; „Alle“ hebt den Filter auf. Termine für mehrere Personen erscheinen in jedem ihrer Filter. Farben und Namen sind in den Einstellungen bearbeitbar. Eigene Profilbilder folgen später.

## Aufgaben und Routinen

Alle Familienmitglieder und **Allgemein** sind als Bereiche sichtbar, auch ohne Aufgaben. Die verfügbaren Punkte stehen unter dem Namen. „Alle Bereiche“ zeigt das gemeinsame Board; ein Personenreiter zeigt deren Bereich allein.

Eine Aufgabe aus Allgemein in die gewünschte Personenspalte oder auf deren Reiter ziehen. Mit Touch den kleinen Griff verwenden; dadurch bleibt normales Scrollen auf der restlichen Karte möglich. Alternativ die Aufgabe bearbeiten und unter „Zuordnen“ eine Person auswählen. Eine Zuordnung zu Allgemein ist ebenfalls möglich.

Aufgaben enthalten ein optionales Bild bis 5 MB, Titel, Punkte, Zuordnung und Wiederholung. Bilder werden für alle Geräte im Container gespeichert und mit gesichert. Bei Routinen gilt eine geänderte Zuordnung für die weiteren Wiederholungen. Bereits verdiente Punkte bleiben bei der Person, die die Aufgabe erledigt hat.

Das Kästchen hakt die Aufgabe ab. Eine zugeordnete Aufgabe schreibt die Punkte direkt dieser Person gut; bei einer allgemeinen Aufgabe wird gefragt, wer sie erledigt hat. Eine Erledigung kann nicht doppelt Punkte erzeugen. Erledigte Aufgaben zuerst wieder öffnen, bevor sie verschoben werden. Die Aufgabenansicht hat einen eigenen Personenfilter; der allgemeine Header-Filter blendet keine Familienbereiche aus.

## Belohnungen und manuelle Punkte

Belohnungen besitzen einen eigenen Reiter mit Punkteständen, Einlösemöglichkeit und Buchungshistorie. „Punkte vergeben“ benötigt das zuvor unter **Einstellungen → Elternpasswort** angelegte Passwort. Person, positive Punktzahl und Begründung eintragen. Die Buchung wird gemeinsam gespeichert; eine wiederholte identische Anfrage erzeugt keine zweite Gutschrift.

Das Elternpasswort ist vom Familienpasswort getrennt und hat mindestens acht Zeichen. Zum erstmaligen Anlegen wird das Familienpasswort verlangt; zum späteren Ändern zusätzlich das bisherige Elternpasswort. Passwörter werden als gesalzene Hashes gespeichert und weder in die Oberfläche noch in den JSON-Export gegeben.

Es schützt manuelle Punkte und Software-Updates. Alle angemeldeten Familiengeräte dürfen weiterhin gewöhnliche Termine, Aufgaben und Belohnungen bearbeiten; die Anzeige „Kind“ ist noch kein eigener eingeschränkter Benutzerzugang.

## Essen und Rezepte

Jeder Tag besitzt drei Spalten: **Frühstück**, **Mittag** und **Abendbrot**. Eine Rezeptkarte in die passende Spalte ziehen. Mit Touch den Griff verwenden, alternativ „Auswählen“ bzw. „Ändern“ drücken. Beim Ablegen in einer belegten Spalte wird das bisherige Rezept ersetzt; dessen Portionszahl bleibt erhalten. Über „Ändern“ lassen sich Rezept und Portionszahl prüfen oder die Mahlzeit entfernen.

Vorhandene Pläne aus älteren Versionen werden als Abendbrot angezeigt. Sie werden beim Update nicht gelöscht. Jede Mahlzeit wird unabhängig gespeichert; die Einkaufsliste berücksichtigt die Zutaten aller drei Spalten und skaliert nach Portionen. Wiederholtes Übernehmen derselben Woche verdoppelt die Zutaten nicht.

Rezeptlink-Import: [INTEGRATIONS.md](INTEGRATIONS.md#rezepte-aus-dem-internet). Software-Update: [LXC.md](LXC.md#updates-über-die-oberfläche).

## Prüfstand

Ansichten, Assistent, Zeitberechnung, Mehrfachzuordnung, Datenkonflikte und Drag-Aufträge werden automatisiert geprüft. Eine echte visuelle und Touch-Abnahme auf Handy, Tablet und Wanddisplay steht aus, da in der Entwicklungsumgebung kein Browser ausführbar ist. Für den Produktiveinsatz die gewünschten Geräte testen.
