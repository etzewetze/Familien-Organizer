# Projektstand und Fortsetzung

**Projekt:** Familien Organisierer  
**Stand:** 2026-10-09, Version 0.5.1, Datenbankschema 1
**Repository:** https://github.com/etzewetze/Familien-Organizer, öffentlich, Branch `main`

## Ziel und verbindliche Vorgaben

Eigene deutsche Familienzentrale auf Proxmox LXC, mit eigenem Quellcode und Design. Der Kern benötigt keine Daely-Dienste. Optional angeschlossene Google-Kalender und Immich bleiben externe Systeme. Bildschirmgrößen Handy, Tablet, PC und Wanddisplay berücksichtigen. Native App und das eigene Stundenplan-Modul ausdrücklich erst später entwickeln.

Der Nutzer hat das Repository und das Hochladen ausdrücklich autorisiert. Keine erneute allgemeine Upload-Freigabe einholen, die Sichtbarkeit nicht eigenmächtig ändern und das andere Repository `extraitems` nicht bearbeiten. Echte Familiendaten, Fotos, Schlüssel, `.env`, SQLite-Dateien und Sicherungen gehören nicht auf GitHub.

**Container 100 läuft laut Nutzer inzwischen. Diesen erhalten und aktualisieren.** Kein Neuaufbau und keine Löschung. Es besteht kein direkter Zugang zum Proxmox des Nutzers; er führt die dokumentierten Host-Befehle aus. Root-Zugang vom Host mit `pct enter 100`; ein eigenes Root-Passwort ist optional mit `pct exec 100 -- passwd root` einstellbar. Kein voreingestelltes Root-Passwort und keine Verbindung zum Familienpasswort.

## Geliefert in 0.5.1

Neu in 0.5.1: Bei mehreren Terminpersonen geht ein vertikaler Verlauf durch alle ausgewählten Personenfarben, in der gespeicherten Reihenfolge. Kräftiger Farbstreifen mit Originalfarben, deckender Hintergrund aus zur Kartenfarbe gemischten helleren/dunkleren Farbtönen. Übersicht, Woche, Monat und Liste verwenden dieselbe Berechnung, auch ganztägige Termine und Starttermine ohne Ende. Letztere zeigen bei Mehrfachauswahl bis zum Ende des 15-Minuten-Feldes die letzte Personenfarbe. Einzelperson und Alle behalten ihr bisheriges Ausblenden. Personenfarbänderungen wirken auf vorhandene Termine; kein neues Datenfeld oder Schema.

Seit 0.5.0: Rezeptbilder in Bibliothek, Rezeptansicht und Essensplan; antippbare Bildkarten statt Textauswahl bei Auswählen/Ändern; eigene Bilder hochladen/entfernen und verfügbare Bilder aus JSON-LD lokal importieren. Geburtstage erscheinen in allen Kalenderansichten und der Übersicht als 🎂 Name mit Alter, sofern ein Geburtsjahr vorhanden ist. Der restliche Funktionsumfang bleibt erhalten.

Node.js-Server mit SQLite-WAL, deutscher Weboberfläche und API, ohne externe npm-Laufzeitabhängigkeiten oder Build-Schritt. Node >=22.13, Node 24 empfohlen und vom Installer separat eingerichtet. Familienname, Mitglieder und Familienpasswort werden beim ersten Start angelegt. Gemeinsame Daten werden auf geöffneten Geräten alle 15 Sekunden nachgeladen. Zehn Ansichten: Heute, Kalender, Geburtstage, Aufgaben, Belohnungen, Essen & Rezepte, Listen, Notizen, Bilderrahmen und Einstellungen.

### Kalender und Personen

