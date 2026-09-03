/**
 * composeLandingSection, beautiful, on-brand landing/sales-page sections built
 * from pure native elements (heading, text, button, list, image, form…).
 *
 * Design rules (validated in the business-ai preview harness):
 *  - Every section = SEPARATE blocks: a heading block on its own row, then the
 *    content block(s) below it. (A heading must never share a row with content.)
 *  - No `spacer` elements, they render as bars in the editor; spacing is done
 *    with flex `gap` and element `margin`.
 *  - Blocks use a fixed px `width` (the editor forces `max-width:868 !important`,
 *    which a fixed `width` bypasses); never `maxWidth` on blocks/cols.
 *  - Cards / offer boxes / photos are styled `col`s (a styled col IS a card).
 *  - Colors come from the business `palette`, so every brand looks native.
 *
 * Patterns map to the client's 14-section brief:
 *   hero(§1) problem(§2) audience(§3) solution(§4) testimonials(§5/§8)
 *   whyBuy(§6) offer(§7) bonuses(§9) pricing(§10) guarantee(§11)
 *   leadform(§12) about(§13) faq(§14) finalcta
 */
const b = require('./builder.js');
const { cid, makeText, makeButton, makeImage, makeList, buildElement, readableTextOn, parseColor, toHex } = b;
const { deriveTheme } = require('./landingTheme.js');

const CONTENT_WIDTH = 1240; // px content width (width only; block max-width left to the editor)

// ── neutrals, derived from the brand ─────────────────────────────────────────
//
// These used to be five hardcoded constants (INK '#17091F', LIGHT '#F7F5FC',
// LINE '#ECE5F4' and friends), every one of them purple-tinted. That is fine
// for a purple brand and quietly wrong for every other one: on the SendMsg
// tenant, whose palette is blue (#1b65a0), every heading, hairline and section
// band pulled the page toward a purple it does not own. Field report, 2026-09-01:
// "it doesn't look like the brand".
//
// So the neutral ramp is now mixed FROM the brand hue. Same role, same
// contrast, tinted to whatever brand is being rendered. A grey with a trace of
// the brand in it reads as deliberate; a grey with a trace of someone else's
// brand reads as a template.
const mix = (a, bColor, t) => {
  const x = parseColor(a) || { r: 0, g: 0, b: 0 };
  const y = parseColor(bColor) || { r: 255, g: 255, b: 255 };
  return toHex({
    r: Math.round(x.r + (y.r - x.r) * t),
    g: Math.round(x.g + (y.g - x.g) * t),
    b: Math.round(x.b + (y.b - x.b) * t),
  });
};

/**
 * Build the neutral ramp for one palette. Ratios are tuned so the resulting
 * contrasts match what the old fixed constants delivered, which is why the
 * snapshot diff for this change is colour-only and never structural.
 */
function neutrals(palette = {}) {
  const brand = palette.primary || '#1b65a0';
  return {
    INK: mix(brand, '#0b0710', 0.78),   // headings. brand pushed most of the way to black
    BODY: mix(brand, '#2a2532', 0.62),  // body copy
    MUTED: mix(brand, '#7b7787', 0.55), // secondary copy
    LINE: mix(brand, '#ffffff', 0.90),  // hairlines and card borders
    LIGHT: mix(brand, '#ffffff', 0.965), // tinted section bands
    // The page's one dark ground. The brand deepened rather than a new colour,
    // which is what keeps a dark band reading as the tenant's rather than as a
    // theme borrowed from somewhere else.
    FIELD: mix(brand, '#02101c', 0.74),
    FIELD_LINE: mix(brand, '#2b4257', 0.55),
  };
}

// ── type system ──────────────────────────────────────────────────────────────
//
// Three roles, not one face at three sizes. A landing page's personality lives
// in its type, and until now every text node on every generated page carried
// the same `'Rubik, Assistant, Arial, sans-serif'`. That string ALSO matched
// nothing in the editor's font catalogue, so it loaded no webfont and the pages
// shipped in Arial. Both halves of that are fixed here.
//
// These strings are the `cssRule` values from editor-api `src/seedFonts.js`,
// verbatim. The editor exact-matches on them to decide which font link to
// inject, so quotes and spacing are load-bearing, not style. Only five faces in
// that catalogue cover Hebrew: Rubik, Heebo, Assistant, Secular One and Frank
// Ruhl Libre. Anything outside those five renders in a fallback.
//
// DISPLAY: no longer a fixed face. It is resolved per tenant from
//   `palette.displayFont`, see the next block. It WAS Frank Ruhl Libre, a
//   Hebrew serif, on the reasoning that a serif reads as written rather than
//   generated. That was rejected on sight in the 2026-09-02 design review:
//   no serif survived the picks, and the face is now the tenant's to choose.
// BODY: Heebo. Quiet, and different enough from the display face to read as a
//   pair rather than an accident.
// DATA: a system mono, for machine output only: timestamps, prices, counters,
//   stat values. It needs no webfont because these are Latin digits, and it is
//   the one device that makes the numbers read as product rather than
//   decoration. Where the content genuinely IS machine output, a mono face
//   carries meaning instead of adding noise.
const BODY_FONT = "'Heebo', sans-serif";
const DATA = 'ui-monospace, SFMono-Regular, Menlo, monospace';
// Buttons are an interface element rather than prose, so they take the body
// face. makeButton has its own hardcoded default that must be overridden.
const UI_FONT = BODY_FONT;

// ── the business-context-driven display font ─────────────────────────────────
//
// `heading()` used to close over the module-level DISPLAY constant, which
// meant every generated page used the exact same serif regardless of the
// tenant. Nothing populates `palette.displayFont` yet (that is a future
// phase's job), so today every page still gets the same fallback everywhere
// `heading()` is called without an explicit family. The seam exists so that
// the day a field shows up on BusinessContext, this needs no further
// page-kit change.
//
// FALLBACK_DISPLAY is Assistant, not Arial. Arial is not a catalogue face,
// see test/landing.test.js's `SERVABLE_FONTS` guard, which this file must
// never fail: it is the regression test for the months-long bug where every
// generated page silently rendered in Arial because the fontFamily string
// matched nothing in the editor's catalogue.
const FONT_CATALOGUE = new Set([
  "'Rubik', sans-serif",
  "'Heebo', sans-serif",
  "'Assistant', sans-serif",
  "'Secular One', sans-serif",
  "'Frank Ruhl Libre', serif",
]);
const FALLBACK_DISPLAY = "'Assistant', sans-serif";
/**
 * Resolve a requested display font to one the editor can actually serve.
 * Returns `requested` verbatim only if it is a catalogue `cssRule` string,
 * otherwise falls back to Assistant.
 */
function resolveDisplayFont(requested) {
  return typeof requested === 'string' && FONT_CATALOGUE.has(requested) ? requested : FALLBACK_DISPLAY;
}

/**
 * Display type. `lineHeight` tightens as the size grows: makeText's 1.4 default
 * is right for a paragraph and slack enough at 38px and up to make a heading
 * look unset. A three-line Hebrew headline at 1.4 is the single most templated
 * thing on the old pages.
 *
 * `family` defaults to FALLBACK_DISPLAY so an un-wired call still renders a
 * catalogue face. `bold` defaults true, preserving every caller that predates
 * it; gold-night's headline is the one caller that needs it false (Secular
 * One is seeded at 400 only).
 */
const heading = (text, fontSize, color, align, family = FALLBACK_DISPLAY, bold = true) => {
  const px = parseInt(String(fontSize), 10) || 16;
  const lineHeight = px >= 44 ? '1.08' : px >= 28 ? '1.18' : '1.3';
  return makeText(text || '', { fontSize, color, align, bold, fontFamily: family, lineHeight });
};
const para = (text, color, align) =>
  makeText(text || '', { fontSize: '17px', color, align, fontFamily: BODY_FONT, lineHeight: '1.6' });
