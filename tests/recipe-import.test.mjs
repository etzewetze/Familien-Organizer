import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecipePage, parseIngredient, importRecipe } from '../src/recipe-import.mjs';

// Eigene Testrezepte; keine kopierten Rezepte eines Anbieters.
const source = 'https://rezepte.example/gericht';
const recipe = { '@type': 'Recipe', name: 'Familien-Pasta', recipeYield: '4 Portionen', totalTime: 'PT25M', recipeCategory: 'Hauptgericht', recipeIngredient: ['500 g Nudeln', '1,5 EL Olivenöl', '½ Bund Petersilie', 'Salz, nach Geschmack'], recipeInstructions: [{ '@type': 'HowToSection', name: 'Vorbereiten', itemListElement: [{ '@type': 'HowToStep', text: 'Nudeln <b>kochen</b> &amp; abgießen.' }] }, { '@type': 'HowToStep', text: 'Alles vermischen.' }] };
const html = data => `<html><script type="application/ld+json">${JSON.stringify(data)}</script></html>`;

test('Rezeptimport liest Graph, Portionen, Zeiten, Zutaten und strukturierte Schritte', () => {
  const result = parseRecipePage(html({ '@context': 'https://schema.org', '@graph': [{ '@type': 'BreadcrumbList' }, recipe] }), source);
  assert.equal(result.recipe.title, 'Familien-Pasta'); assert.equal(result.recipe.servings, 4); assert.equal(result.recipe.minutes, 25);
  assert.deepEqual(result.recipe.ingredients[0], { name: 'Nudeln', quantity: 500, unit: 'g', category: 'Sonstiges' });
  assert.equal(result.recipe.ingredients[1].quantity, 1.5); assert.equal(result.recipe.ingredients[2].quantity, 0.5);
  assert.equal(result.recipe.ingredients[3].name, 'Salz, nach Geschmack'); assert.equal(result.recipe.ingredients[3].quantity, 0);
  assert.equal(result.recipe.instructions, 'Vorbereiten\n\nNudeln kochen & abgießen.\n\nAlles vermischen.');
  assert.equal(result.recipe.sourceUrl, source); assert.ok(result.warnings.some(w => w.includes('Zutatenmengen')));
});
test('Mengen unterstützen Dezimalzahlen, Tausender, Brüche und gemischte Brüche', () => {
  for (const [line, quantity, unit, name] of [['1.000 g Kartoffeln', 1000, 'g', 'Kartoffeln'], ['1 1/2 TL Zucker', 1.5, 'TL', 'Zucker'], ['1½ EL Öl', 1.5, 'EL', 'Öl'], ['250ml Milch', 250, 'ml', 'Milch'], ['2 Eier', 2, '', 'Eier'], ['1 Dose(n) Tomaten', 1, 'Dose', 'Tomaten']]) {
    const parsed = parseIngredient(line); assert.equal(parsed.ingredient.quantity, quantity, line); assert.equal(parsed.ingredient.unit, unit, line); assert.equal(parsed.ingredient.name, name, line);
  }
  for (const line of ['2-3 Eier', '2 – 3 Eier', '0/0 EL Öl', 'etwas Salz']) { const parsed = parseIngredient(line); assert.equal(parsed.ingredient.name, line); assert.equal(parsed.ingredient.quantity, 0); assert.equal(parsed.uncertain, true); }
});
test('Import unterstützt Typ-Arrays, ItemList-Zutaten, PropertyValue und numerische Portionen', () => {
  const data = { ...recipe, '@type': ['https://schema.org/Recipe'], recipeYield: 2, totalTime: '', prepTime: 'PT5M', cookTime: 'PT10M', recipeIngredient: { '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', item: { '@type': 'PropertyValue', name: 'Mehl', value: '1/2', unitCode: 'KGM' } }] } };
  const result = parseRecipePage(JSON.stringify(data), source);
  assert.equal(result.recipe.servings, 2); assert.equal(result.recipe.minutes, 15);
  assert.deepEqual(result.recipe.ingredients[0], { name: 'Mehl', quantity: 0.5, unit: 'kg', category: 'Sonstiges' });
});
test('Ungültige Skripte werden ignoriert und erstes echtes Rezept bleibt maßgeblich', () => {
  const page = `<script type="application/ld+json">not json</script><script TYPE='application/ld+json'>${JSON.stringify([recipe, { ...recipe, name: 'Anderes Rezept' }])}</script>`;
  assert.equal(parseRecipePage(page, source).recipe.title, 'Familien-Pasta');
  assert.throws(() => parseRecipePage('<html>Nur Text</html>', source), { status: 422 });
  assert.throws(() => parseRecipePage(html({ ...recipe, recipeIngredient: [] }), source), { status: 422 });
  assert.throws(() => parseRecipePage('x'.repeat(2 * 1024 * 1024 + 1), source), { status: 413 });
});
test('Fehlende und überlange Angaben werden als überprüfbare Vorschau zurückgegeben', () => {
  const result = parseRecipePage(html({ ...recipe, recipeYield: undefined, name: 'A'.repeat(200), totalTime: 'P2D', recipeInstructions: 'B'.repeat(16000) }), source);
  assert.equal(result.recipe.title.length, 160); assert.equal(result.recipe.instructions.length, 15000); assert.equal(result.recipe.minutes, 1440);
  assert.equal(result.recipe.servings, 4); assert.ok(result.warnings.some(w => w.includes('Portionszahl'))); assert.ok(result.warnings.some(w => w.includes('gekürzt')));
});
test('URL-Import verwendet die endgültige geprüfte Quelle und speichert keinen Datensatz', async () => {
  const result = await importRecipe(source, { lookup: async () => [{ address: '8.8.8.8', family: 4 }], load: async () => ({ status: 200, headers: { 'content-type': 'text/html' }, bytes: Buffer.from(html(recipe)) }) });
  assert.equal(result.recipe.sourceUrl, source); assert.equal(result.recipe.ingredients.length, 4);
});

