# Projektstand und Fortsetzung

**Projekt:** Familien Organisierer  
**Stand:** 2026-10-06, Version 0.1.2, Datenbankschema 1
**Ziel:** Eigene Familienzentrale auf Proxmox LXC; funktionale Orientierung am genannten Familienkalender, eigener Quellcode und eigenes Design. Unabhängiger Kern ohne Daely-Dienste. Google ist optional; bei dessen Nutzung bleibt Google natürlich eine externe Abhängigkeit.

## Vorgaben des Nutzers

- Deutsche Oberfläche; für die eigene Familie, selbst hosten und betreiben.
- Synchronisierte Google-Kalender.
- Bilder lokal auf dem jeweiligen Gerät, aus Container-Speicher, über IP/Netzwerk und aus Immich.
- To-dos, Routinen, Punkte für Erledigungen und Belohnungen.
- Wochenessen, Rezepte, Einkaufsliste, eigene Listen und Notizen/Infos.
- Anpassung an Handy, Tablet, PC und Wandbildschirm.
- Stundenpläne später. Native App erst, wenn das Webprojekt ausreichend fertig ist.
- Bei ausgeschöpftem Nutzungsvolumen pausieren und später am bestehenden Stand weiterarbeiten; GitHub als Zwischenspeicher.
- Repository vom Nutzer vorgegeben: https://github.com/etzewetze/Familien-Organizer (privat).
- Ein Aufruf aus der README soll einen LXC auf dem Proxmox-Host anlegen und die Anwendung installieren.

## Was geliefert ist

Lauffähiger Node.js-Server, SQLite-Speicherung, deutsche Weboberfläche und API für alle Kernbereiche. Familienname, Mitglieder und Passwort werden bei der ersten Benutzung eingerichtet. Daten liegen gemeinsam auf dem Server, geöffnete Geräte laden Änderungen alle 15 Sekunden. Die Oberfläche besitzt acht Arbeitsbereiche; Stundenpläne sind als späterer Bereich gekennzeichnet.

Google-OAuth für mehrere Konten, Kalenderauswahl und Personenzuordnung; Import, Rückschreiben und persistente Warteschlange. Abgleich alle fünf Minuten plus sofortiger Versandversuch bei lokalen Terminänderungen. Immich-Alben und serverseitiges Weiterreichen der Bilder. Lokale Gerätefotos in IndexedDB. Netzwerk-Bilderlisten und eigener Fotoordner mit Upload.

Punktestand und Belohnungsbuchungen sind transaktional; Erledigung ist je Aufgabe/Tag idempotent. Zutatenübernahme skaliert Portionszahlen, führt gleiche Zutaten und Einheiten zusammen und vermeidet Verdopplungen bei erneutem Übernehmen. Bearbeitung gemeinsamer Datensätze prüft Revisionen gegen veraltete Geräteänderungen.

Vollständiger LXC-Installer für Debian 12/13 auf x86_64/ARM64: Host-/Containerprüfung, automatisches Debian-Paketsetup, offizieller Node.js-24-Download mit SHA-256-Prüfung und eigener Laufzeit, eigener Dienstbenutzer, systemd und HTTP-Startprüfung. Updates erhalten Konfiguration, Familiendaten und Fotos, sichern vor dem Wechsel vollständig und stellen nach einem fehlgeschlagenen Start vorherigen Code, Laufzeit, Dienst und Datenbank wieder her. Kann der neue Dienst nicht gestoppt werden, bleibt die Sicherung für die manuelle Wiederherstellung erhalten. Keine automatische Löschung alter Sicherungen oder Laufzeiten.

Host-Skript `scripts/create-proxmox-lxc.sh`: Erstellt auf Proxmox >=8 (x86_64) einen neuen unprivilegierten LXC aus dem aktuellen offiziellen Debian-Template und installiert darin die Anwendung. Startwerte: 1 Kern, 1024 MiB RAM, 512 MiB Swap, 8 GiB Disk. Clusterweit freie ID, aktive Speicher und Bridge werden geprüft; eigene IDs, Speicher, Bridge, IPv4, Gateway, VLAN und größere Ressourcen sind konfigurierbar. Debian 12 für Proxmox 8, Debian 13 für Proxmox >=9. Nur Vorprüfung via --dry-run. Autostart erst nach erfolgreicher Installation, keine Container-Löschung bei Fehlern. Quellcode wird ohne Git-Metadaten und Zugangsdaten vom Host übertragen; SHA-256 prüft die Übertragung.

