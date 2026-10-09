import { check } from './model.mjs';
import { fetchPublicRecipePage, fetchPublicRecipeImage } from './public-web.mjs';

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', frac12: '½', frac14: '¼', frac34: '¾', ndash: '–', mdash: '—' };
function plain(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<(?:br\b[^>]*|\/(?:p|div|li|ol|ul|h[1-6]))\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (entity, code) => {
      if (!code.startsWith('#')) return ENTITIES[code] ?? entity;
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
    }).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const oneLine = value => plain(value).replace(/\s+/g, ' ');
const list = value => Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
const isType = (value, type) => list(value?.['@type']).some(t => typeof t === 'string' && (t === type || /^https?:\/\/schema\.org\//.test(t) && t.split('/').pop() === type));

function imageUrl(value, sourceUrl) {
  for (const image of list(value).slice(0, 16)) {
    const address = typeof image === 'string' ? image : image?.contentUrl || image?.url;
    if (typeof address !== 'string' || !address.trim() || address.length > 2048) continue;
    try {
      const url = new URL(address.trim(), sourceUrl);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.toString().length <= 2048) return url.toString();
    } catch {}
  }
  return '';
}

function recipeNodes(html) {
  const documents = [];
  if (/^\s*[\[{]/.test(html)) { try { documents.push(JSON.parse(html)); } catch {} }
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\btype\s*=\s*(?:["']application\/ld\+json(?:[^"']*)["']|application\/ld\+json(?=\s|$))/i.test(match[1])) continue;
    try { documents.push(JSON.parse(match[2].trim().replace(/^<!--\s*|\s*-->$/g, ''))); } catch {}
  }
  const recipes = [], stack = documents.reverse().map(value => [value, 0]); let visited = 0;
  while (stack.length) {
    const [value, depth] = stack.pop();
    check(++visited <= 30000 && depth <= 60, 'Die Rezeptdaten sind zu umfangreich.');
    if (!value || typeof value !== 'object') continue;
    if (isType(value, 'Recipe')) recipes.push(value);
    for (const child of (Array.isArray(value) ? value : Object.values(value)).slice().reverse()) if (child && typeof child === 'object') stack.push([child, depth + 1]);
  }
  return recipes;
}

function amount(value) {
  const normalized = value.replace(/,/g, '.');
  if (/^\d+\/\d+$/.test(normalized)) {
    const [a, b] = normalized.split('/').map(Number); return b ? a / b : NaN;
  }
  if (/^\d+\s+\d+\/\d+$/.test(normalized)) {
    const [whole, fraction] = normalized.split(/\s+/); return Number(whole) + amount(fraction);
  }
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(value)) return Number(value.replace(/\./g, '').replace(',', '.'));
  return Number(normalized);
}
const UNITS = new Map([
  ['g', 'g'], ['gr', 'g'], ['gramm', 'g'], ['grm', 'g'], ['kg', 'kg'], ['kilogramm', 'kg'], ['kgm', 'kg'],
  ['ml', 'ml'], ['milliliter', 'ml'], ['mlt', 'ml'], ['cl', 'cl'], ['l', 'l'], ['liter', 'l'], ['ltr', 'l'],
  ['el', 'EL'], ['esslöffel', 'EL'], ['tl', 'TL'], ['teelöffel', 'TL'], ['tsp', 'TL'], ['tbsp', 'EL'],
  ['prise', 'Prise'], ['prisen', 'Prise'], ['bund', 'Bund'], ['bünde', 'Bund'], ['dose', 'Dose'], ['dosen', 'Dose'],
  ['stück', 'Stück'], ['stücke', 'Stück'], ['stk', 'Stück'], ['st', 'Stück'], ['packung', 'Packung'], ['packungen', 'Packung'],
  ['päckchen', 'Päckchen'], ['pck', 'Päckchen'], ['becher', 'Becher'], ['glas', 'Glas'], ['gläser', 'Glas'], ['cup', 'cup'], ['cups', 'cup'],
]);
const FRACTIONS = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };

export function parseIngredient(value) {
  if (value && typeof value === 'object') {
    if (value.item) return parseIngredient(value.item);
    const name = oneLine(value.name), unit = oneLine(value.unitText || value.unitCode || '');
    if (name && value.value !== undefined) return parseIngredient(`${value.value} ${UNITS.get(unit.toLowerCase()) || unit} ${name}`);
    value = name;
  }
  const original = oneLine(value);
  const unknown = () => ({ ingredient: { name: original.slice(0, 100), quantity: 0, unit: '', category: 'Sonstiges' }, uncertain: true });
  const normalized = original.replace(/(\d)([½⅓⅔¼¾⅛⅜⅝⅞])/g, '$1 $2').replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, fraction => FRACTIONS[fraction]);
  const match = normalized.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)*)(?=\s|[a-zäöü]|$)\s*(.*)$/i);
  if (!match || /^[-–—/]/.test(match[2]) || !match[2]) return unknown();
  const quantity = amount(match[1]);
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 100000) return unknown();
  let name = match[2], unit = '';
  const unitMatch = name.match(/^([^\s]+)\s+(.+)$/);
  if (unitMatch) {
    const key = unitMatch[1].replace(/\([^)]*\)|\.$/g, '').toLocaleLowerCase('de');
    if (UNITS.has(key)) { unit = UNITS.get(key); name = unitMatch[2]; }
  }
  return { ingredient: { name: name.slice(0, 100), quantity, unit, category: 'Sonstiges' }, uncertain: name.length > 100 };
}

