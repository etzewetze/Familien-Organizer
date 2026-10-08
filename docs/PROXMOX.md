# Automatische Container-Erstellung auf Proxmox

`scripts/create-proxmox-lxc.sh` läuft **auf dem Proxmox-Host als root**. Es erstellt einen neuen LXC und ruft darin `scripts/install-lxc.sh` auf. Unterstützt werden Proxmox VE >=8 auf x86_64. Der Nutzer hat die erfolgreiche Erstinstallation von 0.1.2 gemeldet; eine vollständige Prüfung auf dem Zielsystem und das Update auf 0.3.0 stehen noch aus. Automatisierte Tests bilden die Proxmox-Befehle kontrolliert nach.

## Download und Start

In der Weboberfläche den Host auswählen und dessen Shell öffnen. Das Repository ist öffentlich; auf dem Host als root ohne GitHub-Anmeldung herunterladen und starten:

```bash
git clone https://github.com/etzewetze/Familien-Organizer.git /root/Familien-Organizer && bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh
```

Falls `git` fehlt, zuerst `apt-get update && apt-get install -y git ca-certificates` ausführen. Ein vorhandener Checkout wird mit `git pull --ff-only` aktualisiert. Die Browser-Anmeldung im nächsten Abschnitt ist eine Alternative, falls das Repository später privat betrieben wird.

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

