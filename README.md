# Familien Organisierer

Eine eigenständige, deutschsprachige Familienzentrale zum Selbsthosten. Funktional an den beschriebenen Familienkalender angelehnt; eigener Quellcode, eigenes Design und keine Abhängigkeit von Dæly. Keine übernommenen Markenassets oder proprietären Programmteile.

**Version 0.1.2 ist eine lauffähige erste Entwicklungsfassung.** Sie ist für einen privaten Haushalt im eigenen Netz gedacht. Alle Familiengeräte verwenden dasselbe Familienpasswort und dieselben Bearbeitungsrechte. Eine native App und Stundenpläne folgen später.

## Neuen Proxmox-LXC automatisch anlegen

In Proxmox den **Host → Shell** öffnen und als root ausführen:

```bash
git clone https://github.com/etzewetze/Familien-Organizer.git /root/Familien-Organizer && bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh
```

Dieses Repository ist **privat**. Beim HTTPS-Download GitHub-Benutzername und einen Lesetoken als Git-Passwort verwenden, oder mit einem bereits eingerichteten SSH-Schlüssel klonen. Der Token braucht für dieses Repository nur **Contents: Read**. Die GitHub-Verbindung in ChatGPT meldet deinen Proxmox-Host nicht bei GitHub an. Falls `git` fehlt, zuerst `apt-get install -y git` ausführen. Alternativ im angemeldeten GitHub **Code → Download ZIP**, auf dem Host entpacken und daraus `bash scripts/create-proxmox-lxc.sh` ausführen.

Das Skript wählt eine freie Container-ID, prüft vorhandene Speicher und Bridge, lädt ein offizielles Debian-Template, erstellt einen unprivilegierten LXC und installiert die Anwendung. Die abschließend angezeigte Adresse `http://CONTAINER-IP:8080` öffnen und Familie/Passwort einrichten. Die Proxmox-Konsole ist direkt als Shell nutzbar; es gibt kein fest eingebautes Root-Passwort.

| Einstellung | Mindest-Startwert / Standard |
|---|---|
| CPU | 1 Kern |
| RAM | 1024 MiB |
| Swap | 512 MiB |
| Systemdisk | 8 GiB; zusätzliche Kapazität für Fotos und Sicherungen |
| Betriebssystem | Debian 12 auf Proxmox 8; Debian 13 auf Proxmox >=9 |
| Netzwerk | `vmbr0`, IPv4 per DHCP; bei abweichender Einrichtung konfigurierbar |
| Betrieb | Unprivilegierter LXC, systemd, Autostart nach erfolgreicher Installation |

Andere Speicher, Bridge, VM-ID oder mehr Ressourcen:

```bash
bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh --vmid 120 --rootfs-storage local-lvm --template-storage local --bridge vmbr0 --cores 2 --memory 2048 --disk 16
```

Vorher nur prüfen: `bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh --dry-run`. Eine vorhandene ID wird abgewiesen. Jeder normale Aufruf erstellt einen **neuen** Container; Updates sind in der LXC-Anleitung beschrieben.

Ein CT-Template enthält ein komplettes Linux-Dateisystem. Das Projekt-ZIP ist Quellcode; der automatische Weg nutzt das offizielle Debian-CT-Template und installiert die Familienzentrale anschließend darin.

[Host-Skript ansehen](scripts/create-proxmox-lxc.sh) · [Host-Anleitung und Optionen](docs/PROXMOX.md) · [Betrieb, Updates und Sicherung im LXC](docs/LXC.md)

## Schnell ausprobieren

Node.js **24.x empfohlen**, mindestens **22.13.0**. Es gibt keine externen npm-Abhängigkeiten und keinen Build-Schritt.

```bash
cd familien-organisierer
npm start
```

Im Browser `http://localhost:8080` öffnen, Familiennamen, Mitglieder und ein Passwort mit mindestens zwölf Zeichen eintragen. Optional Beispiele hinzufügen. Auf anderen Geräten die IP des Servers statt `localhost` verwenden. Gemeinsame Daten werden auf dem Server gespeichert; geöffnete Geräte laden Änderungen alle 15 Sekunden nach.

`npm run demo` startet separat eine Demo auf Port 4173 mit fiktiven Daten, die beim Beenden verworfen werden. **Die Demo hat absichtlich keine Anmeldung und darf nur zum Ausprobieren im eigenen Netz dienen.** Sie verwendet nie den produktiven Datenordner. `npm start` startet die normale Anwendung mit Anmeldung.

## Enthaltene Funktionen

| Bereich | Stand in 0.1 |
|---|---|
| Kalender | Wochen-, Monats- und Listenansicht; ganztägige und mehrtägige Termine; Personenfarben und Filter; anlegen, bearbeiten, löschen |
| Google Kalender | Mehrere Konten über OAuth; Kalenderauswahl und Personenzuordnung; importieren und Änderungen zurückschreiben; Wiederholungsversuche bei Verbindungsfehlern |
| Aufgaben und Routinen | Einmalig, täglich, werktags oder wöchentlich; Zuordnung zu Personen; Abhaken nach Tag |
| Punkte | Einmalige Gutschrift je Erledigung; selbst definierte Belohnungen; Einlösungen und Punktestand |
| Essen und Rezepte | Wochenplan, Rezeptverwaltung, Zutaten, Zubereitung und Portionszahlen |
| Einkauf | Zutaten skalieren und zusammenführen; erneut übernehmen ohne Verdopplung; manuelle Ergänzungen und Abhaken |
| Listen und Notizen | Eigene Checklisten, Kategorien, Mengen und angeheftete Notizen |
| Fotos | Nur auf dem Gerät gespeicherte Bilder; Container-Ordner und Upload; Netzwerk-Bilderliste; Immich-Alben; Diashow mit Uhr |
| Geräte | Responsive Weboberfläche für Handy, Tablet, PC und Wandbildschirm; manueller Vollbildmodus |
| Betrieb | SQLite, systemd für LXC, optional Docker, vollständiges Sicherungsskript und Datenexport |