- Wochenansicht mit sieben ausgeschriebenen Wochentagen und vollständigem Datum einschließlich Monat und Jahr.
- Zeitachse 00:00–24:00 mit 24 Stundenzeilen, vertikal und auf kleinen Bildschirmen horizontal scrollbar. Anfangs ab 06:00 sichtbar; die sichtbare Uhrzeit bleibt nach einer Änderung erhalten. Stundenhöhe 52–100 px, Standard 64. Leere Stunden werden optional über die gesamte Woche gemeinsam auf 55 % verkürzt; leere Tage optional schmaler. Ganztägige Karten haben keinen überschüssigen Mindestplatz.
- Terminposition und Höhe richten sich nach Startzeit und Dauer. Überlappende Termine stehen nebeneinander; mehrtägige Spannen werden je Tag begrenzt. Ganztägige Termine und Geburtstage stehen oberhalb des Stundenrasters.
- Tages-Plus rechts in derselben Kopfzeile wie der Wochentag.
- Terminassistent: Alle/eine/mehrere Personen → Überschrift, optionale Beschreibung und Adresse → Datum → Zeit. Beim Tages-Plus ist das Datum gesetzt und der Datumsschritt entfällt.
- Ganztägig, Zeitspanne oder feste Startzeit ohne Ende. Starttermine nutzen 15 Minuten; bei Einzelperson/Alle blenden sie nach unten aus, bei mehreren Personen zeigen sie den Farbverlauf bis zur letzten Person.
- Mittige Headerprofile mit Initialen oder privaten Profilbildern und persönlichem Farbring; größere Uhr rechts, auch auf schmalen Geräten. Profilbilder beim Bearbeiten der Person hochladen/entfernen. Ein gemeinsamer Personenfilter für Übersicht, Kalender, Geburtstage und Aufgaben; doppelte Filterleisten entfernt. Alte Einzelzuordnungen bleiben lesbar.
- Bestehende Termine öffnen ein vollständiges Bearbeitungsformular, neue Termine weiterhin den Assistenten. Standardfarbe für Alle gemeinsam konfigurierbar; eine eigene Terminfarbe kann sie überschreiben. Gemeinsame Termine gehen durch alle ausgewählten Personenfarben.
- Darstellungseinstellungen: Hintergrund, Header, Karten/Formulare, Menü, Akzente, Text und Standardfarbe für Alle; optionales Hintergrundbild. Vorschau während der Auswahl, Speichern für alle Geräte, Standardwerte wiederherstellbar. Profil-/Hintergrundbilder bis 5 MB in `DATA_DIR/ui-images`, geschützter HTTP-Zugang und Sicherung.
- Monats- und Listenansicht sowie jährliche Geburtstage aus 0.2.0 bleiben erhalten. Anzeige 🎂 Name mit Alter des angezeigten Kalenderjahres, wenn ein Geburtsjahr vorhanden ist; ohne Jahr nur Kuchen und Name. Ein Jahr erscheint als „1 Jahr“. Wählbare Schalttagsregel; keine gespeicherten jährlichen Terminkopien.

Google: mehrere Konten, Kalenderauswahl, Personenzuordnung, Abgleich alle fünf Minuten und persistente Versandwarteschlange. Mehrfachzuordnungen, Starttermine und eigene Farben für Alle werden über private Google-Metadaten erhalten. Beliebige Hex-Farben ändern nicht die Google-Farbpalette. Weil Google ein Ende verlangt, erhält ein Starttermin dort eine 15-Minuten-Spanne; lokal bleibt die Darstellung ohne Ende. Ein Vergleich von Array-Inhalten verhindert unnötige Revisionsänderungen beim Nachladen. Lesegeschützte Google-Termine sind auch serverseitig gegen Bearbeitung geschützt.

### Aufgaben, Punkte und Belohnungen

- Allgemein und jedes Familienmitglied sind auch bei leeren Bereichen sichtbar, mit verfügbaren Punkten unter den Namen. Alle Bereiche, Allgemein oder über ein Headerprofil den Personenbereich anzeigen; keine zweite Reihe Personenreiter. Punkte stehen auch unter den Headernamen.
- Drag-and-drop auf eine Personenspalte oder ein Headerprofil; Touch-Griff und Bearbeitungsdialog als alternative Zuordnung. Die ursprüngliche Revision wird geprüft.
- Kästchen zur Erledigung; Aufgabenbilder bis 5 MB werden im Container unter `DATA_DIR/task-images` gespeichert und gesichert. Titel, Punkte und bestehende Routinen/Wiederholungen bleiben nutzbar.
- Erledigte Aufgaben vor einer neuen Zuordnung wieder öffnen. Bei Routinen betrifft die Zuordnung künftige Erledigungen; bereits verdiente Punkte bleiben bei der ursprünglichen Person.
- Eigener Belohnungsreiter mit Guthaben, Einlösung und Buchungshistorie.
- Manuelle positive Punkte mit Person, Begründung und idempotenter Buchungskennung. Kein generischer CRUD-Zugang für solche Gutschriften.
- Eigenes Elternpasswort in den Einstellungen, mindestens acht Zeichen, gesalzener scrypt-Hash. Erstes Anlegen benötigt das Familienpasswort; Ändern zusätzlich das bisherige Elternpasswort. Fehlversuche werden begrenzt.
- Elternpasswort schützt manuelle Punkte und Updates. Die Familie nutzt weiterhin einen gemeinsamen Zugang; die Anzeige „Kind“ vergibt keine weiteren eingeschränkten Rechte.

