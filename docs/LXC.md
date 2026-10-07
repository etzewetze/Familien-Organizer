# Proxmox LXC: Installation und Betrieb

Der Installer läuft **als root innerhalb eines eigenen Debian-LXC**. Er erkennt einen Proxmox-Host und verweigert dort die Installation. Der Container wird zuerst in Proxmox angelegt; das Skript verändert keine VMIDs, Storage-Einstellungen oder Netzwerke des Hosts.

Für die automatische Erstellung des Containers auf dem **Proxmox-Host** zuerst [PROXMOX.md](PROXMOX.md) verwenden. Die folgenden Schritte gelten für einen bereits vorhandenen LXC.

## 1. Container vorbereiten

Einen unprivilegierten Debian-12- oder Debian-13-LXC mit systemd anlegen. Ausgangspunkt: 1–2 vCPU, 1 GB RAM und 8–16 GB Systemdisk; Fotos und Sicherungen benötigen zusätzlichen Platz. Eine stabile IP per DHCP-Reservierung oder statischer Konfiguration vergeben. Unterstützt werden x86_64 und ARM64. Docker wird für diese direkte Installation nicht benötigt; Debian 13 erhält die Nesting-Freigabe für systemd.

Die Anwendung läuft als eigener Benutzer ohne Administratorrechte. Der Quellcode gehört root, die Konfiguration ist privat lesbar, Datenordner und Sicherungen sind privat. Bei Debian 13 **Nesting in den Proxmox-Container-Features aktivieren**, damit die systemd-Basisdienste funktionieren. Docker wird nicht benötigt. Der Standarddienst der Anwendung verwendet keine zusätzlichen Mount-Namensräume; `NoNewPrivileges`, eine leere Capability-Liste und beschränkte Adressfamilien bleiben aktiv.

## 2. Projekt übertragen und installieren

### Mit dem ZIP

Das vollständige ZIP auf dem eigenen Rechner herunterladen und in den LXC nach `/root` kopieren, beispielsweise mit `scp` oder der eigenen Dateiablage. In der LXC-Konsole:

```bash
apt-get update
apt-get install -y unzip
cd /root
unzip familien-organisierer-v0.1.2.zip
cd familien-organisierer
bash scripts/install-lxc.sh --check
bash scripts/install-lxc.sh
```

`--check` prüft Ziel und Projektdateien, ohne etwas zu installieren. Der normale Aufruf installiert Debian-Pakete, lädt die aktuelle Node.js-24-Version von `nodejs.org`, prüft deren SHA-256-Prüfsumme und richtet den Dienst ein. Kein manuelles Node.js-Setup, kein `npm install` und kein Build-Schritt sind nötig. Eine vorhandene systemweite Node.js-Installation wird nicht ersetzt.

Bei Bedarf lässt sich eine bestimmte offizielle 24.x-Version auswählen:

```bash
bash scripts/install-lxc.sh --node-version v24.21.0
```

### Aus dem GitHub-Repository

Statt eines ZIPs kann das öffentliche GitHub-Repository ohne GitHub-Anmeldung geklont werden:

```bash
apt-get update
apt-get install -y git ca-certificates
cd /root
git clone https://github.com/etzewetze/Familien-Organizer.git familien-organisierer
cd familien-organisierer
bash scripts/install-lxc.sh --check
bash scripts/install-lxc.sh
```

Nur bei privater Sichtbarkeit benötigt das Repository GitHub-Authentifizierung auf dem LXC. SSH mit Zugriff nur auf dieses Repository ist eine Möglichkeit. Bei HTTPS einen Token über die interaktive Git-Abfrage eingeben; Tokens nicht in URLs, Skripte, Chat oder Quellcode schreiben. Die GitHub-Verbindung hier in ChatGPT überträgt keine Git-Anmeldedaten in deinen LXC.