README enthält den direkten Git-Download plus Skriptaufruf. Weil das Repository privat ist, braucht der Download eine normale GitHub-Anmeldung auf dem Host; keine öffentliche Raw-URL oder CT-Template-Datei wird versprochen. Die GitHub-Verbindung in ChatGPT überträgt keine Anmeldedaten auf Proxmox.

Optional Docker, konsistente SQLite-Sicherung inklusive Schlüssel und Fotos sowie Passwort-Wiederherstellung sind enthalten. Keine externen npm-Laufzeitabhängigkeiten, kein Build-Schritt. Node 24 empfohlen, >=22.13 erforderlich.

## Prüfungen

`npm test`: **37 Tests bestanden** (20 Anwendungstests, 9 Installer-/Konfigurationstests, 8 Proxmox-Hosttests).

- Aufgabenpunkte, Wiederholungsrhythmen, Einmaligkeit und Rücknahme.
- Belohnungen, doppelte Buchungskennungen und Schutz vor Überziehung.
- Gerätekonflikte und veraltete Revisionen.
- Rezeptportionen, zusammengeführte Zutaten und wiederholtes Übernehmen.
- HTTP-Anmeldung, zweite Sitzung, Anfragequellen, geschützte Bilder und Passwortwechsel.
- Bildpfade und Symlinks; Mock-HTTP für Netzwerkbilder und Immich mit serverseitigem Schlüssel.
- Mock-Google für Zeitzonen, ganztägige Enddaten, stabile Revisionen, Wiederholungsversuche, Änderungen während Versand, abgewählte Kalender und noch ausstehende Löschungen.
- Ansichts- und Dialoglogik ohne echten Browser; Maskieren gespeicherter Texte.
- Sicherung einer laufenden WAL-Datenbank einschließlich identischem Entschlüsselungsschlüssel.
- Installer: Hostschutz und unverändernde Vorprüfung; falsche Download-Prüfsummen; Erstinstallation; lesbare Laufzeit und private Konfiguration; Update mit erhaltenen Daten/Fotos und entfernten alten Quelldateien; Wiederherstellung von Code, Laufzeit, Schlüssel, SQLite und Dienst nach fehlgeschlagenem Start; Abbruch bei unvollständiger Sicherung; Rücknahme einer Erstinstallation; keine Datenbank-Rückkopie über einen nicht gestoppten Dienst; Konfiguration, IPv6, Port und reale Symlink-Ziele.

- Proxmox-Host: unverändernder Dry-Run, Schutz belegter Cluster-IDs, Bridge-/Speicher-/Mindestwertprüfungen, automatische und eigene Ressourcen, richtige Debian-/Architektur-Auswahl, Wiederverwendung von Templates, Quellcodepaket ohne .git/.env/Daten, prüfsummengeprüfte Übertragung sowie Erhalt des neuen Containers ohne Autostart nach Fehlern.

Die Installer- und Host-Tests verwenden einen isolierten Dateibaum mit nachgebildeten Paket-, Konto- und systemd-Befehlen. Archiv-Prüfsummen, Dateioperationen und SQLite-Sicherung/Wiederherstellung werden tatsächlich ausgeführt; sie ersetzen keine Prüfung von UID-Zuordnung, AppArmor, Netz und systemd im echten LXC.

JavaScript-Syntax und Bash-Syntax des Installers geprüft. Der Server wurde gestartet und die API getestet. Der Proxmox-Installer und Docker wurden **nicht** auf einer echten Zielmaschine ausgeführt. Es bestand kein Zugang zum Proxmox des Nutzers.