### Essen, Rezepte und weitere Bereiche

Die Essenswoche steht standardmäßig waagerecht, mit einem Umschalter zur senkrechten Ansicht. Die Ausrichtung wird für diesen Browser gespeichert. Jeder Tag enthält Frühstück, Mittag und Abendbrot. Rezeptkarten lassen sich in die drei Slots ziehen, mit Touch am Griff; Auswählen/Ändern bleibt möglich. Beim Ersetzen bleibt die Portionszahl bestehen. Alte Mahlzeiten ohne Slot erscheinen als Abendbrot, ohne Löschen oder Zurücksetzen. Alle Mahlzeiten gehen portionsabhängig in die Einkaufsliste ein; wiederholtes Übernehmen verdoppelt Zutaten nicht.

Rezeptimport aus öffentlicher URL mit editierbarer JSON-LD-Vorschau aus 0.2.0 bleibt erhalten. Abruf mit geprüften und fest gebundenen DNS-Adressen, Weiterleitungsprüfung und Größen-/Zeitlimits. Keine Browser-Cookies oder Zugangsdaten weiterreichen. Chefkoch und andere Seiten müssen abrufbare strukturierte Daten bereitstellen; echter Chefkoch-Import auf dem Nutzer-LXC ist noch nicht abgenommen.

Rezeptbilder aus Upload oder JSON-LD (`image` als URL/Array/ImageObject, auch relative Adresse oder öffentliches CDN) werden in `DATA_DIR/ui-images` gespeichert und über die bestehende geschützte Bild-API ausgeliefert. Kein externes Bild im Browser. JPEG, PNG, WebP, GIF; bis 5 MB. Importbilder nutzen dieselbe öffentliche DNS-/Redirect-Prüfung wie Rezeptseiten, maximal 8 Sekunden und begrenzte Entpackung. Bildfehler ergeben einen Hinweis und erhalten die Rezeptvorschau. Die Rezeptdaten werden erst beim Speichern übernommen; das Vorschau-/Uploadbild kann bereits als Datei vorhanden sein. Keine automatische Löschung unreferenzierter Bilddateien. Ältere Rezepte bleiben bildlos lesbar und können nachträglich ergänzt werden; ausgelassene Bildfelder in alten Bearbeitungsanfragen erhalten die vorhandene Referenz. Bibliothek und Auswahldialog zeigen Platzhalter bei fehlenden Bildern. Native Radiofelder in Bildkarten ermöglichen Touch/Klick/Tastatur; bestehendes Rezept ist vorausgewählt, Mahlzeit/Slot/Portionen/Revision bleiben erhalten. Ein veralteter Upload darf keinen neuen Dialog überschreiben.

Listen, Notizen, lokale Gerätefotos in IndexedDB, Container-Fotouploads, Netzwerk-Bilderlisten und Immich-Alben bleiben vorhanden. Native App und Stundenpläne sind spätere Aufgaben.

## Updates, Installation und Sicherungen

Der öffentliche vollständige Checkout kann ohne GitHub-Passwort im bestehenden LXC geklont bzw. aktualisiert werden. Der innere Installer erhält Daten, Konfiguration, Fotos und Schlüssel; separate Node-24-Laufzeit, Dienstbenutzer, systemd, Versions-/HTTP-Startprüfung und automatische Rücksetzung bei fehlgeschlagenem Start bleiben enthalten.

**Ab laufendem 0.3.0 mit Updatedienst genügt Einstellungen → Update für 0.5.1. Bei einem älteren Stand muss der vollständige Checkout einmal mit `scripts/install-lxc.sh` installiert werden.** Alleiniges Kopieren des Installers reicht wegen der neuen Module nicht. Der genaue Befehl für Container 100 steht in `docs/LXC.md` unter „Update des öffentlichen Projekts vom Proxmox-Host“. Danach Browser neu laden und unter Einstellungen ein Elternpasswort anlegen. Künftige Updates werden mit **Update** in der Oberfläche gestartet.

