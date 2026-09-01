/**
 * page-kit's first tests.
 *
 * Two jobs:
 *   1. Pin the CURRENT rendered tree for every (pattern, variant) as a
 *      snapshot, BEFORE the redesign changes any of them. A diff you can read
 *      is the whole point: page-kit is consumed by editor-api as well as
 *      cdtr-studio, and nothing today would tell either of them that a section
 *      changed shape.
 *   2. Guard the vocabulary against drift: every declared variant must actually
 *      render, and the fallback rules must hold.
 *
 * Uses node:test and node:assert so page-kit gains no dependency. It is
 *  installed by two services; a devDependency here is not free.
 *
 * Update snapshots deliberately, never reflexively:
 *   UPDATE_SNAPSHOTS=1 node --test test/
 *
 * No em-dash (U+2014) and no en-dash (U+2013) anywhere in this file.
 */

const test = require('node:test');
const assert = require('node:assert');
const { readFileSync, writeFileSync, mkdirSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const { composeLandingSection } = require('../landingSections.js');
const {
  LANDING_VOCABULARY,
  LANDING_PATTERNS,
  landingVariantPairs,
  resolveLandingVariant,
  describeLandingVocabulary,
} = require('../landingVocabulary.js');

const SNAP_DIR = join(__dirname, '__snapshots__');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

const PALETTE = { primary: '#1b65a0', secondary: '#964462', accent: '#851d92' };

/** Copy rich enough that every variant's `needs` are satisfied. */
const COPY = {
  eyebrow: 'לפני הכל',
  heading: 'כותרת ראשית לבדיקה',
  subheading: 'שורת משנה קצרה',
  paragraph: 'פסקה קצרה שמסבירה את ההקשר בלי למכור.',
  paragraphs: ['פסקה ראשונה על העסק.', 'פסקה שנייה קצרה יותר.'],
  cta: 'רוצים לראות דוגמה?',
  bullets: ['פריט ראשון', 'פריט שני', 'פריט שלישי'],
  // pricing's real contract: studio's toCopy flattens tiers[0] into these
  // before page-kit ever sees it, so page-kit takes a single plan, not a list.
  planName: 'חבילה לעסקים',
  price: '99',
  features: ['תכונה א', 'תכונה ב'],
  regularNote: 'במקום 149',
  urgency: 'עד סוף החודש',
  stats: [{ value: '6', label: 'כלים במקום אחד' }, { value: '99', label: 'לחודש' }],
  text: 'ההודעה הראשונה על חשבוננו',
  submit: 'שלחו לי דוגמה',
  image: 'https://example.test/photo.jpg',
  items: [{ title: 'כותרת פריט', text: 'טקסט פריט' }],
  thread: [
    { text: 'היי, נכנס משהו חדש. רוצים הצצה?', from: 'business', time: '09:41' },
    { text: 'כן, תשלחו לי', from: 'customer', time: '09:44' },
  ],
};

/**
 * `items` is not one shape. Each pattern reads different keys off it:
 * testimonials wants { quote, name, role }, faq wants { q, a }, articles wants
 * { title, text, url, image }, and problem/bonuses want { title, text }. A
 * single fixture shape makes the needs cross-check pass for the wrong reason,
 * so give each pattern the shape its renderer actually reads.
 */
const ITEMS_BY_PATTERN = {
  testimonials: [{ quote: 'שירות מצוין', name: 'רותי', role: 'בעלת חנות' }],
  faq: [{ q: 'כמה זה עולה?', a: 'תשעים ותשעה שקלים לחודש.' }],
  articles: [{ title: 'כותרת מאמר', text: 'תקציר קצר', url: 'https://example.test/a', image: 'https://example.test/t.jpg' }],
};

function copyFor(pattern) {
  const items = ITEMS_BY_PATTERN[pattern];
  return items ? { ...COPY, items } : COPY;
}

/**
 * Ids are minted per call (`cid()` wraps randomUUID), so they cannot be part of
 * a snapshot. Strip them and keep everything that describes SHAPE: types,
 * nesting, styles and copy.
 */
function stripIds(node) {
  if (Array.isArray(node)) return node.map(stripIds);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'id' || k === '_id') continue;
      out[k] = stripIds(v);
    }
    return out;
  }
  return node;
}

function snapshot(name, value) {
  if (!existsSync(SNAP_DIR)) mkdirSync(SNAP_DIR, { recursive: true });
  const file = join(SNAP_DIR, `${name}.json`);
  const actual = JSON.stringify(value, null, 2);
  if (UPDATE || !existsSync(file)) {
    writeFileSync(file, actual + '\n', 'utf8');
    return;
  }
  const expected = readFileSync(file, 'utf8').trimEnd();
  assert.strictEqual(
    actual,
    expected,
    `Snapshot mismatch for "${name}".\n` +
      'If the change is intended, re-run with UPDATE_SNAPSHOTS=1 and read the diff before committing.',
  );
}

// ── 1. shape snapshots ───────────────────────────────────────────────────────

test('every declared variant renders and matches its snapshot', async (t) => {
  for (const { pattern, variant } of landingVariantPairs()) {
    await t.test(`${pattern}:${variant}`, () => {
      const { section } = composeLandingSection(pattern, copyFor(pattern), PALETTE, { variant });
      assert.ok(section, 'composeLandingSection returned no section');
      assert.strictEqual(section.type, 'section');
      snapshot(`${pattern}.${variant}`, stripIds(section));
    });
  }
});