**Keine visuelle Browser-Abnahme:** In dieser Arbeitsumgebung fehlte die Browser-Vorschau-Infrastruktur. Ein Versuch mit installiertem Playwright konnte ebenfalls keinen lokalen Browser starten. Die Ansichtslogik wurde danach ohne Browser getestet; das ersetzt keine echte Bedienungs- und Layoutprüfung. Es gibt keine geprüften Screenshots. Responsive CSS ist implementiert, muss aber auf realen Bildschirmgrößen abgenommen werden.

**Keine Live-Abnahme von Google und Immich:** Eigene Konten, OAuth-Konfiguration, Domain und Immich-Instanz/Version standen nicht zur Verfügung. Tests dieser Anbindungen verwenden kontrollierte Ersatzantworten, keine realen Benutzerkonten.

## Bekannte Grenzen von 0.1

1. Ein Familienpasswort und dieselben Rechte für alle Geräte. Die Anzeige „Kind“ vergibt keine beschränkten Rechte. Vor einem Einsatz mit frei bedienbaren Kindergeräten Elternschutz/PIN und Rechte ergänzen.
2. Google-Polling statt Push; Abruffenster 90 Tage zurück / 366 Tage vor. Importierte Google-Serien werden als einzelne Vorkommen bearbeitet. Lokale wiederkehrende Termine fehlen noch.
3. Noch keine vollständige Konfliktoberfläche für gleichzeitige Änderungen direkt in Google und in der Familienzentrale. Nach erfolgreicher Übertragung wird der Google-Stand beim folgenden Import maßgeblich.
4. Keine Browser-Offlinebearbeitung. Gemeinsame Daten brauchen den eigenen Server. Gerätefotos sind lokal und nicht auf andere Geräte synchronisiert.
5. Kein automatischer Bildschirmschoner, keine Push-Erinnerungen, keine native App. Die Diashow wird bewusst gestartet.
6. Netzwerkquelle braucht JSON-Bilderliste auf demselben Ursprung. Keine automatische allgemeine Verzeichnis-, SMB- oder WebDAV-Erkennung.
7. Standardmäßig eine Mahlzeit pro Tag. Frühstück/Mittag/Abend als getrennte Slots und erweiterte Rezeptimporte können später ergänzt werden.
8. JSON-Export dient dem Lesen der Familiendaten. Vollständige Wiederherstellung nutzt SQLite-Sicherung und Originalschlüssel; eine Import-/Restore-Oberfläche fehlt.
9. Kleine Haushalte sind Zielgruppe. Große Datenmengen, langjährig wachsende Erledigungslisten und sehr große Fotobibliotheken sind noch nicht unter Last geprüft.
10. Kein Stundenplan-Modul und keine native App; ausdrücklich nach hinten gestellt.

## Konkreter nächster Entwicklungsschritt

**Zuerst Version 0.1.2 über die README auf dem tatsächlichen Proxmox installieren und abnehmen.** Der Quellcode wird im privaten Repository des Nutzers bereitgestellt; kein Zugriff auf dessen Proxmox wurde eingerichtet. Keine Zugangsdaten in Chat oder Repository aufnehmen. Google/Immich-Zugangsdaten trägt der Nutzer privat auf dem Server bzw. in der Oberfläche ein.

1. LXC-Start, Betrieb nach Neustart und Sicherung/Wiederherstellung auf dem tatsächlichen System prüfen.
2. Browser-Abnahme bei 390×844, 768×1024, 1440×900 und auf dem verwendeten Wanddisplay; Hoch-/Querformat, lange Namen, 200 % Schrift und Touch testen.
3. Eigene Google-Domain/OAuth einrichten; zwei Konten und einen gemeinsam freigegebenen Kalender testen; Serien, ganztägige und mehrtägige Termine, Leserechte, Ausfall/Wiederverbindung und DST testen.
4. Immich-Version feststellen und Album-/Bild-Endpunkte samt Schlüsselrechten live prüfen. Lokale Gerätefotos nach Browserneustart, Container-Mounts und Netzwerkmanifest testen.
5. Elternschutz/PIN und Rechte, bessere Konfliktbehandlung und lokale Kalenderwiederholungen ergänzen. Dadurch Webversion weiter festigen.
6. Danach Stundenpläne: Personenbezug, Fächer/Farben, Uhrzeitblöcke, Wochentage, ggf. A/B-Wochen und Ferien. Anforderungen vor Umsetzung konkretisieren.
7. Erst anschließend die App planen; die vorhandene HTTP-API ist die Grundlage. Native Plattform, Offlinebedarf und Benachrichtigungen erst dann entscheiden.