Ein GitHub- oder Google-Passwort wird dafür nicht benötigt. Für einen Account mit Google-Anmeldung die aktuelle GitHub CLI und Browser-Bestätigung aus [PROXMOX.md](PROXMOX.md#browser-bestätigung-ohne-passwort-oder-manuell-erstellten-token) verwenden; im bestehenden LXC danach in einen neuen Quellcodeordner klonen und `scripts/install-lxc.sh` starten. **Den Container-Ersteller dort nicht verwenden.** Oder **Code → Download ZIP** im angemeldeten Browser herunterladen: das GitHub-ZIP heißt `Familien-Organizer-main.zip` und enthält den Ordner `Familien-Organizer-main`; diese Namen anstelle der Namen im ZIP-Beispiel oben verwenden. Für den ZIP-Weg benötigt der LXC keine GitHub-Anmeldung.

## 3. Erster Start

Nach erfolgreicher Installation im eigenen Netz `http://CONTAINER-IP:8080` öffnen. Familie und Familienpasswort einrichten. Auf anderen Geräten dieselbe Adresse verwenden. Der Dienst wird automatisch beim Start des Containers aktiviert.

| Ort | Inhalt |
|---|---|
| `/opt/familien-organisierer` | Installierter Quellcode und private `.env` |
| `/opt/familien-organisierer-node` | Verknüpfung zur aktiven eigenen Node.js-Laufzeit |
| `/opt/familien-organisierer-runtime` | Installierte Node.js-Versionen |
| `/var/lib/familien-organisierer` | Datenbank, Entschlüsselungsschlüssel und Standard-Fotoordner |
| `/var/backups/familien-organisierer` | Private Updatesicherungen und vorheriger Quellcode |

```bash
systemctl status familien-organisierer --no-pager
journalctl -u familien-organisierer -n 50 --no-pager
curl -fsS http://127.0.0.1:8080/api/health
```

Der noch nicht eingerichtete Dienst muss zunächst im eigenen Netz bleiben. Eine öffentlich erreichbare HTTPS-Adresse kann später mit einem eigenen Reverse-Proxy eingerichtet werden.

## 4. Konfiguration und Bilder

`/opt/familien-organisierer/.env` bearbeiten und anschließend den Dienst neu starten:

```bash
systemctl restart familien-organisierer
```

Standard: `HOST=0.0.0.0`, `PORT=8080`, `DATA_DIR=/var/lib/familien-organisierer`. Für HTTPS `APP_URL=https://familie.deine-domain.de` und `COOKIE_SECURE=true` setzen. Google-OAuth benötigt die eigene Konfiguration; der Installer kann deine Zugangsdaten nicht erzeugen. Google, Immich und Netzwerkbilder sind in [INTEGRATIONS.md](INTEGRATIONS.md) beschrieben.

Für den Installer müssen `DATA_DIR` und `PHOTO_DIR` absolute Pfade sein. Daten/Fotos dürfen nicht unter dem Quellcode-, Laufzeit- oder Sicherungsordner liegen. Wird `DATA_DIR` später geändert, die vorhandenen Daten samt `master.key` bei gestopptem Dienst zuerst an den neuen Ort übertragen.

Bilder direkt in `/var/lib/familien-organisierer/photos` ablegen oder in der Oberfläche hochladen. Für einen eigenen Mount z.B. `PHOTO_DIR=/mnt/familienfotos` setzen. Der Dienstbenutzer `family-organizer` braucht Lesezugriff und für Uploads auch Schreibzugriff; im unprivilegierten LXC die UID-Zuordnung des Mounts beachten. Ein systemd-`ReadWritePaths`-Override ist für den beigelegten Standarddienst nicht nötig. Bei einem lesbaren, aber schreibgeschützten Mount funktionieren Uploads in diesen Ordner nicht.

## 5. Updates

Einen neuen Projektstand außerhalb von `/opt/familien-organisierer` entpacken oder den ursprünglichen Git-Checkout aktualisieren. Beim Git-Checkout prüft `--ff-only`, dass keine abweichende lokale Historie überschrieben wird:

```bash
cd /root/familien-organisierer
git pull --ff-only
bash scripts/install-lxc.sh
```

Das Skript bereitet die neue Laufzeit und den Quellcode zuerst vor. Dann stoppt es den vorhandenen Dienst, sichert Datenbank, Schlüssel, Konfiguration und Fotos, ersetzt den Quellcode, startet den Dienst und prüft seine HTTP-Antwort einschließlich Versionsnummer. Bestehende `.env`, Familiendaten, Fotos und eigene systemd-Drop-ins werden erhalten. Dateien, die im neuen Quellcode fehlen, werden nicht aus der alten Installation übernommen.

Schlägt der Start fehl, stoppt das Skript die neue Version und stellt vorherigen Code, Node.js-Verknüpfung, Dienstkonfiguration und den Datenbankstand vor dem Update wieder her. Neue Datenbankdateien werden für die Diagnose in einem privaten `failed-database-*`-Ordner behalten. Fotos bleiben erhalten; Einträge, die während eines fehlgeschlagenen Updates neu geschrieben wurden, können durch das Zurücksetzen der Datenbank entfallen. Bei der Erstinstallation wird der Dienst zurückgenommen, ein bereits erzeugter Datenordner bleibt erhalten.

Kann der neue Dienst nicht sicher gestoppt werden oder schlägt eine Wiederherstellung fehl, kopiert das Skript keine Datenbank über einen laufenden Dienst. Es meldet den Fehler und behält Arbeitsordner und Sicherungen für die manuelle Wiederherstellung. Bei vollem oder defektem Speicher ist eine automatische Wiederherstellung nicht garantiert.

Updatesicherungen, alte Laufzeiten und alte Quellcodekopien werden **nicht automatisch gelöscht**. Speicherplatz regelmäßig kontrollieren und nach geprüften Updates nicht mehr benötigte Stände entfernen. Bei künftigen Schemaänderungen gehören Datenbankmigrationen zur jeweiligen Version; 0.1.2 verwendet weiterhin Schema 1.

## 6. Separate Sicherung

In der LXC-Konsole als root:

```bash
cd /opt/familien-organisierer
/opt/familien-organisierer-node/bin/node scripts/backup.mjs /var/backups/familien-organisierer/manual
```

Die Sicherung enthält `family.sqlite`, `master.key`, Fotos, `.env` und `backup.json`. Die SQLite-Backup-API erstellt auch bei laufender Anwendung einen konsistenten Datenbankstand. Fotos werden anschließend kopiert; für einen vollständig ruhenden Stand den Dienst vorher stoppen und danach wieder starten. Es ist kein täglicher Sicherungsjob eingerichtet. Proxmox-Backups des Containers zusätzlich nutzen; externe Bind-Mounts separat berücksichtigen.

**Datenbank und Original-`master.key` gehören zusammen.** Ohne diesen Schlüssel können gespeicherte Google-/Immich-Geheimnisse nicht entschlüsselt werden. Sicherungen enthalten Zugangsdaten und gehören auf privaten Speicher, nicht in GitHub.

## 7. Wiederherstellung

Diese Schritte gelten für den Standarddatenordner. Platzhalter durch die eigene Sicherung ersetzen; einen freien Namen für den Rückfallordner verwenden:

```bash
systemctl stop familien-organisierer
mv /var/lib/familien-organisierer /var/lib/familien-organisierer-vor-restore
install -d -o family-organizer -g family-organizer -m 0700 /var/lib/familien-organisierer
cp /PFAD/ZUR/SICHERUNG/family.sqlite /var/lib/familien-organisierer/
cp /PFAD/ZUR/SICHERUNG/master.key /var/lib/familien-organisierer/
cp -a /PFAD/ZUR/SICHERUNG/photos /var/lib/familien-organisierer/photos
chown -R family-organizer:family-organizer /var/lib/familien-organisierer
chmod 600 /var/lib/familien-organisierer/family.sqlite /var/lib/familien-organisierer/master.key
systemctl start familien-organisierer
```

Die private `.env` bei Bedarf zusätzlich wiederherstellen. Bei einem externen `PHOTO_DIR` Bilder dorthin zurückkopieren oder die Konfiguration auf den wiederhergestellten Standardordner ändern. Den Rückfallordner erst nach geprüftem Start entfernen.

## 8. Passwort zurücksetzen

```bash
cd /opt/familien-organisierer
/opt/familien-organisierer-node/bin/node scripts/reset-password.mjs --confirm
```

Das Skript erzeugt ein neues zufälliges Familienpasswort und beendet vorhandene Sitzungen. Das ausgegebene Passwort privat aufbewahren und anschließend in den Einstellungen ändern.

## 9. GitHub und Prüfstand

Das Repository speichert Quellcode, Tests und `PROJECT_STATE.md`. `.env`, Laufzeitdaten, Schlüssel, Fotos und Sicherungen bleiben auf dem eigenen Server. Die `.gitignore` schließt die Standarddatenordner aus; externe Foto-/Backup-Ordner ebenfalls außerhalb des Repositorys halten.

Der Quellcode liegt im öffentlichen Repository [etzewetze/Familien-Organizer](https://github.com/etzewetze/Familien-Organizer). Der Host-Installer kopiert ausschließlich Quellcode in den neuen LXC; GitHub-Anmeldedaten und Git-Metadaten werden nicht mitgegeben. Ein so übertragener Quellcodeordner ist kein Git-Checkout. Für spätere Updates einen neuen Stand in den bestehenden LXC übertragen oder dort selbst einen Git-Checkout außerhalb von `/opt/familien-organisierer` anlegen und `scripts/install-lxc.sh` ausführen. Den Host-Ersteller dafür nicht erneut aufrufen: Er erstellt einen neuen Container.

Die Installer-Tests verwenden einen isolierten Dateibaum und nachgebildete Paket-, Konto- und systemd-Befehle. SHA-256-Prüfung, Kopiervorgänge und SQLite-Sicherung/Wiederherstellung werden tatsächlich ausgeführt. Eine echte Proxmox-/LXC-Abnahme steht aus.

Technische Referenzen: [Offizielle Node.js-Downloads](https://nodejs.org/en/download), [Node.js-Release-Verifikation](https://github.com/nodejs/node#verifying-binaries), [systemd-LXC-Erkennung](https://github.com/systemd/systemd/blob/main/man/systemd-detect-virt.xml).

## Alternativ Docker

`Dockerfile` und `compose.yaml` sind beigelegt. In einer vorhandenen Docker-Umgebung `docker compose up -d --build` verwenden. Das Volume `family-data` enthält die persistenten Daten. Die Docker-Konfiguration wurde hier nicht ausgeführt; für den direkten LXC-Betrieb wird sie nicht gebraucht.
