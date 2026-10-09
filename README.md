# Familien Organisierer

Eine eigenständige, deutschsprachige Familienzentrale zum Selbsthosten. Funktional an den beschriebenen Familienkalender angelehnt; eigener Quellcode, eigenes Design und keine Abhängigkeit von Dæly. Keine übernommenen Markenassets oder proprietären Programmteile.

**Version 0.6.0 ergänzt Wetter mit 14-Tage-Vorhersage, einen Geräte-Ruhemodus und Bild-/Emoji-Symbole für Termine und Aufgaben.** Nach Updates werden alle Geräte abgemeldet; nach dem Anmelden erscheint die Änderungsübersicht. Die Familienzentrale ist für einen privaten Haushalt gedacht. Familiengeräte verwenden dasselbe Familienpasswort; manuelle Punkte und Software-Updates benötigen zusätzlich das Elternpasswort. Eine native App und Stundenpläne folgen später.

**Bereits laufender Container ab 0.3.0?** **Einstellungen → Update** verwenden. Beim ersten Wechsel auf 0.6.0 danach den Browser neu laden, mit dem Familienpasswort anmelden und die Änderungsübersicht lesen. Bei einem älteren Stand einmal den [vollständigen Update-Befehl](docs/LXC.md#update-des-öffentlichen-projekts-vom-proxmox-host) ausführen, um den Updatedienst einzurichten. Den Container-Ersteller nur für neue LXC verwenden. Bedienung: [PLANER.md](docs/PLANER.md).

## Neuen Proxmox-LXC automatisch anlegen

In Proxmox den **Host → Shell** öffnen und als root ausführen. Das Repository ist **öffentlich**; der Download benötigt keine GitHub-Anmeldung, kein Passwort und keinen Token:

```bash
git clone https://github.com/etzewetze/Familien-Organizer.git /root/Familien-Organizer && bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh
```

Falls `git` fehlt, zuerst `apt-get update && apt-get install -y git ca-certificates` ausführen. Bei einem bereits vorhandenen Checkout darin `git pull --ff-only` verwenden. Der Container-Ersteller erstellt neue Container. **Nach einer fehlgeschlagenen Installation im vorhandenen LXC fortsetzen:** siehe [DNS-Prüfung und Wiederaufnahme](docs/PROXMOX.md#dns-fehler-und-fortsetzung-im-vorhandenen-container).

<details>
<summary>Browser-Anmeldung mit Google, falls das Repository später wieder privat ist</summary>

Für ein privates Repository funktioniert die Installation auch mit einem GitHub-Account, der über **Google** registriert wurde: kein GitHub-Passwort und kein manuell erstellter Token nötig; einmal bestätigst du den Zugriff im Browser.

Als root zuerst die aktuelle GitHub CLI aus ihrer offiziellen Paketquelle installieren:

```bash
(
  set -e
  apt-get update
  apt-get install -y ca-certificates curl git
  install -d -m 0755 /etc/apt/keyrings
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg
  chmod 0644 /etc/apt/keyrings/githubcli-archive-keyring.gpg
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main\n' "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/github-cli.list
  apt-get update
  apt-get install -y gh
)
```

Dann die Browser-Anmeldung starten:

```bash
gh auth login --hostname github.com --git-protocol https --web
```

Die Shell zeigt einen Einmalcode und eine Adresse an. Auf deinem PC oder Handy [github.com/login/device](https://github.com/login/device) öffnen, mit Google bei **etzewetze** anmelden, den angezeigten Code eingeben und die GitHub CLI freigeben. Ein Browser auf Proxmox ist nicht nötig. Falls die Shell nach der Git-Authentifizierung fragt, **Ja** wählen. Sobald die Anmeldung erfolgreich ist:

```bash
gh auth setup-git --hostname github.com && gh repo clone etzewetze/Familien-Organizer /root/Familien-Organizer && bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh
```

Die CLI speichert die erteilte Anmeldung auf dem Host für spätere Downloads. Die Verbindung von ChatGPT zu GitHub ersetzt diese Freigabe nicht. **Ohne jede GitHub-Anmeldung auf Proxmox:** im bereits angemeldeten Browser **Code → Download ZIP**, das ZIP auf den Host kopieren, entpacken und daraus das Container-Skript starten. Die genauen Befehle stehen in [docs/PROXMOX.md](docs/PROXMOX.md#zip-ohne-github-anmeldung-auf-dem-host). Das Container-Skript selbst benötigt keine GitHub-Zugangsdaten.

</details>

Das Skript wählt eine freie Container-ID, prüft vorhandene Speicher und Bridge, lädt ein offizielles Debian-Template, erstellt einen unprivilegierten LXC und installiert die Anwendung. Die abschließend angezeigte Adresse `http://CONTAINER-IP:8080` öffnen und Familie/Passwort einrichten. Die Proxmox-Konsole ist direkt als Shell nutzbar; es gibt kein fest eingebautes Root-Passwort.

| Einstellung | Mindest-Startwert / Standard |
|---|---|
| CPU | 1 Kern |
| RAM | 1024 MiB |
| Swap | 512 MiB |
| Systemdisk | 8 GiB; zusätzliche Kapazität für Fotos und Sicherungen |
| Betriebssystem | Debian 12 auf Proxmox 8; Debian 13 auf Proxmox >=9 |
| Netzwerk | `vmbr0`, IPv4 per DHCP; bei abweichender Einrichtung konfigurierbar |
| Betrieb | Unprivilegierter LXC, systemd, bei Debian 13 `nesting=1`, Autostart nach erfolgreicher Installation |

Andere Speicher, Bridge, VM-ID oder mehr Ressourcen:

```bash
bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh --vmid 120 --rootfs-storage local-lvm --template-storage local --bridge vmbr0 --cores 2 --memory 2048 --disk 16
```

Vorher nur prüfen: `bash /root/Familien-Organizer/scripts/create-proxmox-lxc.sh --dry-run`. Eine vorhandene ID wird abgewiesen. Jeder normale Aufruf erstellt einen **neuen** Container; Updates sind in der LXC-Anleitung beschrieben.

Bei Bedarf `--nameserver IP_DEINES_DNS_SERVERS` ergänzen. Ohne diese Option übernimmt Proxmox die DNS-Einstellung des Hosts; der Resolver muss auch aus dem LXC erreichbar sein. Vor Paketdownloads prüft der Installer die Namensauflösung für Debian und Node.js. Fehlgeschlagene Paketlisten-Abrufe werden als Fehler behandelt; ein vorhandener Container wird erhalten.

Bei Debian 13 setzt der Ersteller Nesting für die systemd-Basisdienste. Für einen schon erstellten Container mit fehlgeschlagenen Basis-Mounts oder D-Bus steht die [Reparatur im vorhandenen LXC](docs/PROXMOX.md#debian-13-systemd-mount--oder-d-bus-fehler) in der Host-Anleitung.

Proxmox-Aufrufe erhalten die System-Standardrechte über `umask 022`. Bei D-Bus-Fehlern mit `Permission denied` nach einer Installation mit dem ursprünglichen Skript siehe die [gezielte Prüfung von `/etc`](docs/PROXMOX.md#d-bus-permission-denied-nach-ursprünglicher-erstellung).

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

| Bereich | Stand in 0.6 |
|---|---|
| Kalender | 24-Stunden-Raster mit wählbarer Verdichtung leerer Stunden und Tage; ausgeschriebene Tage und vollständige Daten; Termine nach Dauer, Überlappungen nebeneinander; Personenwahl mit Farbverlauf bei Mehrfachauswahl, Assistent für neue Termine und gemeinsames Bearbeitungsformular; optionale Bild-/Emoji-Symbole; Standard- und eigene Farben für Alle; ganztägig, Zeitspanne oder feste Startzeit mit 15-Minuten-Ausblendung |
| Geburtstage | Eigener Reiter; Name, Tag und Monat; optional Geburtsjahr und Person; jährliche Anzeige im Kalender als 🎂 Name mit optionalem Alter; Ersatzdatum für den 29. Februar wählbar |
| Google Kalender | Mehrere Konten über OAuth; Kalenderauswahl und Personenzuordnung; importieren und Änderungen zurückschreiben; Wiederholungsversuche bei Verbindungsfehlern |
| Aufgaben und Routinen | Allgemein und Bereiche für alle Personen; gemeinsamer Personenfilter im Header mit Punkten unter dem Namen; Drag-and-drop auf Spalten und Headerprofile, Touch-Griff und Zuordnungsdialog; optionales Aufgabenbild und Emoji-Auswahl; einmalig, täglich, werktags oder wöchentlich |
| Punkte und Belohnungen | Eigener Belohnungsreiter; Einlösen und Historie; manuelle Punkte mit Begründung und Elternpasswort; einmalige Gutschrift pro Erledigung |
| Essen und Rezepte | Umschaltbare waagerechte/senkrechte Woche; Frühstück, Mittag und Abendbrot für jeden Tag; Rezepte per Drag-and-drop oder Bildkarten auswählen; Vorschaubilder aus Upload oder Import; Portionen, Zutaten, Zubereitung und Rezeptlink-Import |
| Einkauf | Zutaten skalieren und zusammenführen; erneut übernehmen ohne Verdopplung; manuelle Ergänzungen und Abhaken |
| Listen und Notizen | Eigene Checklisten, Kategorien, Mengen und angeheftete Notizen |
| Fotos | Nur auf dem Gerät gespeicherte Bilder; Container-Ordner und Upload; Netzwerk-Bilderliste; Immich-Alben; Diashow mit Uhr |
| Profile und Darstellung | Mittige Profile mit Initialen oder eigenen Bildern; größere Uhr; Hintergrundbild, sieben anpassbare Farben und Kalenderdichte; gemeinsame Einstellungen und gesicherte Bilder |
| Wetter | Anzeige neben der Uhr; verborgene Wetteransicht mit aktueller Lage, nächsten Stunden und 14 Tagen; bis zu acht gespeicherte Orte und auswählbarer Headerort |
| Geräte | Responsive Weboberfläche; manueller Vollbildmodus; pro Browser einstellbarer Inaktivitätswechsel zum dunklen Ruhebildschirm oder Bilderrahmen, Berührung zum Zurückkehren; Wake Lock auf unterstützten HTTPS-Geräten |
| Betrieb | SQLite, systemd für LXC, optional Docker; Update-Knopf im LXC mit vorheriger Sicherung, Rücksetzen und Ergebnisanzeige; automatische Abmeldung und Änderungsübersicht nach Updates; Sicherungsskript und Datenexport |

Unter **Essen & Rezepte → Rezeptlink importieren** einen direkten Rezeptlink einfügen, die Vorschau prüfen und speichern. Der Import liest öffentlich angebotene Rezeptdaten, etwa von Seiten wie Chefkoch, sofern die betreffende Seite diese Daten ausliefert und den Serverabruf zulässt. Quellenlink, Zutaten, Zubereitung und ein verfügbares Rezeptbild werden lokal gespeichert. Eigene Rezeptbilder lassen sich beim Anlegen oder Bearbeiten hochladen. Bei **Auswählen** und **Ändern** erscheinen Rezepte als Bildkarten. Nicht jede Webseite lässt sich automatisch auslesen; eine manuelle Eingabe bleibt möglich. Details in [INTEGRATIONS.md](docs/INTEGRATIONS.md#rezepte-aus-dem-internet).

**Wichtig zum Entwicklungsstand:** Google- und Immich-Anbindungen sind implementiert, aber noch nicht gegen deine Konten bzw. deine Instanz getestet. Google wird alle fünf Minuten abgeglichen; neue Änderungen werden zusätzlich sofort zum Versand angestoßen. Dies ist kein Echtzeit-Push. Der Google-Abruf umfasst 90 Tage Vergangenheit und 366 Tage Zukunft. Wiederkehrende Google-Termine werden in diesem Zeitraum als einzelne Vorkommen angezeigt und einzeln bearbeitet. Geburtstage wiederholen sich lokal jedes Jahr; allgemeine lokale Terminserien sind noch nicht enthalten. Wiederkehrende Aufgaben sind enthalten.

**Wetter einrichten:** Neben der Uhr auf „Wetter“ tippen, Ort suchen und hinzufügen. Weitere Orte lassen sich dort auswählen und für die Kopfzeile festlegen. Der optionale Abruf verwendet Open-Meteo und benötigt Internet; der übrige Organizer bleibt ohne Wetterdienst nutzbar.

**Tabletmodus:** Unter **Einstellungen → Dieses Gerät · Tabletmodus** Wartezeit, Ruhebildschirm oder Bilderrahmen und Fotoquelle einstellen. Ein Browser kann das Display nicht selbst ausschalten oder Hardware-Aufwecken erzwingen; im Ruhemodus wird die Displaysperre freigegeben. Das Wachhalten benötigt HTTPS und Browserunterstützung. Details: [Bedienung](docs/PLANER.md#wetter-und-weitere-orte), [Integrationen](docs/INTEGRATIONS.md#wetter).

## Installation auf Proxmox LXC

Die vollständige Anleitung steht in [docs/LXC.md](docs/LXC.md). Ein unprivilegierter Debian-LXC genügt; Docker im LXC ist nicht erforderlich. Empfohlener Anfang: 1–2 vCPU, 1 GB RAM, 8–16 GB Systemdisk, zusätzliche Kapazität für Fotos.

1. Projekt in den LXC kopieren und entpacken oder aus dem eigenen GitHub-Repository klonen.
2. Im Projektordner als root `bash scripts/install-lxc.sh --check` ausführen.
3. `bash scripts/install-lxc.sh` ausführen; Debian-Pakete, Node.js 24 und der systemd-Dienst werden automatisch eingerichtet.
4. `http://CONTAINER-IP:8080` öffnen und Familie einrichten.

Der Installer unterstützt Debian 12/13 auf x86_64 und ARM64. Node.js kommt mit SHA-256-Prüfung vom offiziellen Downloadserver und erhält einen eigenen Laufzeitordner. Anwendung und Update-Dienst starten nach einem Container-Neustart automatisch. Für ein Update im neuen Projektstand dasselbe Skript erneut ausführen: `.env`, Daten und Fotos werden erhalten; vor dem Wechsel entsteht eine vollständige Updatesicherung. Bei einem fehlgeschlagenen Start stellt das Skript vorherigen Code, Laufzeit und Datenbank wieder her. Der Nutzer hat die erfolgreiche Erstinstallation von 0.1.2 auf Proxmox gemeldet; 0.6.0 ist auf dem Zielsystem noch zu prüfen. Der [Update-Befehl vom Proxmox-Host](docs/LXC.md#update-des-öffentlichen-projekts-vom-proxmox-host) lädt den vollständigen neuen Stand in denselben Container.

Anschließend unter **Einstellungen → Elternpasswort** ein eigenes Passwort anlegen. **Update** startet Sicherung, Download und Installation im Hintergrund; bei Erfolg oder Fehler erscheint der Status dort. Der separate lokale Dienst arbeitet während des Anwendungsneustarts weiter. Details und Diagnose: [Updates über die Oberfläche](docs/LXC.md#updates-über-die-oberfläche).

## Google und Fotos einrichten

- Google: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md). Du brauchst dein eigenes Google-Cloud-Projekt, OAuth-Zugangsdaten und für dauerhaften Betrieb eine HTTPS-Adresse mit eigener Domain. Das Kernsystem funktioniert auch ohne Google.
- Immich und Netzwerkbilder: dieselbe Anleitung. Der Immich-Schlüssel bleibt verschlüsselt auf deinem Server. Netzwerkbilder nutzen ein einfaches JSON-Manifest, keine herstellerspezifische Cloud.
- Gerätefotos bleiben in IndexedDB dieses Browsers. Sie werden nicht automatisch auf andere Geräte übertragen und gehen beim Löschen der Browserdaten verloren.

## Sicherung und Weiterentwicklung

```bash
npm test
node scripts/backup.mjs /pfad/zu/sicherungen
```

Das Sicherungsskript erzeugt einen konsistenten SQLite-Schnappschuss und kopiert Schlüssel, Fotos, Aufgaben-, Profil- und Hintergrundbilder und gegebenenfalls `.env`. Es ist keine Verschlüsselung des gesamten Backups: Sicherungsordner privat aufbewahren. Wiederherstellung steht in der LXC-Anleitung. Der JSON-Export in der Oberfläche ist ein lesbarer Datenexport; er ersetzt die vollständige Sicherung und deren Wiederherstellung nicht.

[PROJECT_STATE.md](PROJECT_STATE.md) hält Umfang, Prüfungen, Grenzen und nächste Schritte fest. Für die Fortsetzung genügt das Projektpaket zusammen mit dieser Datei. Der Quellcode liegt im öffentlichen Repository [etzewetze/Familien-Organizer](https://github.com/etzewetze/Familien-Organizer). Zugangsdaten, Familiendaten, Fotos und Sicherungen bleiben auf dem eigenen Server.

## Technik

Node.js mit eingebautem HTTP-Server und `node:sqlite`; SQLite im WAL-Modus; ES-Module, HTML und CSS ohne fremde Laufzeitpakete. Keine CDNs, Analysedienste, externen Fonts oder kostenpflichtigen Cloud-Datenbanken. Ausgehende Zugriffe finden bei aktivierten Google-/Bilder-Anbindungen, Rezeptimporten und angeforderten Updates statt. Sitzungen nutzen HttpOnly-Cookies; Schreibzugriffe prüfen Anfragequelle und Header. Die Oberfläche maskiert gespeicherte Texte; Punktebuchungen laufen in Datenbanktransaktionen.

Die Datenbank hat eine Schema-Version als Grundlage für spätere Migrationen. Die HTTP-API kann später von einer App genutzt werden; eine App ist in dieser Version nicht vorgezogen worden.

Lizenz: MIT. Siehe [LICENSE](LICENSE).