Der Web-Update-Dienst besitzt fest konfigurierte Pfade und ein festes Repository; die Oberfläche darf keine Shellbefehle oder Downloadadressen übergeben. Ein privater Unix-Socket erlaubt nur Status und einen leeren Startauftrag. API-Zugang verlangt Familienanmeldung, CSRF-Prüfung und zum Start das Elternpasswort.

Wichtige Pfade:

- Anwendung `/opt/familien-organisierer`, Laufzeit-Link `/opt/familien-organisierer-node`.
- Daten `/var/lib/familien-organisierer`, Fotos standardmäßig darunter `photos`, Aufgabenbilder darunter `task-images`, Profil-/Hintergrund-/Rezeptbilder darunter `ui-images`.
- Sicherungen `/var/backups/familien-organisierer` einschließlich `web-updates` und `updates`; keine automatische Löschung alter Sicherungen.
- Unabhängiger root-eigener Helfercode `/opt/familien-organisierer-updater`.
- Root-Konfiguration `/etc/familien-organisierer-updater.json`, Status/Protokoll `/var/lib/familien-organisierer-updater`, privat mit 0700/0600.
- Dienst `familien-organisierer-updater.service`, Socket `/run/familien-organisierer-update/control.sock`, Gruppe `family-organizer`, Socketmodus 0660.

Der Helfer erstellt vor dem Download eine echte SQLite-Sicherung einschließlich Originalschlüssel, `.env`, Fotos, Aufgaben-, Profil-, Hintergrund- und Rezeptbildern. Der Installer erstellt zusätzlich nach Stoppen des Anwendungsdienstes eine ruhende Sicherung sowie Code-/Laufzeit-/Dienstsicherung. Dafür ausreichend freien Speicher vorhalten. Bei Fehlern stellt der Installer den vorherigen Stand wieder her; ein zusätzlicher Helfer-Rückfall stellt Code, Datenbank, Schlüssel, Laufzeit und Dienst wieder her, wenn nötig. Bilderordner werden bei der Installation nicht ersetzt. Eine Datenbank wird niemals über einen nicht sicher gestoppten Dienst zurückkopiert.

Statusmeldungen zeigen Sicherung, Download, Installation, Rücksetzung, Erfolg oder Fehlergrund. Fehlgeschlagene Rücksetzung erhält Arbeitskopien und Sicherungen. Nach Prozessunterbrechung wird kein Erfolg behauptet und kein Update blind wiederholt. Der Anwendungsdienst darf während des Updates kurz nicht erreichbar sein; die Oberfläche lädt den Status danach erneut und meldet bei längerer Unterbrechung, dass kein Ergebnis abrufbar ist.

Der laufende Helfer wird durch sein eigenes Update nicht neu gestartet. Vor dem nächsten Auftrag liest er die Root-Konfiguration erneut, damit geänderte Datenpfade gelten. Neue Helfer-Module auf der Festplatte werden beim nächsten Neustart des Helferdienstes bzw. des Containers geladen; JavaScript-Modulcache wird nicht während eines laufenden Jobs ausgetauscht. Daten-/Fotopfade müssen getrennt von Code, Laufzeit, Sicherungen und geschützten Helferpfaden liegen. Nach manuellen `.env`-Pfadänderungen Installer erneut ausführen.

Der Host-Ersteller bleibt für **neue** Container verfügbar: Proxmox >=8 x86_64, Debian 12/13, unprivilegiert, mindestens ein Kern, 1024 MiB RAM, 512 MiB Swap und 8 GiB Disk. Debian 13 verwendet Nesting für systemd. `pct` erhält umask 022; private Installerdateien bleiben mit 077 geschützt. Die früheren Netzwerk-/D-Bus-Probleme wurden behoben und der Nutzer meldet den Container als laufend. Historische Diagnose steht in `docs/PROXMOX.md`; keine weitere Containerlöschung ableiten.

## Prüfstand und Grenzen

**Vollständiger Lauf von `npm test` für den aktuellen 0.5.1-Code: 104 Tests bestanden, keine Fehler oder übersprungenen Tests.** Darunter 76 Anwendungstests, sechs Update-Protokoll-/Sicherungs-/Rücksetztests, zwölf Installer-/Konfigurationstests und zehn Proxmox-Hosttests.