test('variants of the same pattern render differently', () => {
  // Without this, adding a variant name to the vocabulary and forgetting to
  // branch on it in the renderer would pass every other test in this file: the
  // snapshots would simply be identical and nobody would look.
  for (const pattern of LANDING_PATTERNS) {
    const names = Object.keys(LANDING_VOCABULARY[pattern].variants);
    if (names.length < 2) continue;
    const seen = new Map();
    for (const variant of names) {
      const { section } = composeLandingSection(pattern, copyFor(pattern), PALETTE, { variant });
      const shape = JSON.stringify(stripIds(section));
      const clash = seen.get(shape);
      assert.ok(
        !clash,
        `${pattern}: variants "${clash}" and "${variant}" render an identical tree, so one of them is not wired up`,
      );
      seen.set(shape, variant);
    }
  }
});

test('a variant renders real content from its declared needs alone', () => {
  // The sharpest anti-drift guard in this file. `needs` drives the fallback
  // logic, so a `needs` naming the wrong field is silently destructive: the
  // resolver thinks a variant is satisfiable, the renderer gets nothing it can
  // use, and the page ships a section with no words in it.
  //
  // This caught four real errors when it was written. testimonials, bonuses,
  // faq and articles all read `items`, not `bullets`; whyBuy reads `paragraph`;
  // about reads `paragraphs`; pricing reads price/features because studio's
  // toCopy flattens tiers[0] before it ever gets here.
  for (const { pattern, variant } of landingVariantPairs()) {
    const spec = LANDING_VOCABULARY[pattern].variants[variant];
    // `leadform` genuinely needs no copy: it renders hardcoded field labels.
    // An empty `needs` is a valid declaration, not a gap.
    if (spec.needs.length === 0) continue;
    const minimal = {};
    const source = copyFor(pattern);
    for (const field of spec.needs) minimal[field] = source[field];

    const { section } = composeLandingSection(pattern, minimal, PALETTE, { variant });
    const rendered = JSON.stringify(stripIds(section));

    // Assert the fixture's OWN strings survive into the tree. Looking for a
    // tiptap "text" field would be too narrow: faq renders through an
    // `accordion` element whose copy lives in props.items, not in a text node.
    const supplied = [];
    const collect = (v) => {
      if (typeof v === 'string' && v.trim()) supplied.push(v);
      else if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    };
    collect(minimal);

    assert.ok(
      supplied.length > 0,
      `${pattern}:${variant} declares needs [${spec.needs.join(', ')}] but the fixture supplies nothing for them. ` +
        'Add the field to COPY or ITEMS_BY_PATTERN, otherwise this test passes vacuously.',
    );
    assert.ok(
      supplied.some((word) => rendered.includes(word)),
      `${pattern}:${variant} renders none of the copy from its declared needs [${spec.needs.join(', ')}]. ` +
        'Either needs names a field the renderer does not read, or the variant is not wired up.',
    );
  }
});

// ── 2. vocabulary integrity ──────────────────────────────────────────────────

test('vocabulary declares nothing the renderer cannot produce', () => {
  for (const pattern of LANDING_PATTERNS) {
    const { section } = composeLandingSection(pattern, copyFor(pattern), PALETTE);
    assert.ok(section, `pattern "${pattern}" is in the vocabulary but renders nothing`);
  }
});

test('every pattern declares a default that exists among its variants', () => {
  for (const pattern of LANDING_PATTERNS) {
    const spec = LANDING_VOCABULARY[pattern];
    assert.ok(
      spec.variants[spec.default],
      `pattern "${pattern}" defaults to "${spec.default}", which is not one of its variants`,
    );
  }
});

test('the generated prompt menu covers every pattern and variant', () => {
  const text = describeLandingVocabulary();
  for (const { pattern, variant } of landingVariantPairs()) {
    assert.match(text, new RegExp(`\\b${pattern}\\b`), `menu omits pattern ${pattern}`);
    assert.match(text, new RegExp(`"${variant}"`), `menu omits variant ${variant}`);
  }
});

// ── 3. fallback rules ────────────────────────────────────────────────────────

test('an unknown pattern resolves to null so the caller can skip it', () => {
  assert.strictEqual(resolveLandingVariant('no-such-pattern', 'x', COPY), null);
});

test('an unknown variant falls back to the default and reports it', () => {
  const r = resolveLandingVariant('hero', 'does-not-exist', COPY);
  assert.strictEqual(r.variant, LANDING_VOCABULARY.hero.default);
  assert.strictEqual(r.fellBackFrom, 'does-not-exist');
});

test('a satisfied variant is returned untouched', () => {
  const r = resolveLandingVariant('hero', 'centered', COPY);
  assert.strictEqual(r.variant, 'centered');
  assert.strictEqual(r.fellBackFrom, null);
});

test('a variant whose required copy is missing falls back rather than rendering empty', () => {
  // `solution:bullets-image` needs bullets. Without them today's renderer emits
  // a column containing one empty paragraph, which is exactly how the live page
  // ended up with a photo beside a blank half.
  const r = resolveLandingVariant('solution', 'bullets-image', { heading: 'רק כותרת' });
  assert.notStrictEqual(r, null);
  assert.strictEqual(r.fellBackFrom, 'bullets-image');
});

test('missing copy is judged by emptiness, not just presence', () => {
  const r = resolveLandingVariant('solution', 'bullets-image', { bullets: [] });
  assert.strictEqual(r.fellBackFrom, 'bullets-image', 'an empty array must count as missing');

  const blank = resolveLandingVariant('guarantee', 'panel', { heading: '   ' });
  assert.strictEqual(blank.fellBackFrom, 'panel', 'a whitespace-only string must count as missing');
});
