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

// ── 5. the type system ───────────────────────────────────────────────────────
//
// Font family is not cosmetic here. The editor decides which webfont link to
// inject by EXACT-matching the fontFamily string against its catalogue
// (editor-api seedFonts.js). A value that matches nothing loads nothing and the
// page silently renders in Arial, which is what every generated landing page
// did for months while the code read 'Rubik, Assistant, Arial, sans-serif'.

/** Every fontFamily anywhere in a tree. */
function fontsIn(node, out = new Set()) {
  if (Array.isArray(node)) { node.forEach((n) => fontsIn(n, out)); return out; }
  if (!node || typeof node !== 'object') return out;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'fontFamily' && typeof v === 'string') out.add(v);
    else if (v && typeof v === 'object') fontsIn(v, out);
  }
  return out;
}

// The cssRule strings from editor-api src/seedFonts.js, verbatim, plus the
// system mono stack (Latin digits only, needs no catalogue entry).
const DATA_STACK = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const SERVABLE_FONTS = new Set([
  "'Rubik', sans-serif",
  "'Heebo', sans-serif",
  "'Assistant', sans-serif",
  "'Secular One', sans-serif",
  "'Frank Ruhl Libre', serif",
  'ui-monospace, SFMono-Regular, Menlo, monospace',
]);

test('every font asked for is one the editor can actually serve', () => {
  for (const { pattern, variant } of landingVariantPairs()) {
    const { section } = composeLandingSection(pattern, copyFor(pattern), PALETTE, { variant });
    for (const font of fontsIn(section)) {
      assert.ok(
        SERVABLE_FONTS.has(font),
        `${pattern}:${variant} asks for "${font}", which is not a cssRule in the editor's font catalogue. ` +
        'It will load no webfont and render in Arial.',
      );
    }
  }
});

test('the three type roles are actually distinct on a page that uses all of them', () => {
  const { section } = composeLandingSection(
    'statbar',
    { stats: [{ value: '99', label: 'לחודש' }] },
    PALETTE,
    { variant: 'row' },
  );
  const fonts = fontsIn(section);
  assert.ok(fonts.has('ui-monospace, SFMono-Regular, Menlo, monospace'), 'a bare numeric stat value is machine output and takes the mono role');
  assert.ok(fonts.has("'Heebo', sans-serif"), 'its label is prose and takes the body role');
});

test('the mono role is never applied to Hebrew, which it has no glyphs for', () => {
  // A live run put "10 דקות" in a stat value. In a Latin mono that falls back
  // per glyph and renders as spaced-out mismatched Hebrew.
  const { section } = composeLandingSection(
    'statbar',
    { stats: [{ value: '10 דקות', label: 'להתחלה' }] },
    PALETTE,
    { variant: 'row' },
  );
  const json = JSON.stringify(section);
  const monoRun = /"fontFamily":"ui-monospace[^"]*"[^}]*}[^}]*}[^}]*"text":"10 דקות"/.test(json);
  assert.ok(!monoRun, 'a stat value containing Hebrew must not take the mono role');
  // It takes the display face instead, which has Hebrew. Asserted as "one of
  // the catalogue faces" rather than by name: the display face is resolved per
  // tenant from `palette.displayFont` now, so naming one here would pin a
  // design decision the tenant owns. This test is about the mono guard.
  const display = [...fontsIn(section)].filter((f) => f !== DATA_STACK);
  assert.ok(display.length > 0, 'the stat value must carry some non-mono face');
  for (const f of display) {
    assert.ok(SERVABLE_FONTS.has(f), `${f} is not a catalogue cssRule`);
  }
});

test('display type is set tighter than body type', () => {
  const { section } = composeLandingSection('hero', { heading: 'כותרת', subheading: 'גוף' }, PALETTE, { variant: 'centered' });
  const heights = [];
  (function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.type === 'paragraph' && n.attrs && n.attrs.lineHeight) heights.push(Number(n.attrs.lineHeight));
    Object.values(n).forEach((v) => { if (v && typeof v === 'object') walk(v); });
  })(section);
  assert.ok(heights.length >= 2, 'expected a heading and a paragraph');
  assert.ok(Math.min(...heights) < 1.2, 'the display line must be set tight, not at the 1.4 body default');
  assert.ok(Math.max(...heights) >= 1.4, 'body copy must stay loose enough to read');
});

// ── 6. the driver-default regression guard ───────────────────────────────────
//
// Neither the editor's live-canvas driver nor the standalone render-site
// service reads block() defaults, only the props.justify field on the
// composed JSON node. If a block ever ships without one, both renderers fall
// back to "center", which is the exact defect this file's `block()` change
// fixes. This does not assert which value is correct per site, only that one
// was consciously set, so it also catches a future block node built by hand
// outside the block() helper.

