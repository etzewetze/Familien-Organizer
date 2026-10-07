# Projektstand und Fortsetzung

**Projekt:** Familien Organisierer  
**Stand:** 2026-10-07, Version 0.1.2, Datenbankschema 1
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
- Repository vom Nutzer vorgegeben: https://github.com/etzewetze/Familien-Organizer; ursprünglich privat, am 2026-10-07 vom Nutzer öffentlich gestellt und öffentliche Sichtbarkeit per GitHub geprüft.
- Ein Aufruf aus der README soll einen LXC auf dem Proxmox-Host anlegen und die Anwendung installieren.
- GitHub-Anmeldung erfolgt mit Google; kein GitHub-Passwort vorhanden. Installation ohne Passworteingabe oder manuell erstellten Token anbieten, alternativ ohne GitHub-Anmeldung auf dem Host per Browser-ZIP.

## Was geliefert ist

Lauffähiger Node.js-Server, SQLite-Speicherung, deutsche Weboberfläche und API für alle Kernbereiche. Familienname, Mitglieder und Passwort werden bei der ersten Benutzung eingerichtet. Daten liegen gemeinsam auf dem Server, geöffnete Geräte laden Änderungen alle 15 Sekunden. Die Oberfläche besitzt acht Arbeitsbereiche; Stundenpläne sind als späterer Bereich gekennzeichnet.

Google-OAuth für mehrere Konten, Kalenderauswahl und Personenzuordnung; Import, Rückschreiben und persistente Warteschlange. Abgleich alle fünf Minuten plus sofortiger Versandversuch bei lokalen Terminänderungen. Immich-Alben und serverseitiges Weiterreichen der Bilder. Lokale Gerätefotos in IndexedDB. Netzwerk-Bilderlisten und eigener Fotoordner mit Upload.

Punktestand und Belohnungsbuchungen sind transaktional; Erledigung ist je Aufgabe/Tag idempotent. Zutatenübernahme skaliert Portionszahlen, führt gleiche Zutaten und Einheiten zusammen und vermeidet Verdopplungen bei erneutem Übernehmen. Bearbeitung gemeinsamer Datensätze prüft Revisionen gegen veraltete Geräteänderungen.

Vollständiger LXC-Installer für Debian 12/13 auf x86_64/ARM64: Host-/Containerprüfung, automatisches Debian-Paketsetup, offizieller Node.js-24-Download mit SHA-256-Prüfung und eigener Laufzeit, eigener Dienstbenutzer, systemd und HTTP-Startprüfung. Updates erhalten Konfiguration, Familiendaten und Fotos, sichern vor dem Wechsel vollständig und stellen nach einem fehlgeschlagenen Start vorherigen Code, Laufzeit, Dienst und Datenbank wieder her. Kann der neue Dienst nicht gestoppt werden, bleibt die Sicherung für die manuelle Wiederherstellung erhalten. Keine automatische Löschung alter Sicherungen oder Laufzeiten.

Host-Skript `scripts/create-proxmox-lxc.sh`: Erstellt auf Proxmox >=8 (x86_64) einen neuen unprivilegierten LXC aus dem aktuellen offiziellen Debian-Template und installiert darin die Anwendung. Startwerte: 1 Kern, 1024 MiB RAM, 512 MiB Swap, 8 GiB Disk. Clusterweit freie ID, aktive Speicher und Bridge werden geprüft; eigene IDs, Speicher, Bridge, IPv4, Gateway, VLAN und größere Ressourcen sind konfigurierbar. Debian 12 für Proxmox 8, Debian 13 für Proxmox >=9. Debian 13 erhält nach der realen Rückmeldung `nesting=1` für systemd-Basisdienste; Debian-12-Erstellung bleibt unverändert. Nur Vorprüfung via --dry-run. Autostart erst nach erfolgreicher Installation, keine Container-Löschung bei Fehlern. Quellcode wird ohne Git-Metadaten und Zugangsdaten vom Host übertragen; SHA-256 prüft die Übertragung.