test('Rezeptbilder werden aus URL, Array und ImageObject mit relativer Adresse gelesen', () => {
  for (const image of ['/bilder/pasta.jpg', [null, 'javascript:alert(1)', '/bilder/pasta.jpg'], { '@type': 'ImageObject', url: '/bilder/pasta.jpg' }, [{ '@type': 'ImageObject', contentUrl: '/bilder/pasta.jpg' }]]) {
    assert.equal(parseRecipePage(html({ ...recipe, image }), source).imageUrl, 'https://rezepte.example/bilder/pasta.jpg');
  }
  for (const image of [undefined, 'javascript:alert(1)', 'data:image/png;base64,test', 'https://user:secret@rezepte.example/bild.jpg', { '@type': 'ImageObject' }]) assert.equal(parseRecipePage(html({ ...recipe, image }), source).imageUrl, '');
});

test('Rezeptimport lädt ein geprüftes CDN-Bild und erhält das Rezept bei blockierter oder defekter Bildquelle', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yG90AAAAASUVORK5CYII=', 'base64');
  const seen = [], lookup = async () => [{ address: '8.8.8.8', family: 4 }];
  const load = async (url, address, options) => { seen.push({url:url.toString(),address,options}); return url.hostname === 'cdn.example' ? { status:200,headers:{'content-type':'image/png'},bytes:png } : { status:200,headers:{'content-type':'text/html'},bytes:Buffer.from(html({...recipe,image:'https://cdn.example/pasta.png'})) }; };
  const result = await importRecipe(source, { lookup, load });
  assert.deepEqual(result.image, png); assert.equal(result.recipe.title, 'Familien-Pasta'); assert.equal(seen.length, 2); assert.equal(seen[1].address.address, '8.8.8.8'); assert.equal(seen[1].options.maxBytes, 5 * 1024 * 1024);
  for (const image of ['http://192.168.178.1/bild.png', 'https://cdn.example/defekt.png']) {
    let imageRequests = 0;
    const result = await importRecipe(source, { lookup, load: async url => {
      if (url.toString() === source) return { status:200,headers:{'content-type':'text/html'},bytes:Buffer.from(html({...recipe,image})) };
      imageRequests++; return {status:403,headers:{}};
    } });
    assert.equal(result.recipe.title, 'Familien-Pasta'); assert.equal(result.image, undefined); assert.ok(result.warnings.some(w=>w.includes('Rezeptbild')));
    assert.equal(imageRequests, image.startsWith('http://192.') ? 0 : 1);
  }
});