Bei 0.5.0 meldete ein erster Gesamtlauf einen nicht reproduzierten Fehler im bestehenden Installer-Rücksetztest. Der Einzeltest und der vollständige Wiederholungslauf bestanden; der Installercode wurde für diese und die aktuelle Version nicht geändert.

Syntaxprüfung für 33 JavaScript-Dateien einschließlich 19 Laufzeit-/Skriptmodulen, beide Bash-Installer und 36 Bash-Blöcke der Anleitungen bestanden; `git diff --check` ohne Fehler.

Prüfungen umfassen Verläufe für zwei/drei Personen in allen Kalenderansichten und Übersicht, Starttermin mit deckendem Mehrpersonenverlauf, Personenfilter, aktuelle Personenfarbänderungen, helle/dunkle Kartenfarben, Einzelperson/Alle/Altdaten und Validierung der Verlaufsfarben. Weiterhin Rezeptbildformen aus JSON-LD, CDN-Import und Rückfall bei Bildfehlern, DNS-/Redirect-/Format-/Größen-/Entpackungs-/Zeitlimits einschließlich echtem begrenztem HTTP-Bildstream, private Rezeptbilder über zwei Sitzungen, Bildkarten und Mahlzeitvorauswahl, Upload/Importreferenz/Entfernen und veraltete Uploadantworten. Geburtstag mit Kuchen/Name/Alter oder ohne Geburtsjahr in Übersicht, Woche, Monat und Liste. Weiterhin Bild- und Farbvalidierung, Profilbilder und Hintergrundbilder über zwei Sitzungen, CSRF und Pfad-/Symlinkschutz, Upload vor Referenzspeicherung, gemeinsames Bearbeitungsformular und Layoutumschalter, variable Stundenachse und deren Umrechnung beim Scrollen, Zeitraster und Überlappungen, 15-Minuten-Ausblenden, Terminassistent, Mehrfachpersonen, ursprüngliche Drag-Revisionen, drei unabhängige Mahlzeiten und Altdaten, geschützte manuelle Punkte und Updates, Bilderzugriff, Google-Metadaten und stabile Revisionen. Tatsächliche Dateioperationen, WAL-Sicherung und Rücksetzung von SQLite, Originalschlüssel und Code werden ausgeführt. Paket-/systemd-/Git-Downloadbefehle verwenden isolierte Testersatzprogramme. Der Protokolltest verwendet einen echten HTTP-Server über Loopback mit injiziertem Clienttransport; die konfigurierte Socketadresse wird geprüft.

**Keine echte visuelle Browser- oder Touch-Abnahme.** In der Umgebung ist kein Browser ausführbar. Ansichts- und Dialoglogik werden ohne Browser getestet; responsive CSS und Touch-Pointer-Logik sind implementiert, aber noch nicht auf realen Geräten abgenommen. Keine geprüften Screenshots.

**Keine Live-Abnahme von 0.5.1 auf Proxmox/systemd/Unix-Socket.** Unix-Sockets lassen sich in dieser Entwicklungsumgebung nicht binden. Die Prüfungen ersetzen weder die realen Socketrechte noch LXC-UID-Zuordnung, AppArmor und systemd. Google und Immich werden mit kontrollierten Ersatzantworten getestet, keine realen Nutzerkonten. Docker wurde nicht auf einer Zielmaschine geprüft; der neue Web-Updatedienst ist für LXC vorgesehen.

Weitere Grenzen: gemeinsamer Familienzugang; Google-Polling statt Push (90 Tage zurück/366 voraus), keine allgemeine lokale Terminserie oder vollständige Google-Konfliktoberfläche. Keine Offlinebearbeitung gemeinsamer Daten, keine Push-Erinnerungen. Gerätefotos bleiben lokal. Netzwerkfotos benötigen ein JSON-Manifest, keine allgemeine SMB-/WebDAV-Verzeichnis-Erkennung. Vollständige Wiederherstellung erfolgt mit SQLite und Originalschlüssel, keine Restore-Oberfläche. Große langfristige Datenmengen sind noch nicht unter Last geprüft.

## Nächste Schritte auf dem Zielsystem