**Wichtig zum Entwicklungsstand:** Google- und Immich-Anbindungen sind implementiert, aber noch nicht gegen deine Konten bzw. deine Instanz getestet. Google wird alle fünf Minuten abgeglichen; neue Änderungen werden zusätzlich sofort zum Versand angestoßen. Dies ist kein Echtzeit-Push. Der Google-Abruf umfasst 90 Tage Vergangenheit und 366 Tage Zukunft. Wiederkehrende Google-Termine werden in diesem Zeitraum als einzelne Vorkommen angezeigt und einzeln bearbeitet. Lokale wiederkehrende Kalendertermine sind noch nicht enthalten; wiederkehrende Aufgaben sind enthalten.

## Installation auf Proxmox LXC

Die vollständige Anleitung steht in [docs/LXC.md](docs/LXC.md). Ein unprivilegierter Debian-LXC genügt; Docker im LXC ist nicht erforderlich. Empfohlener Anfang: 1–2 vCPU, 1 GB RAM, 8–16 GB Systemdisk, zusätzliche Kapazität für Fotos.

1. Projekt in den LXC kopieren und entpacken oder aus dem eigenen GitHub-Repository klonen.
2. Im Projektordner als root `bash scripts/install-lxc.sh --check` ausführen.
3. `bash scripts/install-lxc.sh` ausführen; Debian-Pakete, Node.js 24 und der systemd-Dienst werden automatisch eingerichtet.
4. `http://CONTAINER-IP:8080` öffnen und Familie einrichten.

Der Installer unterstützt Debian 12/13 auf x86_64 und ARM64. Node.js kommt mit SHA-256-Prüfung vom offiziellen Downloadserver und erhält einen eigenen Laufzeitordner. Der Dienst startet nach einem Container-Neustart automatisch. Für ein Update im neuen Projektstand dasselbe Skript erneut ausführen: `.env`, Daten und Fotos werden erhalten; vor dem Wechsel entsteht eine vollständige Updatesicherung. Bei einem fehlgeschlagenen Start stellt das Skript vorherigen Code, Laufzeit und Datenbank wieder her. Die Abläufe sind mit isolierten Systembefehlen getestet; die Abnahme auf deinem echten Proxmox steht noch aus.

## Google und Fotos einrichten

- Google: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md). Du brauchst dein eigenes Google-Cloud-Projekt, OAuth-Zugangsdaten und für dauerhaften Betrieb eine HTTPS-Adresse mit eigener Domain. Das Kernsystem funktioniert auch ohne Google.
- Immich und Netzwerkbilder: dieselbe Anleitung. Der Immich-Schlüssel bleibt verschlüsselt auf deinem Server. Netzwerkbilder nutzen ein einfaches JSON-Manifest, keine herstellerspezifische Cloud.
- Gerätefotos bleiben in IndexedDB dieses Browsers. Sie werden nicht automatisch auf andere Geräte übertragen und gehen beim Löschen der Browserdaten verloren.

## Sicherung und Weiterentwicklung

```bash
npm test
node scripts/backup.mjs /pfad/zu/sicherungen
```

Das Sicherungsskript erzeugt einen konsistenten SQLite-Schnappschuss und kopiert Schlüssel, Fotos und gegebenenfalls `.env`. Es ist keine Verschlüsselung des gesamten Backups: Sicherungsordner privat aufbewahren. Wiederherstellung steht in der LXC-Anleitung. Der JSON-Export in der Oberfläche ist ein lesbarer Datenexport; er ersetzt die vollständige Sicherung und deren Wiederherstellung nicht.

[PROJECT_STATE.md](PROJECT_STATE.md) hält Umfang, Prüfungen, Grenzen und nächste Schritte fest. Für die Fortsetzung genügt das Projektpaket zusammen mit dieser Datei. Der Quellcode liegt im privaten Repository [etzewetze/Familien-Organizer](https://github.com/etzewetze/Familien-Organizer). Zugangsdaten, Familiendaten, Fotos und Sicherungen bleiben auf dem eigenen Server.

## Technik

Node.js mit eingebautem HTTP-Server und `node:sqlite`; SQLite im WAL-Modus; ES-Module, HTML und CSS ohne fremde Laufzeitpakete. Keine CDNs, Analysedienste, externen Fonts oder kostenpflichtigen Cloud-Datenbanken. Ausgehende Zugriffe finden bei aktivierten Google-/Bilder-Anbindungen statt. Sitzungen nutzen HttpOnly-Cookies; Schreibzugriffe prüfen Anfragequelle und Header. Die Oberfläche maskiert gespeicherte Texte; Punktebuchungen laufen in Datenbanktransaktionen.

Die Datenbank hat eine Schema-Version als Grundlage für spätere Migrationen. Die HTTP-API kann später von einer App genutzt werden; eine App ist in dieser Version nicht vorgezogen worden.

Lizenz: MIT. Siehe [LICENSE](LICENSE).