Nach der D-Bus-Rückmeldung ist auch die vererbte `umask` korrigiert: `pct` läuft in einem eigenen Kindprozess mit `022`, damit Proxmox/tar Systemverzeichnisse mit zugänglichen Standardrechten anlegt. Der übergeordnete Installer behält `077` für Sperrdatei und private temporäre Quelldateien. Bestehende Container werden dadurch nicht automatisch geändert; eine auf `/etc` begrenzte, vorab geprüfte Reparatur steht in `docs/PROXMOX.md`.

README enthält jetzt den öffentlichen HTTPS-Download plus Skriptaufruf ohne GitHub-Anmeldung. Für eine spätere private Sichtbarkeit sind die offizielle GitHub-CLI-Installation und Browser-Bestätigung per Einmalcode als Alternative erhalten: Google-Anmeldung im Browser auf PC/Handy; kein GitHub-Passwort und kein manuell erstellter Token nötig. Alternativ Browser-ZIP nach Proxmox kopieren und lokal entpacken. Es wird kein vorinstalliertes CT-Template veröffentlicht. Die GitHub-Verbindung in ChatGPT überträgt keine Anmeldedaten auf Proxmox.

Nach der ersten realen Rückmeldung prüft der LXC-Installer vor Paketdownloads die DNS-Auflösung von Debian, Debian Security und Node.js. APT-Indexabruf mit `--error-on=any`, drei Wiederholungsversuchen und HTTP-Zeitlimits verhindert das Weiterarbeiten mit fehlgeschlagenen Paketlisten. Für neue Container ist `--nameserver` als erreichbarer IPv4-DNS-Server optional; ohne Auswahl bleibt die Proxmox-Übernahme der Host-Einstellung erhalten. Die Fehlermeldung zeigt die Wiederaufnahme im bestehenden LXC nur dann an, wenn der Quellcode schon vorhanden ist. `docs/PROXMOX.md` enthält DNS-/Routing-Diagnose und Fortsetzung ohne weitere Container-Erstellung.

Optional Docker, konsistente SQLite-Sicherung inklusive Schlüssel und Fotos sowie Passwort-Wiederherstellung sind enthalten. Keine externen npm-Laufzeitabhängigkeiten, kein Build-Schritt. Node 24 empfohlen, >=22.13 erforderlich.

## Prüfungen

`npm test`: **40 Tests bestanden** (20 Anwendungstests, 11 Installer-/Konfigurationstests, 9 Proxmox-Hosttests). Die DNS-Korrektur wurde am 2026-10-07 mit dem vollständigen Testlauf geprüft; außerdem 26 Bash-Blöcke in den Anleitungen auf Syntax geprüft.

Für die anschließende Nesting-Korrektur die **9 betroffenen Proxmox-Hosttests erneut bestanden**, einschließlich der Nesting-Option bei Debian 13 und unveränderter Debian-12-Erstellung. Bash-Syntax des Erstellers sowie jetzt 29 Bash-Blöcke der Anleitungen geprüft. Anwendungscode und innerer LXC-Installer sind bei dieser Korrektur unverändert.

Für die Umask-Korrektur die **10 betroffenen Proxmox-Hosttests bestanden**. Der neue Regressionstest entpackt ein echtes Archiv mit einem Datei-Eintrag vor dem Verzeichniseintrag und Proxmox' `--skip-old-files`: vor der Korrektur reproduzierbar `/etc` mit `700`, nach der Korrektur `755`; temporäres Verzeichnis weiterhin `700`, Quellarchiv und Sperrdatei weiterhin `600`. Bash-/JavaScript-Syntax, `git diff --check` und 31 Bash-Blöcke der Anleitungen geprüft. Der letzte vollständige Testlauf hatte 40 Tests; seither ist dieser Host-Regressionstest hinzugekommen. Anwendungscode und innerer Installer sind bei der Umask-Korrektur unverändert.

Die anschließende reine Dokumentationskorrektur zum D-Bus-Prüfblock und Neuaufbau von Container 100 wurde mit `git diff --check` und **32 Bash-Blöcken** auf Syntax geprüft. Kein Anwendungs- oder Installer-Code wurde dabei geändert; die 10 Hosttests wurden deshalb nicht erneut ausgeführt.

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
- Neue DNS-Tests: Ausfall jeder Download-Domain stoppt vor Paket-/Dienst-/Datenänderungen; Indexabruf mit vorübergehendem Fehler wird als Fehler erkannt und startet keine Paketinstallation; eigener DNS wird geprüft/übergeben, ohne Auswahl bleibt die Host-Einstellung erhalten; Wiederaufnahme-Befehl nur bei tatsächlich übertragenem Quellcode.