1. Bestehenden Container 100 über den eingerichteten Update-Knopf auf 0.5.1 bringen; falls noch ein Stand vor 0.3.0 läuft, einmal den vollständigen Checkout per Installer übertragen. Browser neu laden; Daten und Elternpasswort erhalten.
2. Browser-Abnahme bei 390×844, 768×1024 und 1440×900 sowie auf dem Wanddisplay. Hoch-/Querformat, lange Namen, 200 % Schrift und Touch prüfen.
3. Mittige Profile und eigene Profilbilder, Standard-/eigene Farben für Alle, Theme und Hintergrundbild, beide Essensausrichtungen prüfen. Im Kalender variable und gleichmäßige Stunden, leere Tagesbreiten, vollständiges Bearbeitungsformular, 07:00–08:00 und 07:00–09:00, Überlappungen, feste Zeit ohne Ende, Farbverlauf für zwei/drei Personen und das deckende Ende bei gemeinsamen Startterminen, ganztägig/mehrtägig, Tages-Plus und mehrere Personen prüfen. Aufgabenbild, Checkbox, Ziehen Allgemein → Person und alle drei Mahlzeiten testen.
4. Web-Updatedienst: Start nach Containerneustart, echte Socketrechte, Sicherungen, Statusanzeige und kontrollierte Fehler-/Rücksetzprobe auf einer Testkopie prüfen. Keine künstlichen Updatefehler auf der einzigen Familieninstallation provozieren.
5. Google-OAuth für die eigene Domain und Konten, gemeinsame Kalender, Leserechte, Ausfall/Wiederverbindung und DST; Immich-Version und reale Album-/Bild-Endpunkte prüfen. Echten öffentlichen Rezeptlink mit Bildimport testen. Rezeptbild hochladen/entfernen, Bildauswahl für alle Mahlzeiten und Geburtstag mit/ohne Jahr in jeder Kalenderansicht prüfen.
6. Danach die Webversion weiter festigen; Stundenpläne nach konkreten Anforderungen, native App erst nach ausreichend fertiger Webversion.

## Dateien zum Einstieg

- `README.md`, `docs/PLANER.md`: Start, Kalender, Aufgaben, Punkte und Wochenessen.
- `docs/LXC.md`, `docs/PROXMOX.md`: Installation, bestehender Container, Web-Updates, Sicherungen und Diagnose.
- `docs/INTEGRATIONS.md`: Google, Geburtstage, Rezeptimport, Immich und Bilderquellen.
- `server.mjs`, `src/store.mjs`, `src/model.mjs`: HTTP, Speicherung, Validierung und Buchungen.
- `src/google.mjs`, `src/photos.mjs`, `src/recipe-import.mjs`, `src/public-web.mjs`: Integrationen.
- `public/app.js`, `public/planner.js`, `public/appearance.js`, `public/planner.css`: UI, variable Zeit-/Drag-Logik, gemeinsame Darstellungsdefaults und Gestaltung.
- `src/updater-client.mjs`, `src/update-runner.mjs`, `scripts/update-agent.mjs`: begrenztes Update-Protokoll, Sicherung, Job und Rücksetzung.
- `scripts/install-lxc.sh`, `scripts/lxc-config.mjs`, `deploy/familien-organisierer-updater.service`: LXC und Helferinstallation.
- `scripts/backup.mjs`, `tests/`: konsistente Sicherung und reproduzierbare Prüfungen.

## GitHub, Kontingent und Wiederaufnahme

Die Veröffentlichung von 0.5.1 auf `main` baut auf dem vorhandenen 0.5.0-Stand auf (GitHub `ff28b1e5cbe7467566a4e572041bbcfb1dc1acb9`, Tree `54e223f92f4f648e3c520fea399f6a7ed98a5469`). Branch-Aktualisierung gegen den erwarteten Kopf prüfen und bei Konflikten niemals blind erzwingen. Lokale und über die GitHub-Verbindung erzeugte Commitkennungen können bei identischem Dateibaum abweichen; den Tree und Inhalte vergleichen. Die Veröffentlichung ist kein Nachweis der Installation auf dem Nutzer-LXC.

Verbleibendes ChatGPT-Nutzungsvolumen kann hier nicht verlässlich ausgelesen werden; keine automatische Wiederaufnahme eingerichtet. Bei Unterbrechung GitHub und diese Datei für die nächste Sitzung verwenden. Fortsetzung: „Setze Familien Organisierer anhand von PROJECT_STATE.md fort.“ Nicht neu beginnen, vorhandene Daten und Einstellungen bewahren, relevante Prüfungen nach Änderungen ausführen und diesen Stand aktualisieren.
