# Kalender und Bilderquellen

## Google Kalender

Die Anwendung verwendet die offizielle Google Calendar API. Ohne diese Verbindung bleiben Kalender, Aufgaben, Fotos, Essen und Listen auf eurem eigenen Server nutzbar. Aktivierte Google-Kalender tauschen ihre Termine mit Google aus; die Google-Dienste bleiben dafür eine externe Abhängigkeit.

### Eigene Zugangsdaten

1. In der [Google Cloud Console](https://console.cloud.google.com/) ein eigenes Projekt erstellen.
2. Die Google Calendar API aktivieren.
3. Den OAuth-Zustimmungsbildschirm einrichten. Bei einer privaten Anwendung im Testmodus die E-Mail-Adressen der Familienmitglieder als Testnutzer eintragen.
4. OAuth-Client vom Typ **Webanwendung** erstellen.
5. Als autorisierte Weiterleitungsadresse exakt `https://familie.deine-domain.de/api/google/callback` eintragen.
6. Client-ID und Client-Secret in `/opt/familien-organisierer/.env` hinterlegen:

```dotenv
APP_URL=https://familie.deine-domain.de
COOKIE_SECURE=true
GOOGLE_CLIENT_ID=DEINE-CLIENT-ID
GOOGLE_CLIENT_SECRET=DEIN-CLIENT-SECRET
```

Danach Dienst neu starten und die Anwendung über genau diese HTTPS-Adresse öffnen. Unter Einstellungen „Google-Konto verbinden“ verwenden, das eigene Konto autorisieren und anschließend die gewünschten Kalender auswählen. Jedem Kalender kann eine Person oder „Alle“ zugeordnet werden. Mehrere Konten können nacheinander verbunden werden. Kalendereinträge aus einem nur lesbaren Kalender bleiben in der Anwendung schreibgeschützt.

### HTTPS im eigenen Netz

Google akzeptiert für Webanwendungen grundsätzlich HTTPS-Weiterleitungen und keine privaten IP-Adressen als Host. Ausnahme: lokale Entwicklung über `http://localhost:8080/api/google/callback`. Für einen dauerhaft selbst gehosteten LXC daher eine eigene Domain oder Subdomain mit gültigem HTTPS-Zertifikat verwenden. Sie kann im heimischen DNS ausschließlich auf die interne LXC-IP zeigen; die Anwendung muss für diesen browserbasierten OAuth-Ablauf nicht automatisch ins öffentliche Internet freigegeben werden. Der Browser der anmeldenden Person muss die konfigurierte Adresse erreichen können. Ein vorhandener Reverse Proxy kann HTTPS bereitstellen; bei nur intern erreichbaren Hosts wird das Zertifikat typischerweise per DNS-Validierung bezogen.

Google-OAuth im Status „Testing“ kann Refresh-Tokens nach sieben Tagen ablaufen lassen. Dann erneut verbinden oder den passenden Veröffentlichungsstatus des eigenen Google-Projekts wählen. Je nach Google-Konfiguration kann eine Verifikation nötig sein. Bei der Einrichtung Googles aktuelle Hinweise beachten.

### Verhalten in Version 0.1

- Automatischer Abgleich alle fünf Minuten, zusätzlich manuell unter Einstellungen.
- Änderungen aus der Anwendung werden sofort zur Übertragung angestoßen. Bei Fehlern bleiben sie in einer persistenten Warteschlange und werden später erneut versucht.
- Nachladen auf geöffneten Familiengeräten alle 15 Sekunden. Keine Push-Benachrichtigungen und kein Webhook-Echtzeitabgleich.
- Abruffenster: 90 Tage Vergangenheit bis 366 Tage Zukunft; wiederkehrende Google-Termine werden als einzelne Vorkommen geladen. Bearbeitung betrifft dieses Vorkommen, nicht die gesamte Serie.
- Änderungen mit offenem Versand werden beim Import nicht überschrieben. Nach erfolgreichem Versand ist beim nächsten Abgleich Google maßgeblich. Es gibt noch keine umfassende Konfliktoberfläche für gleichzeitig direkt in Google und lokal geänderte Termine.
- Kalender aus der Auswahl entfernen löscht deren importierte Anzeige in der Familienzentrale, nicht die Google-Termine. Ein Kalender mit ungesendeten Änderungen muss zuerst synchronisiert werden.
- Konto trennen behält angezeigte Termine als lokale Termine und verwirft offene Google-Schreibvorgänge für dieses Konto. Die Berechtigung in deinem Google-Konto wird dadurch nicht automatisch widerrufen; bei Bedarf dort entfernen.
- OAuth-Tokens liegen AES-GCM-verschlüsselt in SQLite; der Schlüssel liegt lokal als `master.key`. Client-Secret steht nur in der privaten `.env`. Beides wird nicht an die Oberfläche ausgegeben.

Noch ausstehend: Live-Abnahme mit euren Konten, großen wiederkehrenden Serien, Freigaberechten und gemeinsam direkt in Google bearbeiteten Terminen.

## Fotos nur auf dem Gerät

Unter Bilderrahmen „Nur auf diesem Gerät“ auswählen, dann Fotos hinzufügen. JPEG, PNG, WebP und GIF sind vorgesehen. Die Fotos werden als Dateien in IndexedDB dieses Browsers gespeichert und bleiben nach normalem Neuladen vorhanden. Es erfolgt kein Upload zum Familienserver. Beim Löschen der Browserdaten gehen diese Kopien verloren; die ursprünglichen Bilddateien werden nicht gelöscht. Andere Geräte besitzen einen eigenen lokalen Bildbestand. Private Browserfenster können die Speicherung begrenzen oder beim Schließen löschen.

## Container-Speicher

„Container-Speicher“ zeigt den konfigurierten `PHOTO_DIR` bzw. `DATA_DIR/photos`. Fotos bis 20 MB können über die Oberfläche hochgeladen werden. Größere direkt abgelegte Dateien lassen sich je nach Browser anzeigen. Symlinks werden nicht verfolgt. Die Bild-Endpunkte verlangen ebenso wie die übrigen Familien-APIs eine Anmeldung.

## Netzwerkadresse / IP

Für einen beliebigen Bildserver ist eine kleine JSON-Datei nötig. Ein Browser kann einen entfernten Verzeichnisinhalt nicht allgemeingültig auflisten. Eine passende `photos.json` sieht z.B. so aus:

```json
{
  "images": [
    { "name": "Sommerurlaub", "url": "bilder/urlaub.jpg" },
    { "name": "Unser Garten", "url": "bilder/garten.png" }
  ]
}
```

Auch ein Array von Bildadressen ist möglich:

```json
["bilder/urlaub.jpg", "bilder/garten.png"]
```

In den Einstellungen die Adresse eintragen, etwa `http://192.168.1.20:8090/photos.json`. Relative Bildadressen werden relativ zu dieser Datei aufgelöst. Alle Bilder müssen unter demselben Ursprung liegen, also demselben Protokoll, Host und Port. Der **LXC** muss diese Adresse erreichen können; die Bilder werden über euren Server an die Geräte weitergereicht. Dadurch benötigt der Bildserver keine CORS-Freigabe, und ein HTTPS-Gerät lädt kein unverschlüsseltes Bild direkt.

Für diese einfache Quelle sind keine zusätzlichen Zugangsdaten vorgesehen. HTTP-Weiterleitungen werden nicht verfolgt; die endgültige Adresse konfigurieren. Verzeichnisauflistung als HTML, SMB-Pfade oder ein allgemeiner Container-Port ohne Bild-Manifest reichen nicht aus. Maximale Liste: 2000 Einträge, 20 MB pro über die Quelle geladenem Bild.

## Immich

1. In deiner Immich-Instanz einen eigenen API-Schlüssel anlegen. Nur Zugriff auf die benötigten Alben und deren Bilder geben, soweit die Instanz solche Berechtigungen unterstützt.
2. Unter Einstellungen die vollständige Basisadresse eintragen, etwa `http://192.168.1.30:2283`, und den API-Schlüssel speichern. Kein persönliches Passwort verwenden.
3. Unter Bilderrahmen „Immich“ wählen und ein Album auswählen.

Der Server liest `/api/albums`, `/api/albums/{id}` und `/api/assets/{id}/thumbnail?size=preview` mit dem Header `x-api-key`. Es werden nur IMAGE-Assets angezeigt, keine Videos. Der Schlüssel bleibt auf eurem Server verschlüsselt; der Browser erhält ausschließlich Albumdaten und die weitergereichten Bilder. Bei einem Instanzwechsel den Schlüssel neu eingeben. Der Container muss Immich über diese Adresse erreichen können.

Diese Integration muss gegen eure eingesetzte Immich-Version geprüft werden. API-Änderungen, fehlende Schlüsselberechtigungen, externe Auth-Proxies und sehr große Alben können Anpassungen nötig machen. Die Anwendung verändert oder löscht keine Immich-Fotos.

## Offizielle Referenzen

- [Google OAuth für Webanwendungen und Weiterleitungsregeln](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Calendar API: Events](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- [Google: Ablauf von Refresh-Tokens](https://developers.google.com/identity/protocols/oauth2#expiration)
- [Immich API](https://api.immich.app/)
- [Node.js 22.13: SQLite](https://nodejs.org/download/release/v22.13.1/docs/api/sqlite.html)