/**
 * Machine output: a time, a price, a count, a stat value.
 *
 * The mono stack is Latin only, so it is applied ONLY to strings with no
 * Hebrew or Arabic letters in them. A stat value is not reliably a bare number:
 * a live run produced "10 דקות", which in a Latin mono falls back per glyph and
 * renders as spaced-out, mismatched Hebrew. Guarded here rather than in the
 * prompt, because "keep the value numeric" is exactly the kind of instruction
 * this model family follows four times out of five.
 *
 * Mixed strings take the display face instead: at stat sizes it still reads as
 * a number, and every face in FONT_CATALOGUE has real Hebrew.
 */
const HAS_RTL_LETTERS = /[\u0590-\u05FF\u0600-\u06FF]/;

/**
 * Force a font family through a whole subtree.
 *
 * The richer catalog elements (accordion, form, countdown) come from stored
 * bodies in catalog.json, and those were authored with `fontFamily: "Arial"`
 * baked in. The type system cannot reach them any other way, so an FAQ built
 * from the accordion silently opted out of the page's typography while every
 * section around it opted in.
 */
function applyFont(node, family) {
  if (Array.isArray(node)) { node.forEach((n) => applyFont(n, family)); return node; }
  if (!node || typeof node !== 'object') return node;
  for (const k in node) {
    if (k === 'fontFamily' && typeof node[k] === 'string') node[k] = family;
    else if (node[k] && typeof node[k] === 'object') applyFont(node[k], family);
  }
  return node;
}
// `family` defaults to FALLBACK_DISPLAY, and every call site that renders
// words rather than digits passes the resolved font explicitly.
//
// It briefly defaulted to the file's original serif on the reasoning that the
// default "only surfaces on the rare mixed-content string". That was wrong:
// `headingBlock` renders EVERY section's eyebrow through `data()`, a Hebrew
// eyebrow has letters so it takes the non-mono branch, and the eyebrow call
// did not pass a family. So fifteen of fifteen patterns kept a serif eyebrow
// while their headings moved to the resolved font. Digits still take the mono
// branch regardless of what is passed here.
const data = (text, color, align, fontSize = '15px', family = FALLBACK_DISPLAY) => {
  const str = String(text || '');
  const mono = !HAS_RTL_LETTERS.test(str);
  return makeText(str, {
    fontSize,
    color,
    align,
    bold: !mono,
    fontFamily: mono ? DATA : family,
    lineHeight: '1.2',
  });
};
// `href` is optional: makeButton defaults it to '#', which is what every
// pattern except `articles` wants (a landing CTA scrolls or is wired later).
// Passing it through is what lets each article card carry its own destination.
const button = (text, background, color, href) => {
  // Square. A pill button beside a serif headline and a hairline rule is three
  // different opinions about shape on one page; the page holds one.
  const b = makeButton(text || '', { href, background, color, borderRadius: '0px', fontSize: '17px' });
  b.props.style.fontFamily = UI_FONT;
  return b;
};
const bullets = (items, color, iconColor) =>
  makeList(Array.isArray(items) ? items : [], { icon: 'check', iconColor, color, fontSize: '17px', fontFamily: BODY_FONT });
// Thumbnail for a card inside a row, as opposed to `photo` which is a
// full-width feature image. Shorter, and a smaller radius so it sits INSIDE
// the card's 22px corners instead of fighting them.
function cardPhoto(src) {
  const img = makeImage(src, { alt: '', width: 640, height: 360 });
  img.props.style = { ...img.props.style, width: '100%', height: '180px', borderRadius: '14px', objectFit: 'cover', marginBottom: '4px' };
  return img;
}
function photo(src, w, h) {
  const img = makeImage(src, { alt: '', width: w, height: h });
  img.props.style = { ...img.props.style, width: '100%', height: `${h}px`, borderRadius: '20px', objectFit: 'cover', boxShadow: '0 24px 50px -26px rgba(0,0,0,0.28)' };
  return img;
}

// ── structural helpers ───────────────────────────────────────────────────────
// Nullish children are dropped at every level rather than at each call site.
// `headingBlock` returns null for a section with neither eyebrow nor heading,
// and a null landing in a children array is not a rendering bug, it is a crash
// in every consumer that walks the tree.
const kept = (xs) => (Array.isArray(xs) ? xs : [xs]).filter(Boolean);
const col = (children, style = {}, justify = 'center') => ({ id: cid(), type: 'col', children: kept(children), props: { style, lg: 12, justify } });
const block = (cols, style = {}, justify = 'flex-start') => ({ id: cid(), type: 'block', children: kept(cols), props: { style: { width: `${CONTENT_WIDTH}px`, marginLeft: 'auto', marginRight: 'auto', paddingLeft: '28px', paddingRight: '28px', ...style }, justify } });
const section = (blocks, style = {}) => ({ id: cid(), type: 'section', layer: '1', children: kept(blocks), props: { opacity: 1, classList: [], style: { width: '100%', paddingTop: '80px', paddingBottom: '80px', ...style } } });

/**
 * The section head.
 *
 * This used to be a centered eyebrow over a centered heading, and fourteen of
 * the fifteen patterns opened with it. That single helper is why every section
 * of every generated page looked the same: the variants changed the block
 * UNDER the head and never the head itself, so the page's grammar was one
 * device repeated six times. Field report: "everything, the layout, the design,
 * the style."
 *
 * Now it is a rule. The eyebrow sits on it in the data face, the heading hangs
 * off it in the display face, both to the reading edge, and the head occupies a
 * column rather than the full width so the page has a shape instead of a
 * centre line. The empty half is deliberate.
 */
function headingBlock(eyebrow, title, opts = {}, palette) {
  const { onDark = false, titleSize = '38px', mb = '44px' } = opts;
  const { INK, LINE } = neutrals(palette);
  const S = palette.secondary || palette.primary || '#964462';
  const DISPLAY = resolveDisplayFont(palette && palette.displayFont);
  const ruleColor = onDark ? mix(INK, '#ffffff', 0.22) : INK;
  const hairline = onDark ? mix(INK, '#ffffff', 0.16) : LINE;
  const kids = [];

  if (eyebrow) {
    // The label and the hairline share a row: the label is measured by its own
    // width and the rule takes whatever is left, which is what makes the head
    // read as ruled rather than as a centered caption.
    kids.push(block([
      col([data(eyebrow, onDark ? mix(S, '#ffffff', 0.55) : S, 'right', '13px', DISPLAY)],
        { display: 'flex', flex: '0 0 auto' }, 'flex-start'),
      col([], { display: 'flex', flex: '1 1 auto', borderBottom: `1px solid ${hairline}`, marginBottom: '7px' }, 'flex-start'),
    ], {
      display: 'flex', gap: '14px', alignItems: 'center', direction: 'rtl',
      paddingLeft: '0px', paddingRight: '0px', width: '100%',
      paddingBottom: '14px', borderBottom: `1px solid ${ruleColor}`, marginBottom: '26px',
    }, 'flex-start'));
  }
  if (title) {
    kids.push(block([
      col([heading(title, titleSize, onDark ? '#ffffff' : INK, 'right', DISPLAY)],
        { display: 'flex', flex: '0 1 42ch', textAlign: 'right', direction: 'rtl' }, 'flex-start'),
    ], { display: 'flex', direction: 'rtl', paddingLeft: '0px', paddingRight: '0px', width: '100%' }, 'flex-start'));
  }
  if (!kids.length) return null;
  return block([col(kids, { display: 'flex', flexDirection: 'column', width: '100%' }, 'flex-start')], { marginBottom: mb }, 'flex-start');
}

/**
 * A ruled list: the replacement for a row of floating cards.
 *
 * Three shadowed boxes in a row is the most generic layout on the web, it wraps
 * badly at four items, and Hebrew body copy in a narrow card sets terribly.
 * A ruled row takes a marker, a title column and the prose, holds any number of
 * items, and reads as editorial rather than as a template.
 *
 * `marker` is optional and should carry information when present. Numbering a
 * set of parallel obstacles 01/02/03 is decoration; numbering the steps of a
 * process is not. Callers decide.
 */
