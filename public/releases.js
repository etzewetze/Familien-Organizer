export const VERSION = '0.8.0';
export const releases = [
  { version: '0.8.0', date: '2026-10-16', title: 'Ferien, Feiertage und Kalenderimport', changes: [
    'Plannamen dürfen leer sein. Die Anzeige verwendet dann den zugeordneten Personennamen.',
    'Ferien und Feiertage lassen sich im Kalender aktivieren, ansehen, bearbeiten und selbst ergänzen. Bundesland und Jahr laden eine prüfbare Vorschau.',
    'ICS-Dateien importieren, Einträge auswählen und Alle oder eine Person zuordnen. Wiederholungen werden im ausgewählten Zeitraum aufgelöst; doppelte Importe werden übersprungen.',
    'Schulpläne können während zugeordneter Ferien und Feiertage pausieren. Für Kita ist die Ferienpause getrennt einstellbar.',
  ] },
  { version: '0.7.0', date: '2026-10-16', title: 'Aufgabenbibliothek, Stundenpläne und Jahreskalender', changes: [
    'Geburtstage lassen sich direkt nach Namen durchsuchen. Der Kalender bietet eine Jahresansicht mit Geburtstagen und Terminen.',
    'Wiederverwendbare Aufgabenvorlagen mit Bild oder Emoji, Punkten und optionaler Nummer: ziehen oder bei einer Person nach Name oder Nummer auswählen.',
    'Aufgaben als Symbole: einmal tippen zeigt den Titel, doppelt tippen erledigt oder öffnet die Aufgabe, gedrückt halten bietet Bearbeiten und Entfernen. Personen werden platzsparend in mehreren Reihen angeordnet.',
    'Stundenpläne für Montag bis Freitag mit 6, 8, 10 oder 12 Stunden und Pausenbalken. Kitapläne haben eigene Bring- und Abholzeiten.',
    'Unterkalender pro Kind als schmale farbige Zeitbalken im Hauptkalender; eine Einführung erklärt den ersten zuschaltbaren Plan.',
    'Die Navigation lässt sich auf Symbole einklappen und über den Stift in eine eigene Reihenfolge bringen.',
  ] },
  { version: '0.6.0', date: '2026-10-09', title: 'Wetter, Tabletmodus und persönliche Symbole', changes: [
    'Nach einem Software-Update werden alle Geräte abgemeldet. Nach dem Anmelden erscheint diese Änderungsübersicht.',
    'Wetter neben der Uhr: aktuelle Temperatur, Wetterlage und Regenhinweis. Antippen öffnet die 14-Tage-Vorhersage mit mehreren speicherbaren Orten.',
    'Geräteeinstellungen für Inaktivität: dunkler Ruhebildschirm oder automatischer Bilderrahmen. Eine Berührung bringt den Organizer zurück.',
    'Termine und Aufgaben können ein eigenes Bild und ein Emoji erhalten. Die Emoji-Auswahl bietet Kategorien und eine Suche.',
  ] },
  { version: '0.5.1', date: '2026-10-09', title: 'Alle Personenfarben im Termin', changes: ['Termine für mehrere Personen zeigen einen durchgehenden Verlauf aller ausgewählten Personenfarben, auch bei Terminen ohne Endzeit.'] },
  { version: '0.5.0', date: '2026-10-09', title: 'Mehr Gestaltung für eure Familie', changes: ['Zentrierte Profile mit eigenen Bildern, anpassbare Hintergrund- und Headerfarben, kompakterer Kalender und eigener Farbton für Alle.', 'Waagerechter oder senkrechter Essensplan, Rezeptvorschaubilder und Geburtstage mit Kuchen und optionalem Alter.'] },
];