test('every block carries an explicit justify, so the driver never falls back to centering it', () => {
  for (const { pattern, variant } of landingVariantPairs()) {
    const { section } = composeLandingSection(pattern, copyFor(pattern), PALETTE, { variant });
    (function walk(n) {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      if (n.type === 'block') {
        assert.ok(
          n.props && typeof n.props.justify === 'string' && n.props.justify.length > 0,
          `${pattern}:${variant} has a block with no explicit justify — the editor driver and render-site both default this to "center".`,
        );
      }
      Object.values(n).forEach((v) => { if (v && typeof v === 'object') walk(v); });
    })(section);
  }
});

// ── 7. the block-vs-col layout guard ─────────────────────────────────────────
//
// The Creaditor render driver's Block component always interposes an MUI
// `<Grid container>` between the div carrying block()'s own style and
// block()'s actual children:
//
//   <div style={block-style /* layout lands HERE */}>
//     <Grid container>{children /* one level deeper */}</Grid>
//   </div>
//
// So a flex property set on a block() (display:'flex', gap, flexWrap,
// alignItems, justifyContent) applies to a wrapper holding exactly one child
// and does nothing. It is invisible to a snapshot diff (the JSON is exactly
// what was authored, it renders, nothing throws) and invisible to the
// preview renderer (which never applies the driver's Grid defaults at all).
// The only way anyone found this was by looking at a real render.
//
// col() does not have this problem: components/col/index.js copies the col's
// own flexDirection/gap onto the Grid CONTAINER that holds the col's own
// children, one level down from where block()'s style lands.
//
// The fix shape, everywhere in this file: layout goes on a col(), a block()
// is only a content-width wrapper.
//   block([col(kids, { display:'flex', gap, flexDirection, ... }, justify)], blockStyle, justify)
//
// This test walks every declared pattern/variant and fails on the exact
// shape that goes silently dead: a `block` node whose OWN style carries a
// layout property while it has more than one child. A block with exactly one
// child is fine (that child does the layout); a block with layout props and
// zero/one children is fine too (there is nothing multi-item for the dead
// property to have been trying to arrange).
const BLOCK_LAYOUT_PROPS = ['display', 'gap', 'flexWrap', 'alignItems', 'justifyContent'];

test('a block() never carries layout props alongside more than one child (dead due to Grid interposition)', () => {
  for (const { pattern, variant } of landingVariantPairs()) {
    const { section } = composeLandingSection(pattern, copyFor(pattern), PALETTE, { variant });
    (function walk(n) {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      if (n.type === 'block') {
        const style = (n.props && n.props.style) || {};
        const offenders = BLOCK_LAYOUT_PROPS.filter((k) => style[k] !== undefined);
        const childCount = Array.isArray(n.children) ? n.children.length : 0;
        assert.ok(
          offenders.length === 0 || childCount <= 1,
          `${pattern}:${variant} has a block() with ${childCount} children and layout props ` +
            `[${offenders.join(', ')}] set directly on the block's own style. This does nothing: the ` +
            'render driver\'s Block component always wraps a block\'s children in an MUI <Grid container> ' +
            'one level below the div that carries this style, so any flex property here applies to a ' +
            'wrapper holding exactly one child (the Grid) and never reaches the block\'s real children. ' +
            'Move the layout onto a col(): block([col(kids, { <these props> }, justify)], blockStyle, justify).',
        );
      }
      Object.values(n).forEach((v) => { if (v && typeof v === 'object') walk(v); });
    })(section);
  }
});

