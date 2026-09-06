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
 * A photographic ground for a full-bleed band.
 *
 * The renderer passes a section's `style` through verbatim (render's
 * `components/section/index.js` spreads `sectionProps.style` onto the
 * `<section>`), so plain CSS is all this needs. The separate
 * `sectionProps.background` preset slot loads a web component and is a
 * different, richer mechanism; it is deliberately not used here.
 *
 * Three shapes were measured on the real renderer 2026-09-04. A bare cover
 * image leaves the text fighting the photo. A flat scrim is readable. This is
 * the third and most controlled: the solid ground stays underneath as the
 * fallback, and a vertical scrim of that same colour sits in the SAME
 * `backgroundImage` value as the photo, which is what keeps the copy legible
 * over any frame. A photo that fails to load therefore degrades to the flat
 * band the page would have rendered anyway, never to white.
 *
 * HOW HARD the scrim is depends on where the image came from, and the gap
 * between the two settings is most of the difference between a page that feels
 * flat and one that feels lit.
 *
 * A stock PHOTOGRAPH has to be buried. It was composed for its own subject, at
 * its own brightness, with detail everywhere, and type laid over it competes
 * with all of that. 0.72 to 0.97, not the 0.55 to 0.95 first measured: 0.55 was
 * read off a 525px hero where the exposed top is a thin strip, and at the
 * leadform's 862px the same ramp left the photo at near full strength, reading
 * as a photo with a form dropped on it rather than as a ground.
 *
 * A GENERATED ground was composed for this exact job: dark at the top and
 * bottom edges, luminous through the middle, no subject to compete with.
 * Burying it throws away the only thing it was made for. 0.35 to 0.75, so the
 * light in it actually reaches the page.
 *
 * Returns the plain `{ background }` unchanged when there is no image, so
 * every call site can pass this through without branching.
 */