function ruledRows(items, palette = {}, opts = {}) {
  const { numbered = false } = opts;
  const { INK, MUTED, LINE } = neutrals(palette);
  const S = palette.secondary || palette.primary || '#964462';
  const DISPLAY = resolveDisplayFont(palette && palette.displayFont);
  const rows = (Array.isArray(items) ? items : []).map((it, i) => {
    const kids = [];
    if (numbered) {
      kids.push(col([data(String(i + 1).padStart(2, '0'), S, 'right', '15px')],
        { display: 'flex', flex: '0 0 52px' }, 'flex-start'));
    }
    kids.push(col([heading(it.title || '', '19px', INK, 'right', DISPLAY)],
      { display: 'flex', flex: '0 0 250px' }, 'flex-start'));
    if (it.text) {
      kids.push(col([para(it.text, MUTED, 'right')],
        { display: 'flex', flex: '1 1 auto' }, 'flex-start'));
    }
    return col(kids, {
      display: 'flex', gap: '32px', direction: 'rtl', width: '100%',
      paddingTop: '26px', paddingBottom: '26px',
      ...(i === 0 ? {} : { borderTop: `1px solid ${LINE}` }),
    }, 'flex-start');
  });
  return block([col(rows, { display: 'flex', flexDirection: 'column', width: '100%' }, 'flex-start')], {}, 'flex-start');
}
/**
 * Message bubbles for the `conversation` variants.
 *
 * The device is not decoration for a messaging product, it is the product's own
 * material. It also solves a real constraint: tenants flagged is_haredi_sector
 * cannot use photographs of people at all, and the people-free stock photos the
 * gate substitutes are reliably irrelevant (a live run put a "Hey Siri" paper
 * macro in an About slot). A drawn conversation is always on-brand, never
 * returns a competitor's logo on a wall, and needs no image search.
 *
 * `from: 'business'` is the tenant speaking, and sits on the RIGHT in Hebrew,
 * which is flex-start under direction: rtl. Getting this backwards is the same
 * class of bug as the cardsRow one shipped in 2026-08.
 */