function ingredientValues(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.itemListElement)) return value.itemListElement;
  if (typeof value === 'string') return value.split(/\r?\n/).filter(v => v.trim());
  return list(value);
}
function instructions(value, depth = 0) {
  if (depth > 20) return [];
  if (typeof value === 'string') return [plain(value)];
  if (Array.isArray(value)) return value.flatMap(v => instructions(v, depth + 1));
  if (!value || typeof value !== 'object') return [];
  if (value.itemListElement) return [...(value.name ? [plain(value.name)] : []), ...instructions(value.itemListElement, depth + 1)];
  if (value.item) return instructions(value.item, depth + 1);
  return [plain(value.text || value.description || value.name || '')];
}
function duration(value) {
  if (typeof value !== 'string') return 0;
  const match = value.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  return match ? Math.ceil(Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0) + Number(match[4] || 0) / 60) : 0;
}

export function parseRecipePage(html, sourceUrl) {
  check(typeof html === 'string' && Buffer.byteLength(html) <= 2 * 1024 * 1024, 'Die Rezeptseite ist zu groß.', 413);
  const nodes = recipeNodes(html);
  const recipe = nodes.find(r => typeof r.name === 'string' && ingredientValues(r.recipeIngredient ?? r.ingredients).length) || nodes[0];
  check(recipe, 'Auf dieser Seite wurden keine auslesbaren Rezeptdaten gefunden. Bitte einen direkten Rezeptlink verwenden oder das Rezept manuell eintragen.', 422);
  const title = oneLine(recipe.name);
  check(title, 'Auf der Webseite fehlt der Rezeptname.', 422);
  const values = ingredientValues(recipe.recipeIngredient ?? recipe.ingredients);
  check(values.length > 0 && values.length <= 100, 'Das Rezept muss zwischen 1 und 100 Zutaten enthalten.', 422);
  const parsed = values.map(parseIngredient).filter(p => p.ingredient.name);
  check(parsed.length > 0, 'Die Zutaten konnten nicht ausgelesen werden.', 422);
  const yieldText = list(recipe.recipeYield).map(v => typeof v === 'object' && v ? String(v.value ?? '') : typeof v === 'number' ? String(v) : oneLine(v)).join(' ');
  const count = Number(yieldText.match(/\d+/)?.[0] || 0);
  const servings = Number.isInteger(count) && count >= 1 && count <= 100 ? count : 4;
  const minutes = duration(recipe.totalTime) || duration(recipe.prepTime) + duration(recipe.cookTime);
  const steps = instructions(recipe.recipeInstructions).filter(Boolean).join('\n\n');
  const warnings = [];
  if (parsed.some(p => p.uncertain)) warnings.push('Einige Zutatenmengen wurden nicht sicher erkannt und bleiben als Text erhalten. Bitte vor dem Speichern prüfen.');
  if (servings !== count) warnings.push('Keine eindeutige Portionszahl gefunden. Vorerst sind 4 Portionen eingetragen.');
  if (!steps) warnings.push('Die Webseite liefert keine auslesbare Zubereitung. Du kannst sie vor dem Speichern ergänzen.');
  if (title.length > 160 || steps.length > 15000 || minutes > 1440) warnings.push('Ein sehr langer Text oder Zeitwert wurde gekürzt. Bitte die Vorschau prüfen.');
  return {
    recipe: {
      title: title.slice(0, 160), servings, minutes: Math.min(minutes, 1440),
      category: oneLine(list(recipe.recipeCategory)[0] || 'Hauptgericht').slice(0, 60) || 'Hauptgericht',
      ingredients: parsed.map(p => p.ingredient), instructions: steps.slice(0, 15000), sourceUrl,
    }, warnings, imageUrl: imageUrl(recipe.image, sourceUrl),
  };
}

export async function importRecipe(url, options) {
  const page = await fetchPublicRecipePage(url, options);
  const result = parseRecipePage(page.html, page.sourceUrl);
  if (result.imageUrl) {
    try { result.image = (await fetchPublicRecipeImage(result.imageUrl, options)).bytes; }
    catch { result.warnings.push('Das Rezeptbild konnte nicht geladen werden. Du kannst ein eigenes Bild hinzufügen.'); }
  }
  return result;
}