// A third setting for the display hero. 0.15 to 0.45 would be unreadable under
// 17px body copy, which is why `generated` sits where it does; it is safe here
// for exactly the reason the type scale below exists. White type at 118px
// survives a ground that 17px cannot, so the band that carries the biggest type
// is the one band that can afford to show its image nearly undimmed. Reachable
// only when the ground was GENERATED: a stock photograph at 0.15 is a
// photograph with words on it.
const SCRIM = { photo: [0.72, 0.97], generated: [0.35, 0.75], display: [0.15, 0.45] };
const photoGround = (bg, img, kind) => {
  if (!img || typeof img !== 'string') return { background: bg };
  const c = parseColor(bg) || { r: 0, g: 0, b: 0 };
  const scrim = (a) => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
  const [top, bottom] = SCRIM[kind] || SCRIM.photo;
  return {
    background: bg,
    backgroundImage: `linear-gradient(to bottom, ${scrim(top)}, ${scrim(bottom)}), url("${img}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
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
    // 0.93, not 0.965. At 0.965 the tinted band differs from white by about 3
    // percent, which is not a band, it is white with a rumour of one. On the
    // 14-section render the six-section middle of the page (testimonials,
    // whyBuy, offer, bonuses, pricing, guarantee) alternated white and LIGHT
    // exactly as designed and read as one continuous undifferentiated stretch,
    // because the alternation was invisible. 0.93 is still unmistakably a light
    // band, it is just one the eye can find. It also gives the white cards that
    // sit ON this band a ground to separate from.
    LIGHT: mix(brand, '#ffffff', 0.93), // tinted section bands
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
/**
 * How big the display hero sets its heading, DERIVED from the heading itself.
 *
 * The reference sets its wordmark at roughly 118px at a 1440 viewport, and that
 * works because the wordmark is two words. Six to ten words at 118px is a wall,
 * and six to ten words is what a language model writes when asked for a
 * headline. Asking it for a wordmark in the prompt is exactly the kind of rule
 * that has leaked every time it has been tried here, so the size is computed
 * instead: a short heading gets the display treatment, a long one quietly does
 * not, and the variant is renderable either way.
 *
 * Measured in characters rather than words because Hebrew words are short and a
 * three-word Hebrew heading can be narrower than a two-word English one.
 */
function displayScale(heading) {
  const n = String(heading || '').trim().length;
  if (n <= 14) return '118px';
  if (n <= 24) return '88px';
  if (n <= 38) return '66px';
  return '50px';
}
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
/**
 * A section icon: one tinted glyph from the platform icon set.
 *
 * builder.js already has `iconUrl`, but it is hard-wired to the `System/`
 * category at 24px because it exists to serve bullet-list markers. A card icon
 * is a different job: it wants 40px and the best glyph for the section, which
 * for gift, quote and team lives in Finance, Editor and User & Faces. So the
 * path is passed whole here and the size is a parameter.
 *
 * Every path below was checked against the live service (it 404s on a name it
 * does not have, and a 404 renders as a broken image, not as nothing). The
 * colour is baked into the URL, which is what lets one glyph carry the tenant's
 * accent instead of shipping a grey PNG on every brand.
 */
const ICON_BASE = 'https://img.creaditor.ai/icons/serve';
function sectionIcon(path, color, size = 40) {
  const hex = String(color || '#000000').replace('#', '');
  const src = `${ICON_BASE}/${path.split('/').map(encodeURIComponent).join('/')}.png?width=${size * 2}&height=${size * 2}&color=${hex}`;
  const img = makeImage(src, { alt: '', width: size, height: size });
  img.props.style = {
    ...img.props.style,
    width: `${size}px`, height: `${size}px`, borderRadius: '0px',
    objectFit: 'contain', marginBottom: '4px',
  };
  return img;
}

// One glyph per pattern. Fixed rather than model-chosen: the model naming an
// icon per item would be richer, but the service 404s on a name it does not
// have and a 404 renders as a broken image on the tenant's page. A fixed map
// cannot miss. Model-chosen icons are a later move, gated on validating the
// name against the service before it ships.
const PATTERN_ICON = {
  solution: 'System/checkbox-circle-fill',
  problem: 'System/error-warning-fill',
  audience: 'User & Faces/team-fill',
  testimonials: 'Editor/double-quotes-r',
  whyBuy: 'System/checkbox-circle-fill',
  offer: 'System/checkbox-circle-fill',
  bonuses: 'Finance/gift-fill',
  guarantee: 'System/shield-check-fill',
  faq: 'System/question-fill',
  tip: 'Others/lightbulb-flash-fill',
};

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
// `lg` is the col's width in twelfths. The driver turns a col into an MUI Grid
// item and derives its `flex` from lg, so lg is what sizes a col by default.
//
// Measured on the real renderer, what does and does not reach a col:
//   works:        `lg`, and an explicit `flex` in the style (pricing's
//                 `flex: '0 0 280px'` renders at exactly 280px)
//   does nothing: `width`, `maxWidth`, `alignSelf`, and a parent's
//                 `justifyContent` (chat bubbles asked for maxWidth 86% and
//                 rendered at 100% for months because of this)
//
// So narrow a col with `lg` or `flex`, never `width`. And since `alignSelf` is
// inert, a col cannot push ITSELF to one side of its row: that needs a spacer
// sibling, which is what bubbleRow does.
const col = (children, style = {}, justify = 'center', lg = 12) => ({ id: cid(), type: 'col', children: kept(children), props: { style, lg, justify } });
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
    //
    // A col() here, not a block(): this row is nested one level inside the
    // outer col below (kids), and a nested block's OWN wrapper carries the
    // render driver's forced `margin: auto` with no width, which collapses
    // it to its content width instead of filling the row -- measured on the
    // real renderer as the rule-line col shrinking to nothing and the whole
    // row centering under the eyebrow label instead of reading as ruled. A
    // col's own wrapper is a real Grid item (no such collapse), and its
    // display/gap/alignItems reach the Grid container holding these two
    // actual cols, which a block's never do (see block-vs-col guard, §7 of
    // test/landing.test.js).
    kids.push(col([
      col([data(eyebrow, onDark ? mix(S, '#ffffff', 0.55) : S, 'right', '13px', DISPLAY)],
        { display: 'flex', flex: '0 0 auto' }, 'flex-start'),
      col([], { display: 'flex', flex: '1 1 auto', borderBottom: `1px solid ${hairline}`, marginBottom: '7px' }, 'flex-start'),
    ], {
      display: 'flex', gap: '14px', alignItems: 'center', direction: 'rtl',
      width: '100%',
      paddingBottom: '14px', borderBottom: `1px solid ${ruleColor}`, marginBottom: '26px',
    }, 'flex-start'));
  }
  if (title) {
    // A col() here, not a block(), for the same reason as the eyebrow row
    // above, and this row was missed when that one was fixed. A nested
    // block's OWN wrapper carries the driver's forced `margin: auto`, and its
    // `width: '100%'` does not survive, so the row collapsed to the 42ch
    // measure and CENTRED itself: measured on the real renderer at x=533
    // w=374 inside a 1184px content column, with the section's body copy
    // still right-aligned underneath it. Every pattern that heads itself
    // through hb() had a centred, narrowly wrapped heading over right-aligned
    // prose because of this one node type.
    //
    // The block-vs-col guard (§7 of test/landing.test.js) does not catch it:
    // it exempts blocks with a single child on the reasoning that the child
    // does the layout. That reasoning covers dead layout props, not wrapper
    // collapse, which no styling on the child can undo.
    kids.push(col([
      col([heading(title, titleSize, onDark ? '#ffffff' : INK, 'right', DISPLAY)],
        { display: 'flex', flex: '0 1 42ch', textAlign: 'right', direction: 'rtl' }, 'flex-start'),
    ], { display: 'flex', direction: 'rtl', paddingLeft: '0px', paddingRight: '0px', width: '100%' }, 'flex-start'));
  }
  if (!kids.length) return null;
  // No flexDirection:'column' (column-wrap landmine, see rowsBlock in the
  // solution/problem cases below): `kids` holds col()/block() elements, not
  // leaf text, so each is its own lg:12 Grid item and an explicit column
  // direction risks MUI's always-on flex-wrap pushing the title row into a
  // second column instead of under the eyebrow row. The default row+wrap
  // direction plus each kid's own 100% width already stacks them.
  return block([col(kids, { width: '100%' }, 'flex-start')], { marginBottom: mb }, 'flex-start');
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
  // No flexDirection:'column' (column-wrap landmine): `rows` are col()
  // elements (each its own lg:12 Grid item), and an explicit column
  // direction on their container risks MUI's always-on flex-wrap pushing
  // row 2+ into a second column off-canvas instead of further down --
  // measured on the real renderer at four rows. Default row+wrap, relying
  // on each row's own 100% width, is what actually stacks them.
  return block([col(rows, { width: '100%' }, 'flex-start')], {}, 'flex-start');
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
/** A chat bubble's width, in twelfths. See the note on col(): lg is the only
 *  lever that narrows a col, because the driver derives the Grid item's flex
 *  from it and that flex beats width/maxWidth/alignSelf. */
const BUBBLE_LG = 9;

/**
 * Dock one bubble to its speaker's side of the thread.
 *
 * `alignSelf` cannot do this and never could: the driver makes every col a
 * Grid item whose flex comes from `lg`, so alignSelf and maxWidth are both
 * inert. Two separate bubble builders carried that dead pair, one of them with
 * a comment conceding alignSelf made no measured difference, and the result on
 * the real renderer was a stack of full-width slabs that did not read as an
 * exchange at all.
 *
 * The working shape is grid-native. Each message is its own full-width row.
 * The bubble takes BUBBLE_LG twelfths, and the remainder is an empty spacer
 * col placed BEFORE the bubble when it should sit on the far side. Under
 * `direction: rtl` a row fills from the right, so the tenant's own messages
 * need no spacer and the customer's need one.
 *
 * No flexDirection here (column-wrap landmine): the row's children are cols,
 * and each row is lg 12, so the default row-plus-wrap stacking is what keeps
 * the messages in sequence.
 */
function bubbleRow(bubble, mine) {
  const kids = mine ? [bubble] : [col([], {}, 'flex-start', 12 - BUBBLE_LG), bubble];
  return col(kids, { display: 'flex', flexWrap: 'wrap', direction: 'rtl', width: '100%' }, 'flex-start');
}

function threadBubbles(thread, palette = {}) {
  const { INK, LINE, MUTED } = neutrals(palette);
  const P = palette.primary || '#1b65a0';
  return (Array.isArray(thread) ? thread : []).slice(0, 6).map((m) => {
    const mine = (m && m.from) !== 'customer';
    const kids = [para(String((m && m.text) || ''), mine ? '#ffffff' : INK, 'right', palette)];
    if (m && m.time) kids.push(data(String(m.time), mine ? mix(P, '#ffffff', 0.78) : MUTED, 'left', '13px'));
    return bubbleRow(col(kids, {
      display: 'flex', flexDirection: 'column', gap: '4px',
      background: mine ? P : '#ffffff', borderRadius: '22px',
      [mine ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: '6px',
      padding: '14px 18px', boxSizing: 'border-box',
      border: mine ? 'none' : `1px solid ${LINE}`,
      direction: 'rtl', textAlign: 'right',
    }, 'flex-start', BUBBLE_LG), mine);
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
//
// The border is mixed at 0.76 rather than reusing `LINE` (0.90). LINE is a
// hairline for ruled rows on white, and a white card carrying it on the LIGHT
// band is a white rectangle on an almost-white rectangle: measured on the
// 13-section render, card edge and ground differed by about 4%, so the
// testimonial cards read as floating text with no container at all. 0.76 is
// still a hairline, it is just one you can see. No shadow: that decision above
// stands, the border does the separating.
const card = (extra = {}, palette = {}) => ({
  display: 'flex', flexDirection: 'column', gap: '10px', background: '#ffffff', borderRadius: '4px',
  padding: '26px 24px', border: `1px solid ${mix(palette.primary || '#1b65a0', '#ffffff', 0.76)}`,
  boxSizing: 'border-box', direction: 'rtl', textAlign: 'right', flex: '1 1 240px', margin: '10px', ...extra,
});
// Set on the ROW as well as the card: the row-level value orders the cards
// (first item on the right), the card-level value aligns each card's contents.
// `icon`, when given, is prepended to every card in the row. One glyph per card
// rather than one per row: the row is a set of peers, and a single icon over
// the group would label the section, which the eyebrow already does.
const cardsRow = (cards, palette = {}, icon = null) => block([
  col(cards.map((kids) => col(icon ? [icon(), ...kids] : kids, card({}, palette), 'flex-start')), {
    display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch', direction: 'rtl',
  }, 'center'),
], {}, 'center');

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
  // A photographic ground for the bands that earn one. The caller passes it for
  // every pattern and only the bands below spend it: a photo behind every
  // section is worse than a photo behind none, and a band that already carries
  // a foreground photo (hero:asymmetric, hero:cinema-block) must not carry a
  // second one behind it.
  const bgPhoto = typeof opts.backgroundImage === 'string' ? opts.backgroundImage : '';
  // 'generated' or 'photo'. Defaults to 'photo', the heavier scrim, so a caller
  // that does not say gets the safe treatment rather than an under-scrimmed
  // photograph with unreadable type on it.
  const bgKind = opts.backgroundKind === 'generated' ? 'generated' : 'photo';
  const P = palette.primary || '#6328A7';
  const S = palette.secondary || palette.accent || P;
  // The accent that clears a PALE ground, for the section icons on the white
  // and LIGHT bands. Read off deriveTheme (pure, and already called by half the
  // branches below) rather than using `S` raw: a tenant secondary is picked to
  // sit on the dark field and can land at 2:1 on white, which is exactly the
  // mistake solution's `groundOf` bundle exists to prevent.
  const PALE_ACCENT = deriveTheme(P, palette.secondary).ON_LIGHT;
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
      const theme = deriveTheme(P, palette.secondary);

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
          // Layout on a col, not on this block's own style (block-vs-col
          // guard): marginTop/borderTop stay on the block itself, they are
          // box-model on the wrapper and unaffected by the Grid
          // interposition, only the arrangement of the cells moves.
          goldBlocks.push(block([
            col(cells, { display: 'flex', flexWrap: 'wrap', direction: 'rtl' }, 'flex-start'),
          ], { marginTop: '62px', borderTop: `1px solid ${theme.ON_DARK}` }, 'flex-start'));
        }
        return { section: section(goldBlocks, { ...photoGround(theme.FIELD, bgPhoto, bgKind), paddingTop: '92px', paddingBottom: '84px' }) };
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

        // Two cols side by side: the row-arranging props (display/flexWrap/
        // direction) go on an outer col wrapping both, not on this block's
        // own style, per the block-vs-col guard -- a block's style is dead
        // for more than one child (Grid interposition).
        return { section: section([
          block([
            col([
              col(coralCopy, {
                display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start',
                textAlign: 'right', direction: 'rtl', flex: '1 1 720px', background: theme.FIELD,
                boxSizing: 'border-box', paddingTop: '84px', paddingBottom: '88px', paddingLeft: '56px', paddingRight: '56px',
              }, 'flex-start'),
              // No flexDirection:'column' (column-wrap landmine): statRows
              // are col() elements, each its own lg:12 Grid item, and each
              // already carries its own top/bottom padding and a border for
              // separation, so the default row+wrap stack (each row 100%
              // wide) loses nothing by not forcing column direction.
              col(statRows, {
                flex: '0 1 380px', minWidth: '300px',
                background: theme.ON_DARK, boxSizing: 'border-box', paddingTop: '56px', paddingBottom: '56px', paddingLeft: '44px', paddingRight: '44px',
              }, 'center'),
            ], {
              display: 'flex', flexWrap: 'wrap', direction: 'rtl', width: '100%',
            }, 'flex-start'),
          ], { width: '100%', marginLeft: '0px', marginRight: '0px', paddingLeft: '0px', paddingRight: '0px' }, 'flex-start'),
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
            col([
              col(cinemaCopy, { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', textAlign: 'right', direction: 'rtl', flex: '1 1 700px' }, 'flex-start'),
              col([cinemaImg], { display: 'flex', flex: '0 1 440px', minWidth: '260px', background: theme.FIELD }, 'center'),
            ], { display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', direction: 'rtl' }, 'flex-start'),
          ], {}, 'flex-start'),
        ], { ...photoGround(theme.FIELD, bgPhoto, bgKind), paddingTop: '84px', paddingBottom: '84px' }) };
      }

      if (variant === 'asymmetric' && copy.image) {
        return { section: section([
          block([
            col([
              col(heroCopy('right'), { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', textAlign: 'right', flex: '1 1 380px', margin: '12px' }, 'flex-start'),
              col([photo(copy.image, 620, 420)], { display: 'flex', flex: '1 1 380px', margin: '12px' }, 'center'),
            ], { display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', direction: 'rtl' }, 'flex-start'),
          ], {}, 'flex-start'),
        ], { background: FIELD, paddingTop: '84px', paddingBottom: '76px' }) };
      }

      if (variant === 'conversation' && Array.isArray(copy.thread) && copy.thread.length) {
        return { section: section([
          block([
            col([
              col(heroCopy('right'), { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', textAlign: 'right', flex: '1 1 380px', margin: '12px' }, 'flex-start'),
              // No flexDirection:'column' (column-wrap landmine): each
              // bubble is its own col()/Grid item; `gap` alone still reaches
              // the real container and keeps the 14px bubble spacing.
              col(threadBubbles(copy.thread, palette), { gap: '14px', flex: '1 1 340px', margin: '12px', direction: 'rtl' }, 'flex-start'),
            ], { display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', direction: 'rtl' }, 'flex-start'),
          ], {}, 'flex-start'),
        ], { ...photoGround(FIELD, bgPhoto, bgKind), paddingTop: '84px', paddingBottom: '76px' }) };
      }

      // ── EVENT DISPLAY ────────────────────────────────────────────────────
      //
      // The event opening: the name alone at display size, the date and the
      // place under it as FACTS rather than as prose, then a paragraph. Three
      // things separate this from `centered`, and all three were measured off a
      // live reference rather than designed from taste.
      //
      // 1. The size is DERIVED (see `displayScale`). 118px works on a two-word
      //    event name and is a wall on a sentence, and a sentence is what a
      //    model writes when asked for a headline. Computing it means a long
      //    heading degrades to roughly what `centered` would have done instead
      //    of breaking the band.
      // 2. The ground shows. Every other band buries its image because 17px
      //    body copy cannot survive on one; type at this size can, so the scrim
      //    drops to `display` (0.15 to 0.45) whenever the ground was GENERATED.
      //    A stock photograph keeps the heavy ramp: undimmed, it is a
      //    photograph with words on it.
      // 3. `facts` is its own register. On an event page the date and the venue
      //    are the two things the reader came for, and today they can only be
      //    smuggled into the subheading, where they render at 17px as prose.
      if (variant === 'event-display' && Array.isArray(copy.facts) && copy.facts.length) {
        // Joined into ONE string rather than laid out as a row of cols. Under
        // `direction: rtl` a row of two or three short cols needs its own
        // spacer dance to sit centred (see bubbleRow), and a separator that is
        // a character rather than a border cannot get that wrong in either
        // direction.
        const factLine = copy.facts.map((f) => String(f || '').trim()).filter(Boolean).join('  |  ');

        const displayCopy = [
          copy.eyebrow ? D(copy.eyebrow, theme.ON_DARK, 'center', '14px') : null,
          H(copy.heading, displayScale(copy.heading), '#ffffff', 'center'),
          factLine
            ? makeText(factLine, { fontSize: '34px', color: '#ffffff', align: 'center', fontFamily: DISPLAY, lineHeight: '1.3' })
            : null,
          // Centred body copy is unreadable past two lines, which is why
          // `centeredProse` puts every other section's prose at the reading
          // edge. The reference runs seven centred lines here and it holds,
          // because the measure is capped and this is the one block on the page
          // read once at arrival rather than scanned. Capped at 58ch for that
          // reason, and it is the only centred prose in the file.
          copy.subheading
            ? makeText(copy.subheading, { fontSize: '19px', color: mix(P, '#ffffff', 0.78), align: 'center', fontFamily: BODY_FONT, lineHeight: '1.75' })
            : null,
          // Rendered only when the copy supplies one. The reference hero has NO
          // button: its track cards carry the ask and a sticky pill follows the
          // scroll. Neither exists here yet, so a hero that dropped the CTA
          // unconditionally would ship an event page with no action anywhere.
          // When `tracks` lands and the slot brief stops asking, this renders
          // nothing and the band matches the reference exactly.
          copy.cta ? (() => {
            const el = button(copy.cta, 'transparent', '#ffffff');
            el.props.style = { ...el.props.style, border: '1px solid rgba(255, 255, 255, 0.55)', marginTop: '10px' };
            return el;
          })() : null,
        ].filter(Boolean);

        return { section: section([
          block([col(displayCopy, {
            display: 'flex', flexDirection: 'column', gap: '22px', alignItems: 'center',
            textAlign: 'center', direction: 'rtl', margin: '0 auto',
            // An explicit px measure, NOT `ch`. `ch` resolves against the
            // element's own font-size, and this col inherits 16px, so a 58ch
            // basis measured 464px rather than the ~760px the prose is set for.
            // Measured on the real renderer: at 464px the 34px facts line wrapped
            // "the venue" onto a second line and the prose ran to five short
            // ones. Every other measure in this file is a `ch` on the element
            // that carries the type; this one sits on a container, so it cannot
            // be.
            flex: '0 1 760px',
          }, 'center')], { display: 'flex', justifyContent: 'center' }, 'center'),
        ], {
          ...photoGround(theme.FIELD, bgPhoto, bgKind === 'generated' ? 'display' : bgKind),
          paddingTop: '130px', paddingBottom: '130px',
        }) };
      }

      return { section: section([
        block([col(heroCopy('center'), { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center' })], {}, 'center'),
      ], { ...photoGround(FIELD, bgPhoto, bgKind), paddingTop: '96px', paddingBottom: '96px' }) };
    }

    // ── LINEUP: who is on the stage ──────────────────────────────────────────
    //
    // The first word of an EVENT vocabulary. Every pattern above this one is
    // product-shaped (a pain, a solution, an offer, a guarantee), and a
    // conference page is not selling a product: it needs a lineup, a venue,
    // tracks, past editions. This is the first of those.
    //
    // `placeholder` is the default on purpose. An event page is built and
    // published months before its lineup is signed (the reference page this was
    // measured from is live in exactly that state today), so the section with no
    // speakers in it is the state it spends most of its life in, and it has to
    // be the good-looking one. The default is also what makes "never invent a
    // speaker" free: the variant that needs no names is the one the model gets
    // without asking, so fabricating a roster buys it nothing.
    case 'lineup': {
      const theme = deriveTheme(P, palette.secondary);
      const rgba = (hex, a) => {
        const c = parseColor(hex) || { r: 0, g: 0, b: 0 };
        return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
      };

      // Translucent so the ground reads through the panel, but only when there
      // IS a ground. With no OPENAI_API_KEY the caller falls back to Pexels,
      // where only the first band gets an image, and a see-through panel over
      // flat near-black is nothing at all. `bgPhoto` is already the signal for
      // which case this is.
      const panelBg = bgPhoto ? rgba(theme.FIELD, 0.55) : theme.PANEL;

      // 24px, against `card()`'s 4px. That rule governs content cards in a row
      // on a flat band and it stands. This is one lightbox panel floating on a
      // photograph, where a hard corner reads as a crop artifact rather than as
      // a container, and `photo()` already carries 20px for the same reason.
      // No shadow: that half of the rule is untouched, the border separates.
      //
      // No flexDirection here (column-wrap landmine): `kids` are col()
      // elements, each its own lg:12 Grid item, so the default row-plus-wrap
      // stacking plus each kid's own 100% width is what puts them under one
      // another.
      const panel = (kids) => block([col(kids, {
        display: 'flex', flexWrap: 'wrap', direction: 'rtl',
        margin: '0 auto', flex: '0 1 880px', boxSizing: 'border-box',
        background: panelBg, border: `1px solid ${theme.LINE}`, borderRadius: '24px',
        paddingTop: '58px', paddingBottom: '58px', paddingLeft: '48px', paddingRight: '48px',
      }, 'center')], { display: 'flex', justifyContent: 'center' }, 'center');

      // Outline, and SQUARE. The reference draws this control as a pill, but
      // `button()` above is square by a decision this file already made and
      // states, and a lone pill among square CTAs reads as a mistake rather
      // than as emphasis. What the panel actually needs from the reference is
      // the OUTLINE: a filled brand button inside a translucent panel on a lit
      // ground is three solid layers stacked in the same 200px.
      const outlineCta = (label) => {
        const el = button(label, 'transparent', theme.ON_DARK);
        el.props.style = { ...el.props.style, border: `1px solid ${theme.ON_DARK}` };
        return el;
      };

      // Leaves, so an explicit column direction is safe here (the landmine is
      // col-children only).
      const head = col([
        copy.eyebrow ? D(copy.eyebrow, theme.ON_DARK, 'center', '13px') : null,
        H(copy.heading, '46px', '#ffffff', 'center'),
        // Centered body copy is unreadable past two lines, which is why
        // `centeredProse` exists for every prose section on this page. It is
        // allowed here because the line is ONE line by contract: the slot brief
        // asks for a single short line and neither variant renders more.
        copy.subheading ? T(copy.subheading, theme.MUTED, 'center') : null,
      ].filter(Boolean), {
        display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center',
        textAlign: 'center', direction: 'rtl', width: '100%',
      }, 'center');

      const cta = copy.cta
        ? col([outlineCta(copy.cta)], {
            display: 'flex', justifyContent: 'center', direction: 'rtl',
            width: '100%', marginTop: '26px',
          }, 'center')
        : null;

      const band = { ...photoGround(theme.FIELD, bgPhoto, bgKind), paddingTop: '110px', paddingBottom: '110px' };

      // ── ROSTER: the speakers are confirmed ───────────────────────────────
      //
      // Text only. The reference carries a photograph per speaker; no
      // BusinessContext field supplies one and the model must never author an
      // image URL (the rule the `articles` slot established, where the hrefs
      // are attached by index after the model has written). Names at display
      // size, role muted beneath, ruled off from one another. Photographs wait
      // for a caller-supplied path of the ArticleLink[] shape.
      if (variant === 'roster') {
        const speakers = (Array.isArray(copy.items) ? copy.items : []).slice(0, 8);
        // The column count is DERIVED from how many speakers there are rather
        // than fixed at three. Measured on the real renderer: at a fixed three
        // across, a four-speaker lineup renders three and then one alone,
        // centered in a row of its own, because a lone flex item with room to
        // grow fills the row. Four reads as two-by-two, and every other count
        // reads as thirds.
        const cols = speakers.length <= 3 ? Math.max(speakers.length, 1) : speakers.length === 4 ? 2 : 3;
        // A fixed basis rather than `1 1 200px` for the same reason: `grow: 1`
        // is what let the last row stretch itself out of alignment with the
        // rows above it.
        const basis = `0 1 ${(100 / cols).toFixed(3)}%`;

        const people = speakers.map((it) => col([
          H(String((it && it.title) || ''), '22px', '#ffffff', 'center'),
          (it && it.text)
            ? makeText(String(it.text), { fontSize: '15px', color: theme.MUTED, align: 'center', fontFamily: BODY_FONT, lineHeight: '1.5' })
            : null,
        ].filter(Boolean), {
          display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center',
          textAlign: 'center', direction: 'rtl', flex: basis, boxSizing: 'border-box',
          paddingTop: '18px', paddingBottom: '18px', paddingLeft: '16px', paddingRight: '16px',
        }, 'center'));

        return { section: section([
          panel([
            head,
            // `flex: 1 1 200px` on each person is what lets them share a row
            // and wrap, the same lever `cardsRow` uses. Without it every col is
            // its own full-width Grid item and eight speakers become eight
            // rows.
            // Separated by gap, never by a per-item rule. A `borderTop` on each
            // person draws a full rule only while the row is full: on the real
            // renderer a four-speaker lineup put a line across the middle third
            // of the panel and stopped, which reads as a rendering fault rather
            // than as a divider.
            col(people, {
              display: 'flex', flexWrap: 'wrap', direction: 'rtl', width: '100%',
              rowGap: '14px', marginTop: '34px', borderTop: `1px solid ${theme.LINE}`, paddingTop: '30px',
            }, 'center'),
            cta,
          ].filter(Boolean)),
        ], band) };
      }

      // ── PLACEHOLDER: the lineup is not signed yet ─────────────────────────
      return { section: section([panel([head, cta].filter(Boolean))], band) };
    }

    // ── §2 PROBLEM / identification (editorial) ────────────────────────────────
    case 'problem': {
      // continuous, panels and lift share one derived theme, computed once
      // here rather than per branch (mirrors how the hero case above shares
      // its own `theme` local across gold-night/coral-cut/cinema-block).
      const theme = deriveTheme(P, palette.secondary);

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
        // NOT flexDirection:'column' here: MUI's Grid container always ships
        // flex-wrap:wrap in its own baseline CSS (page-kit has no lever to
        // turn it off), so an explicit column direction on a Grid container
        // holding lg:12 items wraps into ADDITIONAL COLUMNS once it runs out
        // of vertical room instead of growing downward -- measured on the
        // real renderer as rows 2 and 3 landing off-canvas to the right of
        // row 1. Leaving flexDirection unset keeps the container's default
        // row+wrap, and each row col()'s own lg:12 (100% width) already
        // forces one row per wrapped line, which is what actually stacks
        // them; this rests on that default rather than fighting it.
        const rowsBlock = block([col(rows, { width: '100%' }, 'flex-start')], {}, 'flex-start');
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
        // block()'s OWN style is a dead end for a gap between panelCols: the
        // driver's Block component puts an MUI Grid container between the
        // styled div and its children (children = panelCols), so the div that
        // carries the style ends up with exactly ONE dom child (that Grid
        // wrapper) and the gap has nothing to separate -- measured on the real
        // renderer as a flex/gap div with kids:1. Column, unlike Block, copies
        // gap + flexDirection from its OWN style into the inner Grid container
        // that directly holds ITS children, so the fix is the same shape
        // problemHead already uses one level up: wrap the actual multi-child
        // row in a col(), and wrap that single col in the outer block() only
        // for the 1240px content width.
        // alignItems: 'stretch' -- Column's own default is 'start' (its cross-
        // axis alignment for the Grid container holding these children), which
        // top-aligns each panel at its own natural (text-driven) height instead
        // of filling the row. With items of different line counts that leaves
        // a panel short of its neighbours, exposing the section's FIELD ground
        // through the shortfall -- the opposite of "square, flush and
        // touching." Measured: 324/324/297px heights in one row before this.
        const panelsBlock = block([
          col(panelCols, { display: 'flex', flexWrap: 'wrap', gap: '2px', direction: 'rtl', alignItems: 'stretch' }, 'flex-start'),
        ], {}, 'flex-start');
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
        // NOT flexDirection:'column' here: MUI's Grid container always ships
        // flex-wrap:wrap in its own baseline CSS (page-kit has no lever to
        // turn it off), so an explicit column direction on a Grid container
        // holding lg:12 items wraps into ADDITIONAL COLUMNS once it runs out
        // of vertical room instead of growing downward -- measured on the
        // real renderer as rows 2 and 3 landing off-canvas to the right of
        // row 1. Leaving flexDirection unset keeps the container's default
        // row+wrap, and each row col()'s own lg:12 (100% width) already
        // forces one row per wrapped line, which is what actually stacks
        // them; this rests on that default rather than fighting it.
        const rowsBlock = block([col(rows, { width: '100%' }, 'flex-start')], {}, 'flex-start');
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
      const theme = deriveTheme(P, palette.secondary);
      // A ground is a bundle: background, ink, body, line, and the accent
      // that belongs to THAT ground, so no variant can accidentally put the
      // dark accent on the light background (the failure sketch 005
      // measured at 1.8:1). Mirrors sketch 007's own `grounds` object.
      const groundOf = (which) => which === 'light'
        ? { BG: theme.LIFT, INK: theme.LIFT_INK, BODY: theme.LIFT_BODY, LINE: theme.LIFT_LINE, ACC: theme.ON_LIGHT, ON_ACC: theme.onAccentLight, PANEL: '#ffffff' }
        : { BG: theme.FIELD, INK: '#ffffff', BODY: theme.MUTED, LINE: theme.LINE, ACC: theme.ON_DARK, ON_ACC: theme.onAccentDark, PANEL: theme.PANEL };
      const ground = opts.ground === 'light' ? 'light' : 'dark';
      // A ground photo belongs only on the dark bundle. groundOf('light')
      // returns theme.LIFT with dark ink on it, and a scrimmed image under dark
      // type on a pale band is unreadable no matter how light the scrim.
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
          return col([sectionIcon(PATTERN_ICON.solution, g.ACC, 30), name, T(it.text, g.BODY, 'right')], {
            display: 'flex', flexDirection: 'column',
            background: g.PANEL, padding: '34px 30px 38px', flex: '1 1 330px', boxSizing: 'border-box',
          }, 'flex-start');
        });
        // Same fix as problem:panels' panelsBlock, same reason: block()'s own
        // style is a dead end for a gap on its multiple children, because the
        // driver's Block component interposes an MUI Grid container between
        // the styled div and those children (measured as kids:1 on the real
        // renderer). Column copies gap onto the Grid container that actually
        // holds its children, so the gap has to live one level down, on a col()
        // wrapping the cells, with block() providing only the 1240px width.
        // alignItems: 'stretch', same reason as panelsBlock: Column's own
        // default cross-axis alignment is 'start', which top-aligns each cell
        // at its own text-driven height rather than filling the row -- a
        // one-line cell next to two-line neighbours left a visible dark strip
        // of the section's ground colour under the short cell.
        const cellsBlock = block([
          col(cells, { display: 'flex', flexWrap: 'wrap', gap: '2px', direction: 'rtl', alignItems: 'stretch' }, 'flex-start'),
        ], {}, 'flex-start');
        return { section: section([headBlock, cellsBlock], { ...photoGround(g.BG, ground === 'dark' ? bgPhoto : '', bgKind) }) };
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
        // Same as rowsBlock above: no flexDirection:'column' (column-wrap
        // landmine, see there). `gap` alone still reaches this col's real
        // Grid container -- gap is copied to innerLayout independently of
        // flexDirection, and CSS gap inserts space between WRAPPED LINES in
        // a row+wrap container too, so the 22px lands correctly between the
        // stacked rows without needing column direction at all.
        const stackBlock = block([col(rows, { gap: '22px', width: '100%' }, 'flex-start')], {}, 'flex-start');
        return { section: section([headBlock, stackBlock], { ...photoGround(g.BG, ground === 'dark' ? bgPhoto : '', bgKind) }) };
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
        // No flexDirection:'column' (column-wrap landmine, see rowsBlock).
        const capsBlock = block([col(capRows, { width: '100%', direction: 'rtl' }, 'flex-start')], {}, 'flex-start');

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
          // Docked through bubbleRow, not alignSelf. The KNOWN LIMITATION note
          // that used to sit here was right that alignSelf made no measured
          // difference, and wrong about it being unfixable: alignSelf and
          // maxWidth are both inert against the flex the driver derives from
          // a col's `lg`, so the width has to come from lg instead.
          return bubbleRow(col(kids, {
            display: 'flex', flexDirection: 'column', gap: '6px', background: bg,
            // Chat-bubble corner radii are a deliberate, sketch-exact exception
            // to the page's square-corner rule: hero.conversation's own
            // threadBubbles already ships rounded bubbles today. Messaging
            // bubbles are the one established genre exception on this page.
            borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            padding: '14px 17px', boxSizing: 'border-box',
            direction: 'rtl', textAlign: 'right',
          }, 'flex-start', BUBBLE_LG), mine);
        });
        // Same fix as capsBlock above: its own top-level block, not a col
        // sharing a row with capsBlock. `alignItems: 'flex-start'` is set
        // explicitly too, though measured to make no visible difference on
        // its own -- see the KNOWN LIMITATION note on each bubble above.
        // No flexDirection:'column' (column-wrap landmine, see rowsBlock):
        // with six bubbles this is exactly the content height that tips a
        // column-direction Grid container into wrapping bubbles 4-6 into a
        // second column off-canvas instead of continuing to stack them.
        const bubblesBlock = block([
          col(bubbles, {
            alignItems: 'flex-start', width: '100%', gap: '10px', direction: 'rtl',
          }, 'flex-start'),
        ], { marginTop: '36px' }, 'flex-start');

        return { section: section([headBlock, capsBlock, bubblesBlock], { ...photoGround(g.BG, ground === 'dark' ? bgPhoto : '', bgKind) }) };
      }
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        copy.paragraph ? centeredProse([T(copy.paragraph, MUTED, 'right')]) : null,
        block([
          col([
            col([bullets(copy.bullets, BODY, S)], { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: '1 1 320px', margin: '12px' }, 'flex-start'),
            copy.image ? col([photo(copy.image, 720, 360)], { display: 'flex', flex: '1 1 320px', margin: '12px' }, 'center') : null,
          ].filter(Boolean), { display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }, 'flex-start'),
        ], {}, 'flex-start'),
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
        ].filter(Boolean)), palette, () => sectionIcon(PATTERN_ICON.testimonials, PALE_ACCENT, 30)),
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
        ].filter(Boolean)), palette, () => sectionIcon(PATTERN_ICON.bonuses, PALE_ACCENT, 34)),
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
            // The offer and its action are ONE column. They used to be the
            // first and third of three, with the feature list between them on
            // `flex: '1 1 auto'`, so the list absorbed the row and shoved the
            // button to the opposite edge: measured on a live render with the
            // button alone at the far left, 700px from the price it belongs
            // to, reading as an unrelated stray control.
            //
            // The price also sat on a fixed `flex: '0 0 280px'`. A price is
            // not always "89 x" wide: this tenant's real generation put
            // "30 x" worth of free-trial phrase in the field, which at 66px
            // wrapped to one word per line down a narrow column. Both columns
            // now share the row on an equal, shrinkable basis instead.
            col([
              data(copy.price, INK, 'right', '66px'),
              copy.planName ? T(copy.planName, MUTED, 'right') : null,
              copy.regularNote ? T(copy.regularNote, MUTED, 'right') : null,
              copy.cta ? button(copy.cta, INK, '#ffffff') : null,
            ].filter(Boolean), { display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'flex-start', flex: '1 1 300px', direction: 'rtl', textAlign: 'right' }, 'flex-start'),
            col([
              bullets(copy.features, BODY, S),
              copy.urgency ? T(copy.urgency, S, 'right') : null,
            ].filter(Boolean), { display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 300px', direction: 'rtl', textAlign: 'right' }, 'flex-start'),
          ], { display: 'flex', gap: '48px', direction: 'rtl', alignItems: 'flex-start' }, 'flex-start'),
        ], { borderTop: `1px solid ${INK}`, paddingTop: '40px' }, 'flex-start'),
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
      const bar = block([
        col(cols, { display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', direction: 'rtl' }, 'center'),
      ], { borderTop: `1px solid ${FIELD_LINE}` }, 'center');
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

    // ── TIP (one useful thing, said plainly) ───────────────────────────────────
    //
    // Not a section of the sales argument: an aside that gives the reader
    // something they can use whether or not they buy. That is the whole design
    // constraint, and it is why this does not reuse guarantee's shape even
    // though both are one panel holding one idea. Guarantee is a claim ABOUT the
    // offer and sits centred in the reading column with the page's own
    // typography, so it reads as more of the pitch. A tip has to read as an
    // interruption of the pitch, so it gets a container the page uses nowhere
    // else: a white panel on the light band with a thick accent edge on the
    // reading side, and the lightbulb.
    //
    // borderRight, not borderLeft: these pages are RTL, so the reading edge a
    // Hebrew eye lands on first is the right one. An accent rule on the left is
    // an accent rule at the END of every line.
    case 'tip': {
      const kids = [
        sectionIcon(PATTERN_ICON.tip, PALE_ACCENT, 34),
        copy.eyebrow ? data(copy.eyebrow, PALE_ACCENT, 'right', '13px', DISPLAY) : null,
        copy.heading ? H(copy.heading, '28px', INK, 'right') : null,
        copy.paragraph ? T(copy.paragraph, BODY, 'right') : null,
      ].filter(Boolean);
      return { section: section([
        // Layout on the col, never on the block: the driver interposes a Grid
        // container, so a flex/gap set on the block() reaches nothing.
        block([col(kids, {
          display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start',
          background: '#ffffff', borderRight: `4px solid ${PALE_ACCENT}`,
          border: `1px solid ${mix(P, '#ffffff', 0.76)}`,
          borderRightWidth: '4px', borderRightColor: PALE_ACCENT,
          padding: '32px 34px 36px', boxSizing: 'border-box',
          textAlign: 'right', direction: 'rtl', flex: '0 1 74ch',
        }, 'flex-start')], { display: 'flex', direction: 'rtl' }, 'flex-start'),
      ], { background: LIGHT, paddingTop: '64px', paddingBottom: '64px' }) };
    }

    // ── §12 LEAD FORM ──────────────────────────────────────────────────────────
    case 'leadform': {
      const theme = deriveTheme(P, palette.secondary);
      // The fields have to read as fields. They used to inherit the dark ground
      // and rendered near-invisible: a dark input on a dark band, with only a
      // faint border to say it was an input at all.
      const inputStyle = {
        width: '100%', minHeight: '52px', background: '#ffffff', color: theme.FIELD,
        border: `1px solid ${theme.LINE}`, borderRadius: '0px', fontFamily: UI_FONT,
      };
      // The label colour is set explicitly rather than inherited. The renderer
      // puts the label in its own Typography that reads `label_field.props.style`
      // (see render's form factory), so an unstyled label takes whatever it
      // inherits, and on the PANEL card that came out near-black on dark.
      const labelStyle = { color: '#ffffff', fontFamily: UI_FONT };
      const field = (id, type, label, isRequired) => ({
        type: 'input', id,
        props: { type, label_field: { props: { text: label, style: labelStyle } }, isRequired, style: inputStyle, paramName: id },
      });
      const form = buildElement({ type: 'form', props: { items: [
        field('name', 'text', 'שם מלא', true),
        field('phone', 'tel', 'טלפון', true),
        field('email', 'email', 'אימייל', false),
        // The accent, not another white slab. With white inputs above it, a
        // white button would be the fourth identical rectangle in the stack and
        // would read as one more field rather than as the action.
        { type: 'button', id: 'submit', props: { text: copy.submit || 'שליחה', style: { minHeight: '52px', width: '100%', background: theme.ON_DARK, color: theme.onAccentDark, fontSize: '17px', borderRadius: '0px', fontFamily: UI_FONT } } },
      ] } }, palette);
      return { section: section([
        hb(copy.eyebrow, copy.heading, { onDark: true }),
        // The form sits on a PANEL card: the ground one shade off, which is the
        // same device problem:panels and solution:tiles already use for their
        // cells, so the card belongs to the page's own vocabulary.
        //
        // Square corners and no shadow, deliberately. The note that used to be
        // here rejected "a white rounded card with a 60px shadow dropped onto a
        // dark band" as the floating-panel device the rest of the page had just
        // lost, and it was right about that. It was wrong to conclude that the
        // form therefore needed no container at all: with nothing behind them
        // the inputs had no ground to contrast against.
        block([col([form], {
          display: 'flex', flexDirection: 'column', flex: '0 1 560px', direction: 'rtl',
          background: theme.PANEL, padding: '38px 34px 42px', boxSizing: 'border-box',
        }, 'flex-start')], { display: 'flex', direction: 'rtl' }, 'flex-start'),
      ], { ...photoGround(theme.FIELD, bgPhoto, bgKind), paddingTop: '86px', paddingBottom: '86px' }) };
    }

    // ── §13 ABOUT (paragraph(s) + professional photo) ──────────────────────────
    case 'about':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        block([
          col([
            copy.image ? col([photo(copy.image, 560, 340)], { display: 'flex', flex: '1 1 300px', margin: '12px' }, 'center') : null,
            col((copy.paragraphs || [copy.paragraph]).filter(Boolean).map((p, i) => T(p, i === 0 ? BODY : MUTED, 'right')),
              { display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center', flex: '1 1 340px', margin: '12px' }, 'flex-start'),
          ].filter(Boolean), { display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'center' }, 'flex-start'),
        ], {}, 'flex-start'),
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
      ], { ...photoGround(FIELD, bgPhoto, bgKind), paddingTop: '92px', paddingBottom: '92px' }) };

    default:
      throw new Error(`Unknown landing pattern "${pattern}".`);
  }
}

module.exports = { composeLandingSection };