function threadBubbles(thread, palette = {}) {
  const { INK, LINE, MUTED } = neutrals(palette);
  const P = palette.primary || '#1b65a0';
  return (Array.isArray(thread) ? thread : []).slice(0, 6).map((m) => {
    const mine = (m && m.from) !== 'customer';
    const kids = [para(String((m && m.text) || ''), mine ? '#ffffff' : INK, 'right', palette)];
    if (m && m.time) kids.push(data(String(m.time), mine ? mix(P, '#ffffff', 0.78) : MUTED, 'left', '13px'));
    return col(kids, {
      display: 'flex', flexDirection: 'column', gap: '4px',
      background: mine ? P : '#ffffff', borderRadius: '22px',
      [mine ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: '6px',
      padding: '14px 18px', maxWidth: '86%', boxSizing: 'border-box',
      border: mine ? 'none' : `1px solid ${LINE}`,
      alignSelf: mine ? 'flex-start' : 'flex-end',
      direction: 'rtl', textAlign: 'right',
    }, 'flex-start');
  });
}

/**
 * A small round badge that overhangs the top corner of the card it sits in.
 * Negative margin rather than absolute positioning: the editor's renderer
 * honours margins on a col reliably and position/zIndex are not part of the
 * element contract.
 */
function badge(label, palette = {}) {
  const S = palette.secondary || palette.primary || '#964462';
  const el = makeText(label, { fontSize: '15px', color: '#ffffff', align: 'center', bold: true, fontFamily: DATA });
  el.props.style = {
    ...el.props.style, background: S, width: '42px', height: '42px', lineHeight: '42px',
    borderRadius: '999px', marginTop: '-40px', marginBottom: '6px',
    boxShadow: '0 10px 22px -10px rgba(0,0,0,0.45)',
  };
  return el;
}

// Prose sits in a measured column at the reading edge, not centered. Centered
// body copy is unreadable past two lines and it was the second half of the
// centered-eyebrow-centered-heading-centered-paragraph grammar that made every
// section look the same.
const centeredProse = (kids) => block([col(kids, {
  display: 'flex', flexDirection: 'column', gap: '14px',
  alignItems: 'flex-start', textAlign: 'right', direction: 'rtl', flex: '0 1 62ch',
}, 'flex-start')], { display: 'flex', direction: 'rtl' }, 'flex-start');

// card style for multi-item rows
//
// `direction: rtl` is load-bearing, not decoration. These sections are
// Hebrew-first (textAlign:'right' here, 'שם מלא' in leadform, 'קראו עוד' in
// articles), but `textAlign` only moves the TEXT. Without `direction` the flex
// row still lays out left-to-right, so item 1 renders leftmost when a Hebrew
// reader expects it rightmost, and any child narrower than the card (the
// buttons) is pinned to the LTR start edge, i.e. the wrong side. Field report
// 260814: "the design is ugly, we are in Hebrew and it's LTR".
// A card is a bordered panel, not a floating one. Every card on the old pages
// carried a 40px drop shadow and a 22px radius, and with the gradient behind
// them that combination is the generated look in one line of CSS. Border does
// the separating now.
const card = (extra = {}, palette = {}) => ({
  display: 'flex', flexDirection: 'column', gap: '10px', background: '#ffffff', borderRadius: '4px',
  padding: '26px 24px', border: `1px solid ${neutrals(palette).LINE}`,
  boxSizing: 'border-box', direction: 'rtl', textAlign: 'right', flex: '1 1 240px', margin: '10px', ...extra,
});
// Set on the ROW as well as the card: the row-level value orders the cards
// (first item on the right), the card-level value aligns each card's contents.
const cardsRow = (cards, palette = {}) => block(cards.map((kids) => col(kids, card({}, palette), 'flex-start')), { display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', alignItems: 'stretch', direction: 'rtl' }, 'center');

/**
 * @param {string} pattern
 * @param {object} copy  LLM-authored copy for this section
 * @param {object} palette  { primary, secondary, accent, text, background }
 * @returns {{ section: object }}
 */
function composeLandingSection(pattern, copy = {}, palette = {}, opts = {}) {
  const { INK, BODY, MUTED, LINE, LIGHT, FIELD, FIELD_LINE } = neutrals(palette);
  // `variant` is resolved by the CALLER via resolveLandingVariant, which
  // guarantees it is renderable. An unrecognised value still falls through to
  // the pattern's first branch here rather than throwing, because this function
  // is called inside a try/catch that skips the whole section on error, and
  // losing a section to a typo is a worse outcome than rendering the default.
  const variant = typeof opts.variant === 'string' ? opts.variant : null;
  const P = palette.primary || '#6328A7';
  const S = palette.secondary || palette.accent || P;
  // GRAD was a 135deg two-colour diagonal behind the hero and every CTA band.
  // It is the single most dated thing a generated page can carry and it was on
  // four sections at once. Kept as a name so nothing downstream breaks, but it
  // resolves to the flat field: one ground, no ramp, no diagonal.
  const GRAD = FIELD;
  // Business-context-driven display font: nothing populates palette.displayFont
  // today, so this resolves to FALLBACK_DISPLAY (Assistant) everywhere until a
  // future phase adds the field.
  const DISPLAY = resolveDisplayFont(palette.displayFont);
  const H = (t, fs, c, al) => heading(t, fs, c, al, DISPLAY);
  const T = (t, c, al) => para(t, c, al, palette);
  const D = (t, c, al, fs) => data(t, c, al, fs, DISPLAY);
  const hb = (eyebrow, title, opts) => headingBlock(eyebrow, title, opts, palette);

  switch (pattern) {
    // ── §1 HERO ──────────────────────────────────────────────────────────────
    //
    // Three variants. `centered` is the original and stays the default: it is
    // the one that works with nothing but a headline. The other two need real
    // material and look worse than centered without it, which is why
    // resolveLandingVariant checks their `needs` before either is chosen.
    case 'hero': {
      // The eyebrow and subheading tints used to be literal '#F6D9EE' and
      // '#F3E9FB', pink on every brand. Derived from the gradient now.
      // On the ink field the eyebrow is data-face and the lede is muted. The
      // headline stays ONE colour: the accent is spent on numerals elsewhere,
      // and a two-tone headline plus a serif plus a mono row is one idea too
      // many for the same screen.
      const onGrad = mix(P, '#ffffff', 0.62);
      const onGradSoft = mix(P, '#ffffff', 0.72);
      const heroCopy = (align) => [
        copy.eyebrow ? D(copy.eyebrow, onGrad, align, '13px') : null,
        H(copy.heading, align === 'center' ? '58px' : '54px', '#ffffff', align),
        copy.subheading ? T(copy.subheading, onGradSoft, align) : null,
        copy.cta ? button(copy.cta, '#ffffff', FIELD) : null,
      ].filter(Boolean);

      // gold-night and coral-cut share one derived theme, computed once here
      // rather than per branch: both variants read from it, and cinema-block
      // (below) reuses the same local.
      const theme = deriveTheme(palette.primary, palette.secondary);

      // ── GOLD NIGHT ───────────────────────────────────────────────────────
      // Deep ink ground, one gold accent, numerals on their own ruled row
      // under the headline. Secular One is seeded at 400 only, so the
      // headline and the numeral values must resolve bold:false explicitly.
      if (variant === 'gold-night') {
        const cells = (Array.isArray(copy.stats) ? copy.stats : []).slice(0, 4).map((st, i) => col([
          makeText(String((st && st.value) || ''), { fontSize: '42px', color: '#ffffff', align: 'right', bold: false, fontFamily: "'Secular One', sans-serif", lineHeight: '1' }),
          makeText(String((st && st.label) || ''), { fontSize: '14px', color: theme.MUTED, align: 'right', fontFamily: BODY_FONT, lineHeight: '1.3' }),
        ], {
          display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start',
          textAlign: 'right', direction: 'rtl', flex: '1 1 160px', boxSizing: 'border-box',
          paddingTop: '26px', paddingBottom: '8px', paddingRight: '26px', paddingLeft: '26px',
          ...(i === 0 ? {} : { borderRight: `1px solid ${theme.LINE}` }),
        }, 'flex-start'));

        const goldCopy = [
          copy.eyebrow ? makeText(copy.eyebrow, { fontSize: '14px', color: theme.ON_DARK, align: 'right', fontFamily: BODY_FONT, bold: false, lineHeight: '1' }) : null,
          heading(copy.heading, '80px', '#ffffff', 'right', "'Secular One', sans-serif", false),
          copy.subheading ? makeText(copy.subheading, { fontSize: '20px', color: theme.MUTED, align: 'right', fontFamily: BODY_FONT, lineHeight: '1.65' }) : null,
          copy.cta ? button(copy.cta, theme.ON_DARK, theme.FIELD) : null,
        ].filter(Boolean);

        const goldBlocks = [
          block([col(goldCopy, { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', textAlign: 'right', direction: 'rtl' }, 'flex-start')], { direction: 'rtl' }, 'flex-start'),
        ];
        if (cells.length) {
          goldBlocks.push(block(cells, { display: 'flex', flexWrap: 'wrap', direction: 'rtl', marginTop: '62px', borderTop: `1px solid ${theme.ON_DARK}` }, 'flex-start'));
        }
        return { section: section(goldBlocks, { background: theme.FIELD, paddingTop: '92px', paddingBottom: '84px' }) };
      }

      // ── CORAL CUT ────────────────────────────────────────────────────────
      // Copy on one side, three numbers in their own accent-coloured field on
      // the other. One block, width 100%, holding two full-height cols: the
      // editor's BlockElement forces `margin: 0 auto` on every block, so two
      // adjacent blocks would always be re-centred by the driver regardless
      // of what width or margin page-kit sets on them. A single full-width
      // block makes that forced centring a no-op.
      if (variant === 'coral-cut' && Array.isArray(copy.stats) && copy.stats.length) {
        const coralCopy = [
          copy.eyebrow ? makeText(copy.eyebrow, { fontSize: '13px', color: theme.ON_DARK, align: 'right', fontFamily: BODY_FONT, bold: true, lineHeight: '1' }) : null,
          heading(copy.heading, '78px', '#ffffff', 'right', "'Assistant', sans-serif", true),
          copy.subheading ? makeText(copy.subheading, { fontSize: '19px', color: theme.MUTED, align: 'right', fontFamily: BODY_FONT, lineHeight: '1.7' }) : null,
          copy.cta ? button(copy.cta, theme.ON_DARK, theme.onAccentDark) : null,
        ].filter(Boolean);

        const stats = copy.stats.slice(0, 3);
        const statRows = stats.map((st, i) => col([
          makeText(String((st && st.value) || ''), { fontSize: '44px', color: theme.onAccentDark, align: 'right', bold: true, fontFamily: "'Assistant', sans-serif", lineHeight: '1' }),
          makeText(String((st && st.label) || ''), { fontSize: '15px', color: theme.onAccentDark, align: 'right', fontFamily: BODY_FONT, lineHeight: '1.5' }),
        ], {
          display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', boxSizing: 'border-box',
          paddingTop: i === 0 ? '0px' : '26px',
          paddingBottom: i === stats.length - 1 ? '0px' : '26px',
          ...(i === stats.length - 1 ? {} : { borderBottom: `1px solid ${mix(theme.ON_DARK, '#ffffff', 0.18)}` }),
        }, 'flex-start'));

        return { section: section([
          block([
            col(coralCopy, {
              display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start',
              textAlign: 'right', direction: 'rtl', flex: '1 1 720px', background: theme.FIELD,
              boxSizing: 'border-box', paddingTop: '84px', paddingBottom: '88px', paddingLeft: '56px', paddingRight: '56px',
            }, 'flex-start'),
            col(statRows, {
              display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: '0 1 380px', minWidth: '300px',
              background: theme.ON_DARK, boxSizing: 'border-box', paddingTop: '56px', paddingBottom: '56px', paddingLeft: '44px', paddingRight: '44px',
            }, 'center'),
          ], {
            display: 'flex', flexWrap: 'wrap', direction: 'rtl',
            width: '100%', marginLeft: '0px', marginRight: '0px', paddingLeft: '0px', paddingRight: '0px',
          }, 'flex-start'),
        ], { paddingTop: '0px', paddingBottom: '0px' }) };
      }

      // ── CINEMA BLOCK ─────────────────────────────────────────────────────
      // Copy beside a tall narrow photograph. The `filter: grayscale(...)`
      // treatment the sketch specifies on the image was left un-verified: the
      // editor's `image` element resolves through a config-driven plugin
      // scheme whose source did not turn up in a repo-wide grep of the
      // frontend, and standing up the live editor to check is out of scope
      // for this task. The crop shape carries the real value here (per the
      // sketch's own README, "every stock photo tested failed the band, none
      // failed the column"), so the variant ships without the monochrome
      // finish rather than being blocked or dropped.
      if (variant === 'cinema-block' && copy.image) {
        const cinemaCopy = [
          copy.eyebrow ? makeText(copy.eyebrow, { fontSize: '13px', color: theme.ON_DARK, align: 'right', fontFamily: BODY_FONT, bold: false, lineHeight: '1' }) : null,
          heading(copy.heading, '68px', '#ffffff', 'right', "'Rubik', sans-serif", true),
          copy.subheading ? makeText(copy.subheading, { fontSize: '19px', color: theme.MUTED, align: 'right', fontFamily: BODY_FONT, lineHeight: '1.7' }) : null,
          copy.cta ? button(copy.cta, theme.ON_DARK, theme.FIELD) : null,
        ].filter(Boolean);

        // photo() defaults to a fixed height, rounded corners and a drop
        // shadow; overridden here to fill the column edge-to-edge, matching
        // both the sketch and the file's own square-corner, no-shadow rules.
        const cinemaImg = photo(copy.image, 440, 480);
        cinemaImg.props.style = { ...cinemaImg.props.style, height: '100%', minHeight: '480px', borderRadius: '0px', boxShadow: 'none' };

        return { section: section([
          block([
            col(cinemaCopy, { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', textAlign: 'right', direction: 'rtl', flex: '1 1 700px' }, 'flex-start'),
            col([cinemaImg], { display: 'flex', flex: '0 1 440px', minWidth: '260px', background: theme.FIELD }, 'center'),
          ], { display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', direction: 'rtl' }, 'flex-start'),
        ], { background: theme.FIELD, paddingTop: '84px', paddingBottom: '84px' }) };
      }

      if (variant === 'asymmetric' && copy.image) {
        return { section: section([
          block([
            col(heroCopy('right'), { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', textAlign: 'right', flex: '1 1 380px', margin: '12px' }, 'flex-start'),
            col([photo(copy.image, 620, 420)], { display: 'flex', flex: '1 1 380px', margin: '12px' }, 'center'),
          ], { display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', direction: 'rtl' }, 'flex-start'),
        ], { background: FIELD, paddingTop: '84px', paddingBottom: '76px' }) };
      }

      if (variant === 'conversation' && Array.isArray(copy.thread) && copy.thread.length) {
        return { section: section([
          block([
            col(heroCopy('right'), { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', textAlign: 'right', flex: '1 1 380px', margin: '12px' }, 'flex-start'),
            col(threadBubbles(copy.thread, palette), { display: 'flex', flexDirection: 'column', gap: '14px', flex: '1 1 340px', margin: '12px', direction: 'rtl' }, 'flex-start'),
          ], { display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', direction: 'rtl' }, 'flex-start'),
        ], { background: FIELD, paddingTop: '84px', paddingBottom: '76px' }) };
      }

      return { section: section([
        block([col(heroCopy('center'), { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center' })], {}, 'center'),
      ], { background: FIELD, paddingTop: '96px', paddingBottom: '96px' }) };
    }

    // ── §2 PROBLEM / identification (editorial) ────────────────────────────────
    case 'problem': {
      // continuous, panels and lift share one derived theme, computed once
      // here rather than per branch (mirrors how the hero case above shares
      // its own `theme` local across gold-night/coral-cut/cinema-block).
      const theme = deriveTheme(palette.primary, palette.secondary);

      // A bespoke head for continuous/panels/lift: an eyebrow line directly
      // above an H, no ruled top bar. `headingBlock`'s full-width ruled line
      // above the heading is section ONE's own device now (gold-night above
      // reuses it); giving section two the same head over the same body
      // helpers is exactly the "one device repeated" grammar the
      // 2026-09-02 design review rejected. Not extracted to a top-level
      // helper: only these three branches call it.
      // Leaves, not one col() per line: block() carries the page's own
      // 1240px content-width + auto margins, exactly right for a TOP-LEVEL
      // block but wrong one level deeper, and even a bare col() per line
      // turned out to fight this flex-column parent in the real renderer --
      // measured with two lines it degrades to "packed side by side, happens
      // to still fit," and with three lines (solutionHead below) that same
      // packing overflowed clean off the left edge of the page. The one
      // shape proven to survive contact with the real render-site service is
      // the hero's own goldCopy/coralCopy/cinemaCopy: a flat array of LEAF
      // nodes (no per-line col wrapper) inside exactly one col, with
      // `alignItems` set explicitly in that col's OWN style -- col()'s third
      // argument (`justify`) does not map to align-items, it is a separate
      // prop the driver reads for something else, and leaving align-items
      // unset is what let the renderer fall back to its own default instead
      // of actually stacking the lines. This head copies that shape exactly.
      const problemHead = (eyebrowColor, headingColor) => {
        const kids = [
          copy.eyebrow ? makeText(copy.eyebrow, {
            fontSize: '14px', color: eyebrowColor, align: 'right',
            fontFamily: BODY_FONT, bold: false, lineHeight: '1',
          }) : null,
          copy.heading ? H(copy.heading, '44px', headingColor, 'right') : null,
        ].filter(Boolean);
        if (!kids.length) return null;
        return block([col(kids, {
          display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start',
          width: '100%', textAlign: 'right', direction: 'rtl',
        }, 'flex-start')], { marginBottom: '54px' }, 'flex-start');
      };

      // ── CONTINUOUS ─────────────────────────────────────────────────────
      // Stays on the hero's own dark ground, no colour break between
      // sections. Ruled rows, an ordinal marker in the accent colour, up to
      // 4 obstacles. The marker is never bold (Secular One is seeded 400
      // only) and never white/bold: that combination is gold-night's own
      // numeral device, a business STAT rather than a list position, and the
      // two must stay visually distinct even when both land on one page.
      if (variant === 'continuous' && Array.isArray(copy.items) && copy.items.length) {
        const headBlock = problemHead(theme.ON_DARK, '#ffffff');
        const rows = copy.items.slice(0, 4).map((it, i) => col([
          col([makeText(String(i + 1).padStart(2, '0'), {
            fontSize: '54px', color: theme.ON_DARK, align: 'right', bold: false,
            fontFamily: "'Secular One', sans-serif", lineHeight: '1',
          })], { display: 'flex', flex: '0 0 86px' }, 'flex-start'),
          col([H(it.title, '22px', '#ffffff', 'right')], { display: 'flex', flex: '0 0 250px' }, 'flex-start'),
          col([para(it.text, theme.MUTED, 'right')], { display: 'flex', flex: '1 1 320px' }, 'flex-start'),
        ], {
          display: 'flex', gap: '38px', direction: 'rtl', width: '100%',
          paddingTop: '34px', paddingBottom: '34px',
          ...(i === 0 ? {} : { borderTop: `1px solid ${theme.LINE}` }),
        }, 'flex-start'));
        const rowsBlock = block(rows, { display: 'flex', flexDirection: 'column', width: '100%' }, 'flex-start');
        return { section: section([headBlock, rowsBlock], { background: theme.FIELD }) };
      }

      // ── PANELS ─────────────────────────────────────────────────────────
      // Still dark, but each obstacle owns a solid block one shade off the
      // ground (theme.PANEL, already derived in landingTheme.js for exactly
      // this), square and flush rather than floating on a shadow.
      if (variant === 'panels' && Array.isArray(copy.items) && copy.items.length) {
        const headBlock = problemHead(theme.ON_DARK, '#ffffff');
        const panelCols = copy.items.slice(0, 4).map((it, i) => {
          const numeral = makeText(String(i + 1).padStart(2, '0'), {
            fontSize: '64px', color: theme.ON_DARK, align: 'right', bold: false,
            fontFamily: "'Secular One', sans-serif", lineHeight: '1',
          });
          numeral.props.style = { ...numeral.props.style, marginBottom: '26px' };
          const title = H(it.title, '22px', '#ffffff', 'right');
          title.props.style = { ...title.props.style, marginBottom: '14px' };
          // Missing display:flex/flexDirection:column here left the col on
          // the renderer's own default (a MUI Grid row), which put the
          // numeral, title and body on one line instead of stacked -- the
          // same "col() needs its own explicit stack direction" rule the
          // established card() helper already follows for cardsRow.
          return col([numeral, title, para(it.text, theme.MUTED, 'right')], {
            display: 'flex', flexDirection: 'column',
            background: theme.PANEL, padding: '38px 32px 42px', flex: '1 1 300px', boxSizing: 'border-box',
          }, 'flex-start');
        });
        const panelsBlock = block(panelCols, { display: 'flex', flexWrap: 'wrap', gap: '2px', direction: 'rtl' }, 'flex-start');
        return { section: section([headBlock, panelsBlock], { background: theme.FIELD }) };
      }

      // ── LIFT ───────────────────────────────────────────────────────────
      // The one problem variant that comes up to a pale ground. Takes the
      // LIGHT bundle exclusively (theme.LIFT / theme.ON_LIGHT /
      // theme.LIFT_INK / theme.LIFT_LINE / theme.LIFT_BODY), never the dark
      // FIELD/ON_DARK pair continuous and panels just used: the dark-ground
      // accent measures 1.8:1 to 2.6:1 on this ground, unreadable.
      if (variant === 'lift' && Array.isArray(copy.items) && copy.items.length) {
        const headBlock = problemHead(theme.ON_LIGHT, theme.LIFT_INK);
        const rows = copy.items.slice(0, 4).map((it, i) => col([
          col([makeText(String(i + 1).padStart(2, '0'), {
            fontSize: '54px', color: theme.ON_LIGHT, align: 'right', bold: false,
            fontFamily: "'Secular One', sans-serif", lineHeight: '1',
          })], { display: 'flex', flex: '0 0 86px' }, 'flex-start'),
          col([H(it.title, '22px', theme.LIFT_INK, 'right')], { display: 'flex', flex: '0 0 250px' }, 'flex-start'),
          col([para(it.text, theme.LIFT_BODY, 'right')], { display: 'flex', flex: '1 1 320px' }, 'flex-start'),
        ], {
          display: 'flex', gap: '38px', direction: 'rtl', width: '100%',
          paddingTop: '34px', paddingBottom: '34px',
          ...(i === 0 ? {} : { borderTop: `1px solid ${theme.LIFT_LINE}` }),
        }, 'flex-start'));
        const rowsBlock = block(rows, { display: 'flex', flexDirection: 'column', width: '100%' }, 'flex-start');
        return { section: section([headBlock, rowsBlock], { background: theme.LIFT }) };
      }

      if (variant === 'badge-cards' && Array.isArray(copy.items) && copy.items.length) {
        // A numbered ruled list, not a row of cards. The number is real
        // information here: these are the obstacles in the order the reader
        // hits them. Where a set is genuinely parallel rather than sequential,
        // pass numbered:false and the markers disappear.
        return { section: section([
          hb(copy.eyebrow, copy.heading),
          ruledRows(copy.items.slice(0, 5), palette, { numbered: true }),
        ], { background: '#ffffff' }) };
      }
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        centeredProse([T(copy.paragraph, BODY, 'right')]),
      ], { background: LIGHT }) };
    }

    // ── §3 TARGET AUDIENCE (who it is for) ─────────────────────────────────────
    // Each audience point is its own card col inside a flex-wrap block, so the
    // section reads as a multi-column grid instead of one stacked bullet list.
    case 'audience':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        copy.paragraph ? centeredProse([T(copy.paragraph, MUTED, 'right')]) : null,
        (copy.bullets && copy.bullets.length)
          ? ruledRows(copy.bullets.map((t) => ({ title: t })), palette)
          : null,
      ].filter(Boolean), { background: '#ffffff' }) };

    // ── §4 SOLUTION (paragraph + bullets + product image) ──────────────────────
    case 'solution': {
      // tiles, stack and (from Task 2) conversation share one derived theme
      // and one ground bundle, mirroring how problem's three dark/light
      // variants share `theme` above. bullets-image, the original default,
      // needs neither: it has no ground concept and stays on '#ffffff'.
      const theme = deriveTheme(palette.primary, palette.secondary);
      // A ground is a bundle: background, ink, body, line, and the accent
      // that belongs to THAT ground, so no variant can accidentally put the
      // dark accent on the light background (the failure sketch 005
      // measured at 1.8:1). Mirrors sketch 007's own `grounds` object.
      const groundOf = (which) => which === 'light'
        ? { BG: theme.LIFT, INK: theme.LIFT_INK, BODY: theme.LIFT_BODY, LINE: theme.LIFT_LINE, ACC: theme.ON_LIGHT, ON_ACC: theme.onAccentLight, PANEL: '#ffffff' }
        : { BG: theme.FIELD, INK: '#ffffff', BODY: theme.MUTED, LINE: theme.LINE, ACC: theme.ON_DARK, ON_ACC: theme.onAccentDark, PANEL: theme.PANEL };
      const ground = opts.ground === 'light' ? 'light' : 'dark';
      const g = groundOf(ground);

      // A bespoke head for tiles/stack/conversation, mirroring problemHead:
      // eyebrow, heading, and (new relative to problemHead) an optional
      // paragraph line, all ground-aware. Not extracted to a top-level
      // helper, same reasoning as problemHead: only these three branches
      // call it.
      // Same fix as problemHead above, and for the same reason: leaves
      // directly in one col, alignItems set explicitly on that col's own
      // style, no per-line col() wrapper. See the comment there.
      const solutionHead = () => {
        const kids = [
          copy.eyebrow ? makeText(copy.eyebrow, {
            fontSize: '13px', color: g.ACC, align: 'right',
            fontFamily: BODY_FONT, bold: false, lineHeight: '1',
          }) : null,
          copy.heading ? H(copy.heading, '42px', g.INK, 'right') : null,
          copy.paragraph ? T(copy.paragraph, g.BODY, 'right') : null,
        ].filter(Boolean);
        if (!kids.length) return null;
        return block([col(kids, {
          display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start',
          width: '100%', textAlign: 'right', direction: 'rtl',
        }, 'flex-start')], { marginBottom: '52px' }, 'flex-start');
      };

      // ── TILES ────────────────────────────────────────────────────────
      // The capabilities as a tight grid of solid cells, one seam between
      // them. Dense and rich, and structurally nothing like problem: no
      // numerals, no hairline rows, no reading column.
      if (variant === 'tiles' && Array.isArray(copy.items) && copy.items.length) {
        const headBlock = solutionHead();
        const cells = copy.items.slice(0, 6).map((it) => {
          const name = H(it.title, '26px', g.ACC, 'right');
          name.props.style = { ...name.props.style, marginBottom: '12px' };
          // Same explicit stack direction as panels' cell col: without it
          // the cell is on the renderer's own row default.
          return col([name, T(it.text, g.BODY, 'right')], {
            display: 'flex', flexDirection: 'column',
            background: g.PANEL, padding: '34px 30px 38px', flex: '1 1 330px', boxSizing: 'border-box',
          }, 'flex-start');
        });
        const cellsBlock = block(cells, { display: 'flex', flexWrap: 'wrap', gap: '2px', direction: 'rtl' }, 'flex-start');
        return { section: section([headBlock, cellsBlock], { background: g.BG }) };
      }

      // ── STACK ────────────────────────────────────────────────────────
      // The capabilities set as one continuous typographic list at display
      // size, no cells and no rules. The section IS the list.
      if (variant === 'stack' && Array.isArray(copy.items) && copy.items.length) {
        const headBlock = solutionHead();
        const rows = copy.items.slice(0, 6).map((it) => col([
          col([H(it.title, '40px', g.ACC, 'right')], { display: 'flex', flex: '0 0 auto' }, 'flex-start'),
          col([T(it.text, g.BODY, 'right')], { display: 'flex', flex: '1 1 300px' }, 'flex-start'),
        ], { display: 'flex', gap: '20px', direction: 'rtl', alignItems: 'baseline', flexWrap: 'wrap', width: '100%' }, 'flex-start'));
        const stackBlock = block(rows, { display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }, 'flex-start');
        return { section: section([headBlock, stackBlock], { background: g.BG }) };
      }

      // ── CONVERSATION ─────────────────────────────────────────────────
      // Restyled onto the ground-bundle system: the same idea (each
      // capability shown beside a real message thread) at the fidelity the
      // rest of this case now uses, not a second concept under the same
      // name. Needs items AND thread now: the sketch shows the capability
      // list beside the thread, not the thread alone.
      if (variant === 'conversation' && Array.isArray(copy.items) && copy.items.length && Array.isArray(copy.thread) && copy.thread.length) {
        const headBlock = solutionHead();
        const capRows = copy.items.slice(0, 4).map((it, i) => col([
          col([H(it.title, '17px', g.INK, 'right')], { display: 'flex', flex: '0 0 170px' }, 'flex-start'),
          col([T(it.text, g.BODY, 'right')], { display: 'flex', flex: '1 1 auto' }, 'flex-start'),
        ], {
          display: 'flex', gap: '14px', direction: 'rtl', width: '100%',
          paddingTop: '15px', paddingBottom: '15px',
          ...(i === 0 ? {} : { borderTop: `1px solid ${g.LINE}` }),
        }, 'flex-start'));
        // block(), not col(): a col() asked to stack multiple col()-shaped
        // children packs them side by side instead in the real renderer (the
        // same failure the head just had). block() with flexDirection:column
        // is the one mechanism proven reliable here (rowsBlock, panelsBlock,
        // stackBlock, cellsBlock) -- but ALL of those are TOP-LEVEL blocks,
        // and block() turns out to size off `width` only, never off `flex`
        // or a percentage `width` when nested beside a sibling (both were
        // measured still rendering full width). So this no longer tries to
        // put the list beside the thread in one row: it is list, then
        // thread, as two of its own top-level blocks -- a real
        // simplification from the sketch, but the sketch's version does not
        // survive the real renderer at all, and this does.
        const capsBlock = block(capRows, { display: 'flex', flexDirection: 'column', width: '100%', direction: 'rtl' }, 'flex-start');

        // On the light ground, ON_LIGHT renders a dark brown "mine" bubble:
        // legible but the least lovely thing in the sketch. A bubble is a
        // surface, not a mark on a surface, so on light ground it takes the
        // brand primary directly instead, with readableTextOn choosing the
        // bubble text so a pastel primary still stays readable. Dark ground
        // has no equivalent complaint and keeps the derived accent.
        const dim = (fg, bg) => mix(fg, bg, 0.4);
        const bubbles = copy.thread.slice(0, 6).map((m) => {
          const mine = (m && m.from) !== 'customer';
          const bg = mine ? (ground === 'light' ? P : g.ACC) : g.PANEL;
          const fg = mine ? (ground === 'light' ? readableTextOn(P) : g.ON_ACC) : g.INK;
          const kids = [T(String((m && m.text) || ''), fg, 'right')];
          if (m && m.time) kids.push(data(String(m.time), dim(fg, bg), 'left', '13px'));
          // KNOWN LIMITATION, not fixed here: a bubble should be a narrow
          // box (maxWidth ~70%) sitting to one side, like a real chat
          // thread. Measured against the real render-site service, every
          // width-control tried -- `width`, `maxWidth`, `alignItems` on this
          // col, `alignItems` on the parent block, and a two-col wrapper
          // pushing an inner fixed-width box with margin -- still rendered
          // full row width. The driver appears to force column-stacked
          // col()/block() children to 100% width unconditionally; this is
          // not something page-kit's own props can override, and is a
          // frontend-driver question, not a page-kit one. Left correct in
          // every other respect (order, color, corner radii, alignment
          // marker) rather than papered over with a technique already
          // proven not to survive contact with the real renderer.
          return col(kids, {
            display: 'flex', flexDirection: 'column', gap: '6px', background: bg,
            // Chat-bubble corner radii are a deliberate, sketch-exact exception
            // to the page's square-corner rule: hero.conversation's own
            // threadBubbles already ships rounded bubbles today. Messaging
            // bubbles are the one established genre exception on this page.
            borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            padding: '14px 17px', maxWidth: '70%', boxSizing: 'border-box',
            alignSelf: mine ? 'flex-start' : 'flex-end', direction: 'rtl', textAlign: 'right',
          }, 'flex-start');
        });
        // Same fix as capsBlock above: its own top-level block, not a col
        // sharing a row with capsBlock. `alignItems: 'flex-start'` is set
        // explicitly too, though measured to make no visible difference on
        // its own -- see the KNOWN LIMITATION note on each bubble above.
        const bubblesBlock = block(bubbles, {
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: '10px', direction: 'rtl', marginTop: '36px',
        }, 'flex-start');

        return { section: section([headBlock, capsBlock, bubblesBlock], { background: g.BG }) };
      }
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        copy.paragraph ? centeredProse([T(copy.paragraph, MUTED, 'right')]) : null,
        block([
          col([bullets(copy.bullets, BODY, S)], { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: '1 1 320px', margin: '12px' }, 'flex-start'),
          copy.image ? col([photo(copy.image, 720, 360)], { display: 'flex', flex: '1 1 320px', margin: '12px' }, 'center') : null,
        ].filter(Boolean), { display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }, 'flex-start'),
      ].filter(Boolean), { background: '#ffffff' }) };
    }

    // ── §5 / §8 TESTIMONIALS (quote cards) ─────────────────────────────────────
    case 'testimonials':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        cardsRow((copy.items || []).map((it) => [
          T(`"${it.quote || ''}"`, BODY, 'right'),
          H(it.name || '', '17px', INK, 'right'),
          it.role ? T(it.role, MUTED, 'right') : null,
        ].filter(Boolean))),
      ], { background: LIGHT }) };

    // ── §6 WHY BUY (persuasive paragraph) ──────────────────────────────────────
    case 'whyBuy':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        centeredProse([T(copy.paragraph, BODY, 'right')]),
      ], { background: '#ffffff' }) };

    // ── §7 OFFER (short bullets) ───────────────────────────────────────────────
    // "What you get" points as separate card cols (multi-column grid) rather
    // than a single stacked bullet list.
    case 'offer':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        copy.paragraph ? centeredProse([T(copy.paragraph, MUTED, 'right')]) : null,
        (copy.bullets && copy.bullets.length)
          ? ruledRows(copy.bullets.map((t) => ({ title: t })), palette)
          : null,
      ].filter(Boolean), { background: LIGHT }) };

    // ── §9 BONUSES ─────────────────────────────────────────────────────────────
    case 'bonuses':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        cardsRow((copy.items || []).map((it) => [
          H(it.title || '', '20px', INK, 'right'),
          it.text ? T(it.text, BODY, 'right') : null,
        ].filter(Boolean))),
      ], { background: '#ffffff' }) };

    // ── ARTICLES (linked cards: image + headline + excerpt + its OWN button) ───
    // The only pattern where each ITEM carries its own destination. Every other
    // landing pattern has at most one `cta` for the whole section, which is why
    // "two articles from my blog, each linked" used to come back as a bullet
    // list: `bonuses` was the closest fit and it holds title + text only.
    //
    // Mirrors the newsletter catalog's `article-cards`. Per-card image and url
    // are both OPTIONAL and degrade independently -- a card with no image is
    // still a linked card, and a card with no url is still a readable card.
    // That matters because the source article often has one and not the other.
    case 'articles': {
      // One shared label across the row ("קראו עוד"), each card its own href.
      // Same idiom as leadform's `copy.submit || 'שליחה'`.
      const label = copy.cta || 'קראו עוד';
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        cardsRow((copy.items || []).map((it) => {
          const cta = it.url ? button(label, INK, '#ffffff', it.url) : null;
          if (cta) {
            cta.props.style.fontSize = '16px';
            // Cards in a row stretch to equal height (cardsRow sets
            // alignItems:stretch), so pushing the button down keeps every
            // button on the same line no matter how long each excerpt runs.
            cta.props.style.marginTop = 'auto';
          }
          return [
            it.image ? cardPhoto(it.image) : null,
            H(it.title || '', '20px', INK, 'right'),
            it.text ? T(it.text, BODY, 'right') : null,
            cta,
          ].filter(Boolean);
        })),
      ], { background: '#ffffff' }) };
    }

    // ── §10 PRICING (offer card: options + special price + urgency) ────────────
    case 'pricing':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        // The price, what is included, and the action, side by side above a
        // rule. This used to be one centred card with a 60px shadow floating in
        // dead space, which is what a three-column tier layout holding a single
        // tier looks like once the other two are gone.
        block([
          col([
            data(copy.price, INK, 'right', '66px'),
            copy.planName ? T(copy.planName, MUTED, 'right') : null,
            copy.regularNote ? T(copy.regularNote, MUTED, 'right') : null,
          ].filter(Boolean), { display: 'flex', flexDirection: 'column', gap: '8px', flex: '0 0 280px', direction: 'rtl', textAlign: 'right' }, 'flex-start'),
          col([
            bullets(copy.features, BODY, S),
            copy.urgency ? T(copy.urgency, S, 'right') : null,
          ].filter(Boolean), { display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 auto', direction: 'rtl', textAlign: 'right' }, 'flex-start'),
          ...(copy.cta ? [col([button(copy.cta, INK, '#ffffff')], { display: 'flex', flex: '0 0 auto' }, 'flex-start')] : []),
        ], {
          display: 'flex', gap: '48px', direction: 'rtl', alignItems: 'flex-start',
          borderTop: `1px solid ${INK}`, paddingTop: '40px',
        }, 'flex-start'),
      ], { background: LIGHT }) };

    // ── STAT BAR (new) ─────────────────────────────────────────────────────────
    //
    // Big numbers with a short label. Deliberately NOT a place for invented
    // performance claims: studio's grounding gate exists because this model
    // family will happily produce "47% increase". Feed it product facts (how
    // many tools, what it costs, how long setup takes), which is what the
    // reference client page does with "3 days" and "35 mentors".
    case 'statbar': {
      const stats = (Array.isArray(copy.stats) ? copy.stats : []).slice(0, 4);
      const onInk = variant === 'overlap' || variant === 'row';
      const cols = stats.map((st, i) => col([
        data(String((st && st.value) || ''), '#ffffff', 'right', '48px'),
        T(String((st && st.label) || ''), mix(P, '#ffffff', 0.58), 'right'),
      ], {
        display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start',
        textAlign: 'right', direction: 'rtl', flex: '1 1 180px', boxSizing: 'border-box',
        paddingTop: '28px', paddingBottom: '40px', paddingRight: '28px', paddingLeft: '28px',
        ...(i === 0 ? {} : { borderRight: `1px solid ${FIELD_LINE}` }),
      }, 'flex-start'));
      // The band belongs to the field above it rather than floating on top of
      // it. `overlap` used to mean a rounded black pill with a 70px shadow
      // dropped over the hero; it now means the row continues the same ground,
      // divided by hairlines, which is what makes the numbers read as part of
      // the masthead instead of as a widget.
      const bar = block(cols, {
        display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', direction: 'rtl',
        borderTop: `1px solid ${FIELD_LINE}`,
      }, 'center');
      return { section: section([bar], {
        background: FIELD,
        paddingTop: '0px',
        paddingBottom: variant === 'overlap' ? '8px' : '24px',
        ...(variant === 'overlap' ? { marginTop: '-1px' } : {}),
      }) };
    }

    // ── ANNOUNCEMENT (new) ─────────────────────────────────────────────────────
    // A thin strip above everything. One short line, no CTA: it competes with
    // the hero if it grows past that.
    case 'announcement':
      return { section: section([
        block([col([T(copy.text || '', mix(P, '#ffffff', 0.86), 'center')], {
          display: 'flex', justifyContent: 'center', textAlign: 'center',
        }, 'center')], {}, 'center'),
      ], { background: FIELD, paddingTop: '13px', paddingBottom: '13px' }) };

    // ── STICKY CTA (new) ───────────────────────────────────────────────────────
    // Page-level rather than a section in the flow. The editor has no `position:
    // fixed` in its element contract, so this renders as a full-width brand band
    // that repeats the ask. It is the honest version of the device we can
    // actually render, not a fake of one we cannot.
    case 'stickyCta':
      return { section: section([
        block([col([
          copy.heading ? H(copy.heading, '26px', '#ffffff', 'center') : null,
          copy.cta ? button(copy.cta, '#ffffff', P) : null,
        ].filter(Boolean), {
          display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', textAlign: 'center',
        }, 'center')], {}, 'center'),
      ], { background: FIELD, paddingTop: '44px', paddingBottom: '44px' }) };

    // ── §11 GUARANTEE ──────────────────────────────────────────────────────────
    case 'guarantee':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        centeredProse([T(copy.paragraph, BODY, 'right')]),
      ], { background: '#ffffff' }) };

    // ── §12 LEAD FORM ──────────────────────────────────────────────────────────
    case 'leadform': {
      const form = buildElement({ type: 'form', props: { items: [
        { type: 'input', id: 'name', props: { type: 'text', label_field: { props: { text: 'שם מלא' } }, isRequired: true, style: { width: '100%' }, paramName: 'name' } },
        { type: 'input', id: 'phone', props: { type: 'tel', label_field: { props: { text: 'טלפון' } }, isRequired: true, style: { width: '100%' }, paramName: 'phone' } },
        { type: 'input', id: 'email', props: { type: 'email', label_field: { props: { text: 'אימייל' } }, isRequired: false, style: { width: '100%' }, paramName: 'email' } },
        { type: 'button', id: 'submit', props: { text: copy.submit || 'שליחה', style: { minHeight: '52px', width: '100%', background: '#ffffff', color: FIELD, fontSize: '17px', borderRadius: '0px', fontFamily: UI_FONT } } },
      ] } }, palette);
      return { section: section([
        hb(copy.eyebrow, copy.heading, { onDark: true }),
        // The form sits on the field itself. A white rounded card with a 60px
        // shadow dropped onto a dark band is the same floating-panel device the
        // rest of the page just lost.
        block([col([form], { display: 'flex', flexDirection: 'column', flex: '0 1 560px', direction: 'rtl' }, 'flex-start')], { display: 'flex', direction: 'rtl' }, 'flex-start'),
      ], { background: FIELD, paddingTop: '86px', paddingBottom: '86px' }) };
    }

    // ── §13 ABOUT (paragraph(s) + professional photo) ──────────────────────────
    case 'about':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        block([
          copy.image ? col([photo(copy.image, 560, 340)], { display: 'flex', flex: '1 1 300px', margin: '12px' }, 'center') : null,
          col((copy.paragraphs || [copy.paragraph]).filter(Boolean).map((p, i) => T(p, i === 0 ? BODY : MUTED, 'right')),
            { display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center', flex: '1 1 340px', margin: '12px' }, 'flex-start'),
        ].filter(Boolean), { display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'center' }, 'flex-start'),
      ], { background: LIGHT }) };

    // ── §14 FAQ (accordion) ────────────────────────────────────────────────────
    case 'faq':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        block([col([
          applyFont(
            buildElement({ type: 'accordion', props: { items: (copy.items || []).map((it) => ({ title: it.q || it.title || '', content: it.a || it.content || '' })) }, style: { fontFamily: BODY_FONT } }, palette),
            BODY_FONT,
          ),
        ], { display: 'flex', flexDirection: 'column', margin: '0 auto', flex: '0 1 720px' })], { display: 'flex', justifyContent: 'center' }, 'center'),
      ], { background: '#ffffff' }) };

    // ── final CTA (dark band) ──────────────────────────────────────────────────
    case 'finalcta':
      return { section: section([
        block([col([
          H(copy.heading, '44px', '#ffffff', 'right'),
          copy.subheading ? T(copy.subheading, mix(P, '#ffffff', 0.72), 'right') : null,
          copy.cta ? button(copy.cta, '#ffffff', FIELD) : null,
        ].filter(Boolean), { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', textAlign: 'right', direction: 'rtl', flex: '0 1 46ch' }, 'flex-start')], { display: 'flex', direction: 'rtl' }, 'flex-start'),
      ], { background: FIELD, paddingTop: '92px', paddingBottom: '92px' }) };

    default:
      throw new Error(`Unknown landing pattern "${pattern}".`);
  }
}

module.exports = { composeLandingSection };