## Dateien zum Einstieg

- `README.md`: Start und Funktionsübersicht.
- `scripts/create-proxmox-lxc.sh`: Neue Container auf dem Proxmox-Host erstellen und installieren.
- `docs/PROXMOX.md`: GitHub-Download, Host-Aufruf, Mindestwerte und Optionen.
- `docs/LXC.md`: Installation, Sicherung, Wiederherstellung und Updates im LXC.
- `docs/INTEGRATIONS.md`: Google, Immich und Bilderquellen.
- `server.mjs`: HTTP, Anmeldung, API und statische Dateien.
- `src/store.mjs`: Datenbank und Verschlüsselung.
- `src/model.mjs`: Validierung und Buchungslogik.
- `src/google.mjs`: OAuth und Abgleich.
- `src/photos.mjs`: Bilderquellen und Proxy.
- `public/app.js`: Ansichten und Interaktionen.
- `public/style.css`, `public/tokens.css`: responsive Darstellung.
- `tests/`: reproduzierbare Prüfungen mit `npm test`.

## Kontingent und Wiederaufnahme

Ein Modell kann das verbleibende ChatGPT-Nutzungsvolumen hier nicht verlässlich auslesen und keine automatische Wiederaufnahme bei dessen Erneuerung auslösen. Es wurde dafür keine Automation eingerichtet. Sollte die Arbeit unterbrochen werden, dieses Projektpaket bzw. das GitHub-Repository und diese Datei für die nächste Sitzung bereitstellen. Fortsetzungsanweisung: „Setze Familien Organisierer anhand von PROJECT_STATE.md fort.“

Vor Weiterentwicklung vorhandene Daten, Einstellungen und Änderungen erhalten. Nicht bei null starten, keine alternative Architektur allein aus Bequemlichkeit einführen und keine native App vorziehen. Tests nach relevanten Änderungen erneut ausführen und diesen Stand aktualisieren. Quellcode kann in GitHub liegen; echte Familiendaten, Fotos, `.env`, Schlüssel und Sicherungen bleiben auf dem selbst betriebenen Speicher.

## GitHub-Stand

Der Nutzer hat am 2026-10-06 das Repository [etzewetze/Familien-Organizer](https://github.com/etzewetze/Familien-Organizer) ausgewählt. Zugriff und Schreibrechte wurden über die bestehende GitHub-Verbindung erfolgreich geprüft. Das Repository ist privat; die initiale README wird durch die vollständige Projektanleitung ergänzt. Der komplette Quellcode einschließlich beider Installer, Dokumentation, Tests und dieses Fortsetzungsstands wird auf `main` bereitgestellt. Das andere öffentliche Repository `extraitems` bleibt unberührt.

Die Übertragung erfolgt als zusammenhängender Git-Commit mit dem bisherigen Repository-Commit als Elternstand und einer Prüfung gegen den erwarteten Branch-Stand. Quellcode und Skripte anhand des resultierenden Commits kontrollieren. Es werden keine echten `.env`, Familiendaten, Fotos, SQLite-Dateien, Schlüssel oder Sicherungen hochgeladen. Die `.gitignore` schützt die Standardpfade; externe Datenordner ebenfalls außerhalb des Quellcodes halten.

Keine generelle Upload-Erlaubnis erneut erfragen: Das Ziel und der Upload sind vom Nutzer ausdrücklich vorgegeben. Repository nicht ohne neue ausdrückliche Anweisung öffentlich machen. Bei ausgeschöpftem ChatGPT-Kontingent diesen Repository-Stand zur Fortsetzung verwenden. Stundenpläne und native App bleiben spätere Schritte.