1. Auf dem PC [das Repository](https://github.com/etzewetze/Familien-Organizer) öffnen und **Code → Download ZIP** wählen. Bei öffentlicher Sichtbarkeit geht dies ohne Anmeldung; bei privater Sichtbarkeit deinen Google-Login im Browser verwenden.
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
| `--nameserver` | Optionaler erreichbarer IPv4-DNS-Server; ohne Angabe übernimmt Proxmox die Host-Einstellung |
| `--vlan` | Optionales VLAN von 1 bis 4094 |
| `--debian` | 12 für Proxmox 8; 13 für Proxmox >=9 |
| Nesting | Für Debian 13 automatisch `nesting=1` für systemd; Debian-12-Erstellung bleibt unverändert |
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

Ein eigener Resolver kann für neue Container über `--nameserver IP_DEINES_DNS_SERVERS` gesetzt werden; den Platzhalter durch eine aus dem Container erreichbare IPv4-Adresse ersetzen. Ein nur auf dem Host laufender Loopback-Resolver, etwa `127.0.0.1`, ist keine geeignete Adresse für den neuen LXC. Öffentliche DNS-Server funktionieren nur, wenn dein Netz diese Verbindungen erlaubt.

## Ablauf und Betrieb

1. Host, Ressourcen, aktive Speicher, freie Cluster-ID und vorhandene Bridge prüfen.
2. Offiziellen Proxmox-Template-Katalog aktualisieren und das aktuelle passende Debian-Standard-Template herunterladen bzw. das vorhandene verwenden.
3. Einen unprivilegierten Container mit den gewählten Werten erstellen und starten. Bei Debian 13 `nesting=1` für die systemd-Basisdienste setzen.
4. Auf systemd und DNS im Container warten.
5. Quellcode ohne `.git`, echte `.env`, Daten oder Sicherungen übertragen. Die Übertragung wird anhand von SHA-256 geprüft.
6. Im LXC Debian-Pakete, die eigene Node.js-24-Laufzeit und den systemd-Dienst installieren und dessen HTTP-Antwort prüfen.
7. Container-Autostart aktivieren und die Adresse anzeigen.

Im Browser `http://CONTAINER-IP:8080` öffnen und Familie samt Passwort einrichten. Die Erstkonfiguration zunächst im eigenen Netz durchführen. Google-/Immich-Verbindungen anschließend nach [INTEGRATIONS.md](INTEGRATIONS.md) einrichten.

Die Konsole der Proxmox-Weboberfläche nutzt den Modus `shell`; alternativ auf dem Host `pct enter CONTAINER-ID`. Es wird kein gemeinsames oder fest eingebautes Root-Passwort vergeben und keine SSH-Zugangsinformation des Hosts übertragen. Für eine direkte SSH-Anmeldung in den LXC eigene Zugangsdaten separat einrichten.

### Root-Zugang zum Container

Auf dem **Proxmox-Host als root** öffnet dieser Befehl direkt die Shell von Container 100, ohne Container-Passwort:

```bash
pct enter 100
```

Mit `exit` zurück zur Host-Shell wechseln. Möchtest du ein eigenes Root-Passwort setzen, stattdessen diesen Befehl **auf dem Proxmox-Host** verwenden:

```bash
pct exec 100 -- passwd root
```

Das gewünschte Passwort zweimal eingeben; die Zeichen werden dabei nicht angezeigt. Es ist vom Familienpasswort der Webanwendung getrennt. Ein gesetztes Passwort richtet für sich allein noch keinen SSH-Zugang ein.

`firewall=1` ist an der Netzwerkschnittstelle gesetzt. Falls die Proxmox-Firewall für diesen Container mit einer blockierenden Regel aktiv ist, den Zugriff auf TCP 8080 aus dem eigenen Netz erlauben. Der Installer ändert keine Firewall-Regeln auf dem Host.

## Fehler und Updates

Bestehende IDs werden abgewiesen. Eine bereits laufende VM oder ein Container wird weder übernommen noch gelöscht. Falls der neue Container bei Netzwerk, Übertragung oder Installation scheitert, bleibt er zur Diagnose erhalten; der Autostart wird erst nach erfolgreicher Installation aktiviert. Die Ausgabe nennt die ID und `pct enter` für die Prüfung. Lokale temporäre Quellcodekopien werden nach dem Aufruf entfernt.

### DNS-Fehler und Fortsetzung im vorhandenen Container

`Temporary failure resolving 'deb.debian.org'` oder `security.debian.org` bedeutet, dass die Namensauflösung im Container fehlgeschlagen ist. Es ist damit noch nicht bekannt, ob der Resolver, DHCP, Routing oder eine Firewall die Ursache ist. Ein erfolgreicher Download des GitHub-Repositorys auf dem Host prüft nicht die Verbindung des LXC.

Vor Paketdownloads prüft der Installer jetzt `deb.debian.org`, `security.debian.org` und `nodejs.org`. Der Paketlisten-Abruf nutzt `--error-on=any` und Wiederholungsversuche; auch vorübergehende Fehler stoppen den Ablauf vor der Paketinstallation. Damit wird nicht mit alten oder unvollständigen Paketlisten weitergearbeitet. Dies verbessert die Fehlerbehandlung, ersetzt aber keine funktionierende Netzkonfiguration.

Für den bereits erstellten Container **100** auf dem **Proxmox-Host** prüfen (bei anderer ID ersetzen):

```bash
pct exec 100 -- ip -4 address show dev eth0
pct exec 100 -- ip -4 route
pct exec 100 -- cat /etc/resolv.conf
pct exec 100 -- getent ahostsv4 deb.debian.org
pct exec 100 -- getent ahostsv4 security.debian.org
pct exec 100 -- systemctl --failed --no-pager
```

Fehlt eine IPv4-Adresse oder Standardroute, zuerst DHCP/Bridge/Gateway prüfen. Ist ein DNS-Server eingetragen, muss er vom Container erreichbar sein. Einen bekannten, funktionierenden DNS-Server im eigenen Netz unter **Container → DNS** auswählen; anschließend den Container neu starten. Die Meldung `Systemd 257 detected. You may need to enable nesting.` allein beweist keine DNS-Ursache. Fehlgeschlagene systemd-Dienste mit der letzten Diagnosezeile prüfen; Nesting nicht allein wegen des DNS-Textes ändern.

Wenn der Quellcode wie bei der gemeldeten Installation schon übertragen wurde, nach Behebung im **selben** Container fortsetzen:

```bash
pct exec 100 -- bash /root/familien-organisierer-src/scripts/install-lxc.sh && pct set 100 --onboot 1
```

Der Autostart wird nur bei erfolgreicher Installation aktiviert. Die Ausgabe nennt die Browser-Adresse. `create-proxmox-lxc.sh` dafür nicht erneut ausführen: Es würde einen weiteren Container anlegen.

Falls der Quellcode noch fehlt oder der aktuelle Stand übertragen werden soll, auf dem Host den vorhandenen Checkout aktualisieren und ein Paket nur aus Quellcode bilden. Die Befehle laufen in einer Subshell, die bei Fehlern stoppt:

```bash
(
  set -e
  cd /root/Familien-Organizer
  git pull --ff-only
  test ! -e /root/familien-organizer-resume.tar.gz
  tar -czf /root/familien-organizer-resume.tar.gz package.json server.mjs src public scripts deploy docs tests README.md PROJECT_STATE.md LICENSE .env.example .gitignore
  pct exec 100 -- test ! -e /root/familien-organisierer-resume-src
  pct push 100 /root/familien-organizer-resume.tar.gz /root/familien-organizer-resume.tar.gz --perms 0600
  pct exec 100 -- install -d -m 0700 /root/familien-organisierer-resume-src
  pct exec 100 -- tar -xzf /root/familien-organizer-resume.tar.gz -C /root/familien-organisierer-resume-src --no-same-owner
  pct exec 100 -- bash /root/familien-organisierer-resume-src/scripts/install-lxc.sh
  pct set 100 --onboot 1
)
```

Archive nach erfolgreicher Prüfung selbst entfernen bzw. für die nächste Übertragung einen neuen Namen wählen. Der neue Quellcodeordner darf ebenfalls noch nicht existieren; dadurch werden keine alten Quelldateien in einen neuen Stand gemischt. Keine `.git`, echte `.env`, Familiendaten oder Sicherungen übertragen. Bei einem laufenden Dienst vor dem Weiterarbeiten die normalen Update-/Sicherungshinweise in [LXC.md](LXC.md) beachten.

Referenzen: [Proxmox-DNS-Einstellung für LXC](https://github.com/proxmox/pve-docs/blob/master/generated/pct.1-synopsis.adoc), [Debian apt-get und --error-on=any](https://manpages.debian.org/bookworm/apt/apt-get.8.en.html).

### Debian 13: systemd-Mount- oder D-Bus-Fehler

Wenn DNS inzwischen funktioniert, aber `dev-mqueue.mount`, `run-lock.mount`, `tmp.mount` und D-Bus fehlgeschlagen sind, passt das zu bekannten Debian-13-/systemd-Problemen bei fehlender Nesting-Freigabe. Die Korrektur des Erstellers setzt `nesting=1` für neue Debian-13-Container. Für den bereits angelegten Container **100** ist ein vollständiges Stoppen und Starten nötig, um die Feature-Änderung zu übernehmen.

Auf dem Proxmox-Host als root:

```bash
pct stop 100 && pct set 100 --features nesting=1 && pct start 100
pct exec 100 -- systemctl is-system-running --wait
pct exec 100 -- systemctl --failed --no-pager
```

Diese Feature-Zeile gilt für den mit dem ursprünglichen Ersteller angelegten Container ohne andere ausdrücklich gesetzte Features. Sind im Container bereits weitere Features konfiguriert, unter **Container → Optionen → Features** nur Nesting einschalten und die anderen Einstellungen erhalten. Der Container bleibt unprivilegiert; der Proxmox-Host wird nicht neu gestartet.

Sobald `systemctl` den Status `running` und keine fehlgeschlagenen Dienste meldet, den Installer auf dem Host aktualisieren, die korrigierte Installer-Datei in den vorhandenen Quellcodeordner übertragen und dort fortsetzen:

```bash
(
  set -e
  cd /root/Familien-Organizer
  git pull --ff-only
  pct push 100 scripts/install-lxc.sh /root/familien-organisierer-src/scripts/install-lxc.sh --perms 0700
  pct exec 100 -- bash /root/familien-organisierer-src/scripts/install-lxc.sh
  pct set 100 --onboot 1
)
```

Dieser historische Reparaturblock überträgt nur die Installer-Korrektur für 0.1.2 und Schema 1. Für neue Funktionen den [vollständigen neuen Stand in denselben Container laden](LXC.md#update-des-öffentlichen-projekts-vom-proxmox-host). Nach erfolgreichem Start die angezeigte Browser-Adresse öffnen. Den Container-Ersteller nicht erneut ausführen.

Wenn trotz Nesting Basisdienste fehlschlagen, vor weiteren Änderungen deren Journal ansehen:

```bash
pct exec 100 -- journalctl -b -u tmp.mount -u run-lock.mount -u dev-mqueue.mount -u dbus.service -u dbus.socket --no-pager -n 80
```

Primärquellen: [gleiche Debian-13-Mount-Fehler mit erfolgreicher Nesting-Korrektur](https://forum.proxmox.com/threads/lxc-unprivileged-container-journal-and-other-services-failed-to-start.178714/), [Proxmox-Mitarbeiter zur Nesting-Freigabe in einem unprivilegierten Container](https://forum.proxmox.com/threads/pmg8to9-warnung-failed-to-resolve-hostname-upgrade-probleme.182214/), [pct-Feature-Referenz](https://github.com/proxmox/pve-docs/blob/master/generated/pct.1-synopsis.adoc).

### D-Bus: Permission denied nach ursprünglicher Erstellung

Nach aktiviertem Nesting können die Mounts wieder funktionieren, während D-Bus mit `Looking up user ID …: Permission denied`, `Unknown username "root"` und `Failed to open "/etc/dbus-1/system.conf": Permission denied` weiterhin scheitert. Das ursprüngliche Host-Skript hat seine private `umask 077` an `pct` vererbt. Proxmox entpackt Templates mit `tar --skip-old-files`; wenn ein Datei-Eintrag vor seinem Verzeichnis kommt, kann das Verzeichnis mit den vererbten Rechten angelegt werden. Ein nicht durchsuchbares `/etc` verhindert für Dienstbenutzer auch das Lesen von `/etc/passwd` und `/etc/resolv.conf`. Deshalb kann die Namensauflösung als root funktionieren, während Paketdownloads als `_apt` scheitern.

Der korrigierte Ersteller verwendet nur für den `pct`-Kindprozess `umask 022`; temporäre Quelldateien und Sperrdatei auf dem Host bleiben privat. Das repariert bestehende Container nicht rückwirkend. Im bereits angelegten **Container 100** zunächst die Rechte ausgeben und ausschließlich ein root gehörendes `/etc` mit Modus `700` auf `755` korrigieren. Ein bereits korrektes `755` bleibt erhalten; bei anderen Werten wird abgebrochen. Der folgende Block läuft **auf dem Proxmox-Host** und setzt voraus, dass Nesting bereits aktiviert ist:

```bash
pct exec 100 -- bash -c '
set -e
stat -c "%a %U:%G %n" / /etc /etc/passwd /etc/dbus-1
case "$(stat -c "%a:%u:%g" /etc)" in
  700:0:0) chmod 0755 /etc ;;
  755:0:0) ;;
  *) printf "%s\n" "Unerwartete /etc-Rechte oder Besitzer; bitte die Ausgabe prüfen lassen." >&2; exit 1 ;;
esac
runuser -u messagebus -- test -r /etc/passwd
config=/usr/share/dbus-1/system.conf
if [ -e /etc/dbus-1/system.conf ]; then config=/etc/dbus-1/system.conf; fi
stat -c "%a %U:%G %n" "$config"
runuser -u messagebus -- test -r "$config"
systemctl reset-failed dbus.service dbus.socket
systemctl start dbus.socket dbus.service
systemctl --failed --no-pager
systemctl is-system-running --wait
'
```

Wenn der Block fehlschlägt, keine weiteren Rechte ändern. Diagnose:

```bash
pct exec 100 -- namei -l /etc/passwd /usr/share/dbus-1/system.conf
pct exec 100 -- journalctl -b -u dbus.socket -u dbus.service --no-pager -n 40
```

Bei `running` ohne fehlgeschlagene Dienste mit dem oben gezeigten `git pull`, `pct push` und `install-lxc.sh` im bestehenden Container fortsetzen. Den Container-Ersteller nicht erneut ausführen. `chmod` ist hier bewusst auf das Verzeichnis `/etc` beschränkt; Dateien mit vertraulichem Inhalt behalten ihre bisherigen Rechte.

Die Nutzerprüfung hat `/etc` mit `700 root:root` bestätigt. Der ursprüngliche Prüfblock brach jedoch vor `chmod` ab, weil er `/etc/dbus-1/system.conf` als zwingend vorhandene Datei behandelte. Das war ein Fehler in der Anleitung: D-Bus liefert die Standardkonfiguration unter `/usr/share/dbus-1/system.conf`; die Datei unter `/etc` kann fehlen. Die korrigierte Prüfung verlangt die lokale Datei nicht mehr. Keine Ersatzdatei oder zusätzliche Dienstkonfiguration anlegen.

Primärquellen: [Proxmox-Mitarbeiter reproduziert geerbte umask und tar-Verzeichnisproblem](https://forum.proxmox.com/threads/creating-a-debian-or-ubuntu-lxc-with-the-pct-create-command-makes-etc-in-the-container-not-world-readable.161231/), [offizielle D-Bus-Konfigurationspfade](https://dbus.freedesktop.org/doc/dbus-daemon.1.html). Der Regressionstest entpackt ein echtes Testarchiv in dieser Reihenfolge: vor der Korrektur erhält `/etc` Modus `700`, danach `755`; private Host-Dateien bleiben `600` in einem Verzeichnis mit `700`. Der Nutzer hat inzwischen einen laufenden Container nach neuer Erstellung gemeldet. Für diesen gelten die normalen Updates ohne erneute Erstellung; die folgenden Löschschritte betreffen ausschließlich die damalige fehlgeschlagene Erstinstallation.

### Container 100 nach fehlgeschlagener Erstinstallation neu erstellen

Wenn die Erstinstallation noch nicht erfolgreich war und keine zu erhaltenden Daten im Container liegen, kann der unfertige Container durch einen neuen ersetzt werden. Zuerst den Git-Checkout auf dem Host aktualisieren; das aktuelle Skript enthält sowohl Nesting für Debian 13 als auch `umask 022` für Proxmox-Aufrufe. Eine reine Vorprüfung prüft den Host vor dem Löschen. Die dabei angezeigte freie ID ist nur ein Vorschlag; die anschließende echte Erstellung verwendet ausdrücklich wieder **100**.

**Dieser Block löscht Container 100 samt seinem Container-Speicher endgültig.** Er gilt für den unfertigen Familien-Organizer-LXC aus dieser Erstinstallation. Als root auf dem Proxmox-Host ausführen:

```bash
(
  set -e
  cd /root/Familien-Organizer
  git pull --ff-only
  bash scripts/create-proxmox-lxc.sh --dry-run
  pct stop 100
  pct destroy 100
  bash scripts/create-proxmox-lxc.sh --vmid 100
)
```

Wenn ein Schritt scheitert, endet der Block dort. Der Ersteller selbst löscht weiterhin keine Container und überschreibt keine belegte ID. Eine bereits vorhandene offizielle Template-Datei wird wiederverwendet; daraus entsteht ein neues Root-Dateisystem. Eine neue DHCP-Adresse ist möglich. Nach erfolgreicher Installation die vom Skript ausgegebene Browser-Adresse öffnen und die Familie einrichten. Falls die neue Installation scheitert, ihre Ausgabe prüfen; nicht wiederholt Container löschen.

Referenz: [offizielle pct-Referenz für stop, destroy und create](https://github.com/proxmox/pve-docs/blob/master/generated/pct.1-synopsis.adoc).

Daten, Fotos, Schlüssel und Sicherungen liegen im LXC bzw. im eigenen eingebundenen Speicher. Sie werden nicht in GitHub hochgeladen. Im LXC bleiben `/root/familien-organisierer-src` und die installierte Anwendung unter `/opt/familien-organisierer` erhalten. Der übertragene Quellcodeordner enthält kein `.git`; der ursprüngliche Git-Checkout ist auf dem Host.

Für Updates einen neuen vollständigen Stand in **denselben LXC** übertragen und dessen `scripts/install-lxc.sh` erneut ausführen; Details und Wiederherstellung in [LXC.md](LXC.md). Ein erneuter Aufruf von `create-proxmox-lxc.sh` erstellt einen weiteren Container.

Ein Container-Template für die Download-Funktion wäre ein komplettes Linux-Dateisystem als z.B. `.tar.zst`. Dieses Projekt bietet die automatische Erstellung aus dem offiziellen Debian-Template samt anschließender Installation. Es veröffentlicht kein vorinstalliertes Root-Dateisystem.

Primärquellen für die verwendeten Proxmox-Schnittstellen: [pct-Dokumentation](https://pve.proxmox.com/pve-docs/pct.1.html), [offizielle pct-Referenz im Quellcode](https://github.com/proxmox/pve-docs/blob/master/generated/pct.1-synopsis.adoc), [pvesm-Speicherstatus](https://github.com/proxmox/pve-docs/blob/master/generated/pvesm.1-synopsis.adoc), [Container- und Template-Anleitung](https://github.com/proxmox/pve-docs/blob/master/pct.adoc).