// ── 8. the column-wrap landmine guard ────────────────────────────────────────
//
// A SEPARATE trap found while fixing the one above, on sites the block-vs-col
// guard cannot see because they were already col()-wrapped: a col() whose own
// style sets `flexDirection: 'column'` while holding MORE THAN ONE col()/
// block() child (each its own lg:12 MUI Grid item) risks the real renderer
// wrapping child 2+ into a SECOND COLUMN placed off-canvas to the side,
// instead of continuing to stack downward -- measured directly: rows landed
// at x=1334 and x=2540 in a 1440px-wide viewport. MUI's Grid container ships
// `flex-wrap: wrap` in its own baseline CSS with no lever page-kit can pull to
// turn it off, so an explicit column direction plus that always-on wrap is
// what triggers it once the stacked content is tall enough.
//
// The safe shape (used throughout this file after the fix): leave
// flexDirection unset, let the container's default row+wrap do the stacking
// (each lg:12 child is 100% wide, so wrap puts one per line), and pass `gap`
// alone if inter-row spacing is needed -- gap reaches the real Grid container
// independently of flexDirection and works between wrapped lines too.
//
// This guard cannot safely be fully automatic: a col() of LEAF children
// (text/heading/button, never Grid items) legitimately uses
// flexDirection:'column' throughout this file (problemHead, solutionHead,
// every hero copy stack) and is not at risk, only col()/block() CHILDREN are.
test('a col() with flexDirection:column never stacks more than one col()/block() child (column-wrap landmine)', () => {
  for (const { pattern, variant } of landingVariantPairs()) {
    const { section } = composeLandingSection(pattern, copyFor(pattern), PALETTE, { variant });
    (function walk(n) {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      if (n.type === 'col') {
        const style = (n.props && n.props.style) || {};
        const isColumn = typeof style.flexDirection === 'string' && style.flexDirection.indexOf('column') === 0;
        const gridItemChildren = (Array.isArray(n.children) ? n.children : []).filter(
          (c) => c && typeof c === 'object' && (c.type === 'col' || c.type === 'block'),
        );
        assert.ok(
          !isColumn || gridItemChildren.length <= 1,
          `${pattern}:${variant} has a col() with flexDirection:'column' holding ${gridItemChildren.length} ` +
            'col()/block() children (each its own lg:12 Grid item). MUI\'s Grid container always ships ' +
            'flex-wrap:wrap in its own CSS, so an explicit column direction here risks the real renderer ' +
            'wrapping child 2+ into a second column off-canvas instead of stacking it further down -- ' +
            'measured directly on the render-site service. Drop flexDirection (default row+wrap plus each ' +
            'child\'s own 100% width already stacks them) and pass `gap` alone if spacing is needed.',
        );
      }
      Object.values(n).forEach((v) => { if (v && typeof v === 'object') walk(v); });
    })(section);
  }
});

// ── the photographic ground ──────────────────────────────────────────────────
//
// A band photo is a ground, not a subject: it goes under a scrim of the same
// colour the band already had, so the copy stays legible and a photo that fails
// to load degrades to the flat band rather than to white.

const PAL = { primary: '#1b65a0', secondary: '#e2a13b' };
const IMG = 'https://images.example.com/ground.jpg';
const groundOf = (pattern, opts) =>
  (composeLandingSection(pattern, { heading: 'כותרת', subheading: 'תת כותרת', cta: 'לחצו' }, PAL, opts)
    .section.props.style) || {};

test('a band given a background photo scrims it and keeps the flat ground as the fallback', () => {
  for (const pattern of ['hero', 'leadform']) {
    const style = groundOf(pattern, { backgroundImage: IMG });
    assert.ok(style.background, `${pattern} dropped its solid ground, so a failed photo would render white`);
    assert.match(style.backgroundImage, /^linear-gradient\(to bottom, rgba\(/,
      `${pattern} put the photo down without a scrim in front of it`);
    assert.ok(style.backgroundImage.includes(`url("${IMG}")`), `${pattern} did not reference the photo`);
    assert.strictEqual(style.backgroundSize, 'cover');
  }
});

test('a band given no background photo is byte-identical to the flat band it always was', () => {
  for (const pattern of ['hero', 'leadform']) {
    for (const opts of [{}, { backgroundImage: '' }, { backgroundImage: null }]) {
      const style = groundOf(pattern, opts);
      assert.ok(style.background, `${pattern} lost its ground`);
      assert.strictEqual(style.backgroundImage, undefined,
        `${pattern} invented a backgroundImage with no photo to put in it`);
    }
  }
});

test('a band already carrying a foreground photo never takes a second one behind it', () => {
  // hero:asymmetric renders a feature photo beside the copy. A ground photo as
  // well is two photos competing in one band, which is the failure mode the
  // whole scrim exists to avoid.
  const { section } = composeLandingSection(
    'hero',
    { heading: 'כותרת', image: 'https://images.example.com/feature.jpg' },
    PAL,
    { variant: 'asymmetric', backgroundImage: IMG },
  );
  assert.strictEqual(section.props.style.backgroundImage, undefined);
});

test('the scrim is built from the band own colour, not from a fixed black', () => {
  // A grey scrim over a blue band reads as dirt on the brand. The rgba must
  // carry the ground colour it is sitting on.
  const style = groundOf('hero', { backgroundImage: IMG });
  const flat = groundOf('hero', {});
  const hex = String(flat.background).replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
  assert.ok(style.backgroundImage.includes(`rgba(${rgb},`),
    `scrim ${style.backgroundImage.slice(0, 60)} does not carry the band colour ${flat.background}`);
});