Die Installer- und Host-Tests verwenden einen isolierten Dateibaum mit nachgebildeten Paket-, Konto- und systemd-Befehlen. Archiv-Prüfsummen, Dateioperationen und SQLite-Sicherung/Wiederherstellung werden tatsächlich ausgeführt; sie ersetzen keine Prüfung von UID-Zuordnung, AppArmor, Netz und systemd im echten LXC.

JavaScript-Syntax und Bash-Syntax des Installers geprüft. Der Server wurde gestartet und die API getestet. Es bestand kein direkter Zugang zum Proxmox des Nutzers; Docker wurde nicht auf einer Zielmaschine ausgeführt.

**Erste reale Proxmox-Rückmeldung am 2026-10-07:** Der Nutzer hat die öffentliche HTTPS-Installation gestartet. Repository-Download, Template-Auswahl und Erstellung des unprivilegierten Debian-13-Containers **100** mit den Mindestwerten sowie die Quellcode-Übertragung waren erfolgreich. Der Paketabruf scheiterte danach an `Temporary failure resolving` für Debian-/Security-Adressen. Der Container bleibt erhalten, Autostart ist aus. Aktuelle IPv4-Adresse, Route, Resolver und fehlgeschlagene Dienste sind noch nicht bekannt. DNS-/Netzwerkursache und vollständige Installation bleiben offen; der Nutzer soll die Diagnoseausgabe liefern und anschließend im selben LXC fortsetzen. Die Systemd-257-/Nesting-Warnung allein belegt keine DNS-Ursache. Keine echten Zugangsdaten oder vollständigen Nutzerlogs in GitHub aufnehmen.

**Zweite Rückmeldung:** DHCP-Adresse und Standardroute sind vorhanden; der Router als Resolver löst beide Debian-Adressen aktuell als root erfolgreich auf. Fünf Basisdienste/-Mounts sind fehlgeschlagen: `dev-mqueue.mount`, `run-lock.mount`, `tmp.mount`, `dbus.service`, `dbus.socket`. Nach aktiviertem Nesting und vollständigem Stoppen/Starten sind die drei Mount-Fehler auf dem Nutzerhost verschwunden; D-Bus und dessen Socket bleiben fehlgeschlagen. Für neue Debian-13-Container ist Nesting inzwischen voreingestellt. Genaue LAN-Adressen und vollständige Nutzerlogs werden nicht in GitHub übernommen.

**D-Bus-Journal:** Der Dienst erhält `Permission denied` beim Lesen der Benutzerinformationen und `/etc/dbus-1/system.conf`; der Socket scheitert als Folge des wiederholten Dienstfehlers. Das ursprüngliche Host-Skript vererbte `umask 077` an `pct`. Der echte tar-Regressionstest reproduziert dadurch ein nur für root zugängliches `/etc` mit `700`. Das erklärt auch, wie root-DNS funktionieren kann, während `_apt` keine Resolver-Datei lesen kann; der ursprüngliche DNS-Ausfall ist bis zur Prüfung auf dem Zielhost eine Schlussfolgerung. Das Skript ist korrigiert und die Anleitung prüft Besitzer/Modus, bevor ausschließlich `/etc` von `700` auf `755` geändert wird. Der genaue Modus und die erfolgreiche Reparatur auf dem Nutzerhost sind noch nicht bestätigt. Anschließend im bestehenden LXC installieren und Autostart erst nach erfolgreicher Startprüfung aktivieren.

