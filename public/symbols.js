const segmenter = new Intl.Segmenter('de', { granularity: 'grapheme' });
export function isEmoji(value) {
  return typeof value === 'string' && (value === '' || value.length <= 64 && [...segmenter.segment(value)].length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(value));
}
const groups = [
  ['faces', 'Gesichter', '😀 Lachen|😊 Freundlich|🥰 Liebe|😎 Cool|🤩 Begeistert|🥳 Feiern|😴 Schlafen|🤒 Krank|🤗 Umarmung|😢 Traurig|😂 Lustig|🤔 Denken|👍 Gut|👏 Applaus|🙌 Geschafft|❤️ Herz'],
  ['family', 'Familie & Termine', '👨‍👩‍👧‍👦 Familie|👶 Baby|🧒 Kind|👩 Frau|👨 Mann|👵 Oma|👴 Opa|🎂 Geburtstag|🎉 Feier|🎁 Geschenk|📅 Termin|⏰ Wecker|🏠 Zuhause|🏥 Arzt|🦷 Zahnarzt|💊 Medizin|🚗 Auto|🚌 Bus|🚆 Zug|✈️ Reise|🧳 Urlaub'],
  ['school', 'Schule & Sport', '🏫 Schule|🎒 Schulranzen|📚 Bücher|✏️ Hausaufgaben|📝 Schreiben|💻 Computer|🎨 Malen|🎵 Musik|🎸 Gitarre|🎹 Klavier|⚽ Fußball|🏀 Basketball|🏐 Volleyball|🎾 Tennis|🏊 Schwimmen|🚴 Radfahren|🏃 Laufen|🏋️ Fitness|🤸 Turnen|🧘 Yoga|🏆 Pokal|🥇 Medaille'],
  ['food', 'Essen', '🍎 Apfel|🍌 Banane|🍇 Trauben|🥕 Karotte|🥦 Brokkoli|🥗 Salat|🍞 Brot|🥐 Frühstück|🥞 Pfannkuchen|🍳 Ei|🍕 Pizza|🍝 Nudeln|🍚 Reis|🍲 Suppe|🍔 Burger|🐟 Fisch|🍰 Kuchen|🍦 Eis|🥛 Milch|☕ Kaffee|🍽️ Essen'],
  ['home', 'Haushalt', '🧹 Fegen|🧽 Putzen|🧼 Waschen|🛁 Baden|🚿 Duschen|🪥 Zähne putzen|🧺 Wäsche|👕 Kleidung|🛏️ Bett machen|🗑️ Müll|♻️ Recycling|🛒 Einkaufen|🛍️ Einkauf|🍴 Tisch decken|🐕 Hund|🐈 Katze|🐾 Haustier|🌱 Pflanzen|💧 Gießen|🔧 Reparieren|📦 Aufräumen'],
  ['nature', 'Natur & Symbole', '☀️ Sonne|🌤️ Heiter|☁️ Wolken|🌧️ Regen|❄️ Schnee|🌈 Regenbogen|🌙 Nacht|🌳 Baum|🌸 Blume|🌊 Meer|⛰️ Berge|🔥 Feuer|⭐ Stern|✅ Erledigt|❗ Wichtig|📌 Merken|💡 Idee|🔔 Erinnerung|💤 Ruhe|💯 Punkte|🔴 Rot|🟠 Orange|🟡 Gelb|🟢 Grün|🔵 Blau|🟣 Lila'],
];
export const emojiCategories = groups.map(([id, title]) => ({ id, title }));
export const emojis = groups.flatMap(([category, , entries]) => entries.split('|').map(entry => { const space = entry.indexOf(' '); return { emoji: entry.slice(0, space), label: entry.slice(space + 1), category }; }));
export function findEmojis(search = '', category = '') {
  const q = search.trim().toLocaleLowerCase('de');
  return emojis.filter(item => (!category || item.category === category) && (!q || (item.label + ' ' + item.emoji).toLocaleLowerCase('de').includes(q)));
}
