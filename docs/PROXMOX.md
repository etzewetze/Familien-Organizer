# Automatische Container-Erstellung auf Proxmox

`scripts/create-proxmox-lxc.sh` läuft **auf dem Proxmox-Host als root**. Es erstellt einen neuen LXC und ruft darin `scripts/install-lxc.sh` auf. Unterstützt werden Proxmox VE >=8 auf x86_64. Ein echter Proxmox-Test steht noch aus; automatisierte Tests bilden die Proxmox-Befehle kontrolliert nach.

## Download und Start

In der Weboberfläche den Host auswählen und dessen Shell öffnen. Für einen GitHub-Account mit Google-Anmeldung gibt es zwei Wege ohne GitHub-Passworteingabe.

### Browser-Bestätigung ohne Passwort oder manuell erstellten Token

Die aktuelle GitHub CLI aus der offiziellen Paketquelle installieren; der vollständige Installationsblock steht am Anfang der [README](../README.md#neuen-proxmox-lxc-automatisch-anlegen). Es ist keine zusätzliche Paketquelle von Proxmox nötig; hinzu kommt die offizielle GitHub-CLI-Paketquelle. Die GitHub-CLI-Maintainer empfehlen ihre aktuellen Pakete, weil bestimmte ältere Distributionsversionen veraltete APIs verwenden.

Anschließend als root auf dem Host:

```bash
gh auth login --hostname github.com --git-protocol https --web
```

Die Shell zeigt einen Einmalcode und eine Adresse an. Auf dem eigenen PC oder Handy [github.com/login/device](https://github.com/login/device) öffnen, dort mit Google bei **etzewetze** anmelden, den Code eingeben und die GitHub CLI freigeben. Nicht das Google-Passwort in der Proxmox-Shell eingeben. Falls gefragt, die Git-Authentifizierung mit **Ja** bestätigen. Ein Browser muss auf dem Host nicht installiert sein.

Nach erfolgreicher Anmeldung:

```bash
gh auth setup-git --hostname github.com && gh repo clone etzewetze/Familien-Organizer /root/Familien-Organizer && bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh
```

Die CLI richtet eine Anmeldung auf dem Host ein und speichert sie für spätere Downloads; es ist keine anonyme Freigabe des Repositorys. Die GitHub-Verbindung von ChatGPT überträgt keine Anmeldung auf deinen Proxmox. Abmeldung bei Bedarf mit `gh auth logout --hostname github.com`; für spätere private Git-Downloads ist dann eine neue Anmeldung nötig. Der Familien-Organizer läuft ohne diese GitHub-Anmeldung weiter.

### ZIP ohne GitHub-Anmeldung auf dem Host

1. Auf dem PC mit deinem Google-Login [das Repository](https://github.com/etzewetze/Familien-Organizer) öffnen und **Code → Download ZIP** wählen.
2. `Familien-Organizer-main.zip` auf den **Proxmox-Host** nach `/root` kopieren, z.B. über die eigene Dateiablage oder `scp`. Hierzu gelten deine vorhandenen Proxmox-Zugriffsrechte, keine GitHub-Zugangsdaten.
3. In der Host-Shell als root ausführen:

```bash
(
  set -e
  apt-get update
  apt-get install -y unzip
  test ! -e /root/Familien-Organizer-main
  unzip /root/Familien-Organizer-main.zip -d /root
  bash /root/Familien-Organizer-main/scripts/create-proxmox-lxc.sh
)
```

Ein vorhandener Ordner wird dabei nicht überschrieben; in diesem Fall einen anderen leeren Zielordner zum Entpacken wählen. Das Skript läuft aus dem vollständigen ZIP ohne `git`, GitHub CLI, Token oder GitHub-Anmeldung auf dem Host. Nach dem Entpacken können auch `--dry-run` und die unten beschriebenen Optionen verwendet werden.

Für ein privates Repository ist ein vollständig anonymer Direktdownload von GitHub nicht möglich. Der ZIP-Weg nutzt deine Anmeldung nur im Browser. Es wird keine öffentliche Raw-URL versprochen und die Repository-Sichtbarkeit nicht verändert.

### Vorhandene Anmeldung und Updates

Mit einem bereits eingerichteten SSH-Schlüssel oder Git-Lesetoken funktioniert der bisherige `git clone`-Weg weiterhin. Ein Token wird bei HTTPS in der Git-Abfrage verwendet, nicht das GitHub- oder Google-Passwort; Zugangsdaten nicht in Clone-URLs einbauen.

Ein vorhandener Projektordner wird durch `git clone` bzw. `gh repo clone` nicht überschrieben. Bei einem bestehenden Checkout darin `git pull --ff-only` ausführen und den Skriptaufruf separat starten. Der Container-Ersteller ist nur für **neue** Container; für Updates der installierten Anwendung [LXC.md](LXC.md) beachten.

Offizielle Referenzen: [GitHub CLI installieren](https://github.com/cli/cli/blob/trunk/docs/install_linux.md), [Browser-Anmeldung](https://cli.github.com/manual/gh_auth_login), [Git-Zugriff einrichten](https://cli.github.com/manual/gh_auth_setup-git), [Repository klonen](https://cli.github.com/manual/gh_repo_clone), [Google-Anmeldung bei GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github).

## Werte und Auswahl

| Parameter | Standard |
|---|---|
| `--vmid` | Nächste freie ID im gesamten Proxmox-Cluster |
| `--hostname` | `familien-organizer` |
| `--cores` | 1, Minimum 1 |
| `--memory` | 1024 MiB, Minimum 1024 |
| `--swap` | 512 MiB, 0 möglich |
| `--disk` | 8 GiB, Minimum 8 |
| `--rootfs-storage` | `local-lvm`, wenn vorhanden; sonst ein eindeutiger aktiver `rootdir`-Speicher |
| `--template-storage` | `local`, wenn vorhanden; sonst ein eindeutiger aktiver `vztmpl`-Speicher |
| `--bridge` | `vmbr0`, wenn vorhanden; sonst eine eindeutige Linux-Bridge |
| `--ip4` | `dhcp` |
| `--gateway` | Bei statischer IPv4 erforderlich |
| `--vlan` | Optionales VLAN von 1 bis 4094 |
| `--debian` | 12 für Proxmox 8; 13 für Proxmox >=9 |
| `--source` | Vollständiges Projekt neben dem aufgerufenen Skript |
| `--dry-run` | Ziel und Werte prüfen; kein Download und keine Erstellung |

Sind mehrere Speicher/Bridges vorhanden und keiner der Standardnamen passt, verlangt das Skript eine ausdrückliche Auswahl. Für die Systemdisk muss mindestens der gewählte Plattenplatz im Speicher verfügbar sein. Das sind Startwerte für einen kleinen Haushalt; für viele Fotos, Sicherungen und wachsende Kalender entsprechend mehr Speicher und gegebenenfalls RAM einplanen.

Vorprüfung:

```bash
bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh --dry-run
```

Eigene Konfiguration:

```bash
bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh --vmid 120 --rootfs-storage local-lvm --template-storage local --bridge vmbr0 --cores 2 --memory 2048 --disk 16
```

Statische IP als Beispiel – vor dem Aufruf durch eine freie Adresse, Netzpräfix und Gateway im eigenen Netz ersetzen:

```bash
bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh --ip4 192.168.178.60/24 --gateway 192.168.178.1
```

DHCP benötigt einen DHCP-Server auf der gewählten Bridge. Für später eine DHCP-Reservierung oder feste Adresse verwenden. Bei VLANs muss die Bridge passend eingerichtet sein. Der Installer verändert die Host-Netzwerkkonfiguration nicht.

## Ablauf und Betrieb

1. Host, Ressourcen, aktive Speicher, freie Cluster-ID und vorhandene Bridge prüfen.
2. Offiziellen Proxmox-Template-Katalog aktualisieren und das aktuelle passende Debian-Standard-Template herunterladen bzw. das vorhandene verwenden.
3. Einen unprivilegierten Container mit den gewählten Werten erstellen und starten.
4. Auf systemd und DNS im Container warten.
5. Quellcode ohne `.git`, echte `.env`, Daten oder Sicherungen übertragen. Die Übertragung wird anhand von SHA-256 geprüft.
6. Im LXC Debian-Pakete, die eigene Node.js-24-Laufzeit und den systemd-Dienst installieren und dessen HTTP-Antwort prüfen.
7. Container-Autostart aktivieren und die Adresse anzeigen.

Im Browser `http://CONTAINER-IP:8080` öffnen und Familie samt Passwort einrichten. Die Erstkonfiguration zunächst im eigenen Netz durchführen. Google-/Immich-Verbindungen anschließend nach [INTEGRATIONS.md](INTEGRATIONS.md) einrichten.

Die Konsole der Proxmox-Weboberfläche nutzt den Modus `shell`; alternativ auf dem Host `pct enter CONTAINER-ID`. Es wird kein gemeinsames oder fest eingebautes Root-Passwort vergeben und keine SSH-Zugangsinformation des Hosts übertragen. Für eine direkte SSH-Anmeldung in den LXC eigene Zugangsdaten separat einrichten.

`firewall=1` ist an der Netzwerkschnittstelle gesetzt. Falls die Proxmox-Firewall für diesen Container mit einer blockierenden Regel aktiv ist, den Zugriff auf TCP 8080 aus dem eigenen Netz erlauben. Der Installer ändert keine Firewall-Regeln auf dem Host.

## Fehler und Updates

Bestehende IDs werden abgewiesen. Eine bereits laufende VM oder ein Container wird weder übernommen noch gelöscht. Falls der neue Container bei Netzwerk, Übertragung oder Installation scheitert, bleibt er zur Diagnose erhalten; der Autostart wird erst nach erfolgreicher Installation aktiviert. Die Ausgabe nennt die ID und `pct enter` für die Prüfung. Lokale temporäre Quellcodekopien werden nach dem Aufruf entfernt.

Daten, Fotos, Schlüssel und Sicherungen liegen im LXC bzw. im eigenen eingebundenen Speicher. Sie werden nicht in GitHub hochgeladen. Im LXC bleiben `/root/familien-organisierer-src` und die installierte Anwendung unter `/opt/familien-organisierer` erhalten. Der übertragene Quellcodeordner enthält kein `.git`; der ursprüngliche Git-Checkout ist auf dem Host.

Für Updates einen neuen vollständigen Stand in **denselben LXC** übertragen und dessen `scripts/install-lxc.sh` erneut ausführen; Details und Wiederherstellung in [LXC.md](LXC.md). Ein erneuter Aufruf von `create-proxmox-lxc.sh` erstellt einen weiteren Container.

Ein Container-Template für die Download-Funktion wäre ein komplettes Linux-Dateisystem als z.B. `.tar.zst`. Dieses Projekt bietet die automatische Erstellung aus dem offiziellen Debian-Template samt anschließender Installation. Es veröffentlicht kein vorinstalliertes Root-Dateisystem.

Primärquellen für die verwendeten Proxmox-Schnittstellen: [pct-Dokumentation](https://pve.proxmox.com/pve-docs/pct.1.html), [offizielle pct-Referenz im Quellcode](https://github.com/proxmox/pve-docs/blob/master/generated/pct.1-synopsis.adoc), [pvesm-Speicherstatus](https://github.com/proxmox/pve-docs/blob/master/generated/pvesm.1-synopsis.adoc), [Container- und Template-Anleitung](https://github.com/proxmox/pve-docs/blob/master/pct.adoc).