**Weitere Nutzerprüfung am 2026-10-07:** `/etc` ist tatsächlich `700 root:root`; `/` und `/etc/dbus-1` sind `755`, `/etc/passwd` ist `644`. Der Reparaturblock brach bereits bei `stat` ab, weil `/etc/dbus-1/system.conf` nicht existiert; die Rechte wurden deshalb noch nicht geändert. Auch der anschließende Installationsblock brach korrekt bei `degraded` ab. Die Anleitung ist korrigiert: keine zwingende lokale D-Bus-Konfiguration unter `/etc`, sondern die offizielle Standardkonfiguration unter `/usr/share/dbus-1/system.conf`, falls kein lokaler Ersatz vorhanden ist. Der Nutzer schlägt vor, den noch unfertigen Container zu löschen und neu zu erstellen. Ein konkreter Neuaufbau mit aktualisiertem Host-Checkout, Vorprüfung und ausdrücklicher ID 100 ist jetzt dokumentiert; die manuelle Löschung ist auf diesen unfertigen Container beschränkt. Der Ersteller selbst löscht weiterhin nichts. Auf dem Nutzerhost wurden Löschung und Neuinstallation noch nicht ausgeführt bzw. nicht bestätigt.

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

**Nach der aktuellen Nutzerpräferenz den unfertigen Container 100 mit dem korrigierten Ersteller neu aufsetzen.** Zuerst den Host-Checkout mit `git pull --ff-only` aktualisieren und `--dry-run` prüfen; danach den unfertigen LXC 100 stoppen/löschen und ausdrücklich mit `--vmid 100` neu erstellen. Das aktuelle Skript setzt Debian-13-Nesting und korrigiert die vererbte umask; Anwendung und innerer Installer sind unverändert. Die vorherige Reparatur ist an einer falschen Dateipfad-Annahme im Prüfblock gescheitert; die Anleitung ist ebenfalls korrigiert. Der Quellcode liegt im öffentlichen Repository; kein direkter Zugriff auf den Proxmox des Nutzers wurde eingerichtet. Nach erfolgreicher Installation Version 0.1.2 abnehmen; der Ersteller aktiviert Autostart erst nach erfolgreicher Startprüfung. Keine Zugangsdaten in Chat oder Repository aufnehmen. Google/Immich-Zugangsdaten trägt der Nutzer privat auf dem Server bzw. in der Oberfläche ein.

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

Der Nutzer hat am 2026-10-06 das Repository [etzewetze/Familien-Organizer](https://github.com/etzewetze/Familien-Organizer) ausgewählt. Zugriff und Schreibrechte wurden über die bestehende GitHub-Verbindung erfolgreich geprüft. Die initiale README wurde durch die vollständige Projektanleitung ergänzt. Der komplette Quellcode einschließlich beider Installer, Dokumentation, Tests und dieses Fortsetzungsstands liegt auf `main` (Erstübertragung `c1fbc9cc027525b9a462f81273f7e1914eac6575`). Am 2026-10-07 wurde zunächst der Google-Login dokumentiert (`f1e00a296a16e2f400ec13423e0c3b6340dbb588`), danach hat der Nutzer das Repository öffentlich gestellt. Öffentliche Sichtbarkeit wurde geprüft; der anonyme Download steht wieder vorn in der README. Die DNS-Korrektur verändert Installationsskripte und Tests, nicht den Anwendungscode oder das Datenbankschema; App-Version bleibt 0.1.2. Das andere öffentliche Repository `extraitems` bleibt unberührt.

Die Übertragung erfolgt als zusammenhängender Git-Commit mit dem bisherigen Repository-Commit als Elternstand und einer Prüfung gegen den erwarteten Branch-Stand. Quellcode und Skripte anhand des resultierenden Commits kontrollieren. Es werden keine echten `.env`, Familiendaten, Fotos, SQLite-Dateien, Schlüssel oder Sicherungen hochgeladen. Die `.gitignore` schützt die Standardpfade; externe Datenordner ebenfalls außerhalb des Quellcodes halten.

Keine generelle Upload-Erlaubnis erneut erfragen: Das Ziel und der Upload sind vom Nutzer ausdrücklich vorgegeben. Repository-Sichtbarkeit nicht ohne ausdrückliche Anweisung verändern. Bei ausgeschöpftem ChatGPT-Kontingent diesen Repository-Stand zur Fortsetzung verwenden. Stundenpläne und native App bleiben spätere Schritte.
