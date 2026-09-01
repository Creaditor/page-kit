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
  };
}

// ── element helpers ──────────────────────────────────────────────────────────
// Brand font — page-kit's makeText defaults to Arial, which looks generic on a
// landing page; the creaditor editor ships Rubik/Assistant, so bake those in.
const FONT = 'Rubik, Assistant, Arial, sans-serif';
const heading = (text, fontSize, color, align) =>
  makeText(text || '', { fontSize, color, align, bold: true, fontFamily: FONT });
const para = (text, color, align) =>
  makeText(text || '', { fontSize: '17px', color, align, fontFamily: FONT });
// `href` is optional: makeButton defaults it to '#', which is what every
// pattern except `articles` wants (a landing CTA scrolls or is wired later).
// Passing it through is what lets each article card carry its own destination.
const button = (text, background, color, href) => {
  const b = makeButton(text || '', { href, background, color, borderRadius: '999px', fontSize: '18px' });
  b.props.style.fontFamily = FONT;
  return b;
};
const bullets = (items, color, iconColor) =>
  makeList(Array.isArray(items) ? items : [], { icon: 'check', iconColor, color, fontSize: '17px', fontFamily: FONT });
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
const col = (children, style = {}, justify = 'center') => ({ id: cid(), type: 'col', children, props: { style, lg: 12, justify } });
const block = (cols, style = {}) => ({ id: cid(), type: 'block', children: cols, props: { style: { width: `${CONTENT_WIDTH}px`, marginLeft: 'auto', marginRight: 'auto', paddingLeft: '28px', paddingRight: '28px', ...style } } });
const section = (blocks, style = {}) => ({ id: cid(), type: 'section', layer: '1', children: blocks, props: { opacity: 1, classList: [], style: { width: '100%', paddingTop: '80px', paddingBottom: '80px', ...style } } });

function headingBlock(eyebrow, title, opts = {}, palette) {
  const { onDark = false, titleSize = '38px', mb = '36px' } = opts;
  const { INK } = neutrals(palette);
  const kids = [];
  if (eyebrow) kids.push(para(eyebrow, onDark ? '#F6D9EE' : palette.secondary || palette.primary, 'center', palette));
  if (title) kids.push(heading(title, titleSize, onDark ? '#ffffff' : INK, 'center', palette));
  return block([col(kids, { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' })], { marginBottom: mb });
}
const centeredProse = (kids) => block([col(kids, { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' })]);

// card style for multi-item rows
//
// `direction: rtl` is load-bearing, not decoration. These sections are
// Hebrew-first (textAlign:'right' here, 'שם מלא' in leadform, 'קראו עוד' in
// articles), but `textAlign` only moves the TEXT. Without `direction` the flex
// row still lays out left-to-right, so item 1 renders leftmost when a Hebrew
// reader expects it rightmost, and any child narrower than the card (the
// buttons) is pinned to the LTR start edge, i.e. the wrong side. Field report
// 260814: "the design is ugly, we are in Hebrew and it's LTR".
const card = (extra = {}, palette = {}) => ({
  display: 'flex', flexDirection: 'column', gap: '10px', background: '#ffffff', borderRadius: '22px',
  padding: '28px 26px', border: `1px solid ${neutrals(palette).LINE}`, boxShadow: '0 18px 40px -24px rgba(0,0,0,0.22)',
  boxSizing: 'border-box', direction: 'rtl', textAlign: 'right', flex: '1 1 240px', margin: '10px', ...extra,
});
// Set on the ROW as well as the card: the row-level value orders the cards
// (first item on the right), the card-level value aligns each card's contents.
const cardsRow = (cards, palette = {}) => block(cards.map((kids) => col(kids, card({}, palette), 'flex-start')), { display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', alignItems: 'stretch', direction: 'rtl' });

/**
 * @param {string} pattern
 * @param {object} copy  LLM-authored copy for this section
 * @param {object} palette  { primary, secondary, accent, text, background }
 * @returns {{ section: object }}
 */
function composeLandingSection(pattern, copy = {}, palette = {}) {
  const { INK, BODY, MUTED, LINE, LIGHT } = neutrals(palette);
  const P = palette.primary || '#6328A7';
  const S = palette.secondary || palette.accent || P;
  const GRAD = `linear-gradient(135deg, ${S} 0%, ${P} 100%)`;
  const H = (t, fs, c, al) => heading(t, fs, c, al, palette);
  const T = (t, c, al) => para(t, c, al, palette);
  const hb = (eyebrow, title, opts) => headingBlock(eyebrow, title, opts, palette);

  switch (pattern) {
    // ── §1 HERO ──────────────────────────────────────────────────────────────
    case 'hero':
      return { section: section([
        block([col([
          copy.eyebrow ? T(copy.eyebrow, '#F6D9EE', 'center') : null,
          H(copy.heading, '56px', '#ffffff', 'center'),
          copy.subheading ? T(copy.subheading, '#F3E9FB', 'center') : null,
          copy.cta ? button(copy.cta, '#ffffff', P) : null,
        ].filter(Boolean), { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center' })]),
      ], { background: GRAD, paddingTop: '104px', paddingBottom: '104px' }) };

    // ── §2 PROBLEM / identification (editorial) ────────────────────────────────
    case 'problem':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        centeredProse([T(copy.paragraph, BODY, 'center')]),
      ], { background: LIGHT }) };

    // ── §3 TARGET AUDIENCE (who it is for) ─────────────────────────────────────
    // Each audience point is its own card col inside a flex-wrap block, so the
    // section reads as a multi-column grid instead of one stacked bullet list.
    case 'audience':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        copy.paragraph ? centeredProse([T(copy.paragraph, MUTED, 'center')]) : null,
        (copy.bullets && copy.bullets.length)
          ? cardsRow(copy.bullets.map((t) => [T(t, BODY, 'right')]), palette)
          : null,
      ].filter(Boolean), { background: '#ffffff' }) };

    // ── §4 SOLUTION (paragraph + bullets + product image) ──────────────────────
    case 'solution':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        copy.paragraph ? centeredProse([T(copy.paragraph, MUTED, 'center')]) : null,
        block([
          col([bullets(copy.bullets, BODY, S)], { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: '1 1 320px', margin: '12px' }, 'flex-start'),
          copy.image ? col([photo(copy.image, 720, 360)], { display: 'flex', flex: '1 1 320px', margin: '12px' }, 'center') : null,
        ].filter(Boolean), { display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }),
      ].filter(Boolean), { background: '#ffffff' }) };

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
        centeredProse([T(copy.paragraph, BODY, 'center')]),
      ], { background: '#ffffff' }) };

    // ── §7 OFFER (short bullets) ───────────────────────────────────────────────
    // "What you get" points as separate card cols (multi-column grid) rather
    // than a single stacked bullet list.
    case 'offer':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        copy.paragraph ? centeredProse([T(copy.paragraph, MUTED, 'center')]) : null,
        (copy.bullets && copy.bullets.length)
          ? cardsRow(copy.bullets.map((t) => [T(t, BODY, 'right')]), palette)
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
          const cta = it.url ? button(label, GRAD, '#ffffff', it.url) : null;
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
        block([col([
          copy.planName ? H(copy.planName, '26px', INK, 'center') : null,
          copy.regularNote ? T(copy.regularNote, MUTED, 'center') : null,
          H(copy.price, '46px', P, 'center'),
          bullets(copy.features, BODY, S),
          copy.urgency ? T(copy.urgency, '#B01254', 'center') : null,
          copy.cta ? button(copy.cta, GRAD, '#ffffff') : null,
        ].filter(Boolean), {
          display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', textAlign: 'center',
          background: '#ffffff', borderRadius: '26px', padding: '44px 38px', margin: '0 auto', flex: '0 1 520px',
          border: `1px solid ${LINE}`, boxShadow: '0 30px 60px -28px rgba(0,0,0,0.28)',
        })], { display: 'flex', justifyContent: 'center' }),
      ], { background: LIGHT }) };

    // ── §11 GUARANTEE ──────────────────────────────────────────────────────────
    case 'guarantee':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        centeredProse([T(copy.paragraph, BODY, 'center')]),
      ], { background: '#ffffff' }) };

    // ── §12 LEAD FORM ──────────────────────────────────────────────────────────
    case 'leadform': {
      const form = buildElement({ type: 'form', props: { items: [
        { type: 'input', id: 'name', props: { type: 'text', label_field: { props: { text: 'שם מלא' } }, isRequired: true, style: { width: '100%' }, paramName: 'name' } },
        { type: 'input', id: 'phone', props: { type: 'tel', label_field: { props: { text: 'טלפון' } }, isRequired: true, style: { width: '100%' }, paramName: 'phone' } },
        { type: 'input', id: 'email', props: { type: 'email', label_field: { props: { text: 'אימייל' } }, isRequired: false, style: { width: '100%' }, paramName: 'email' } },
        { type: 'button', id: 'submit', props: { text: copy.submit || 'שליחה', style: { minHeight: '50px', width: '100%', background: GRAD, color: '#fff', fontSize: '17px', borderRadius: '999px', fontFamily: 'Rubik, sans-serif' } } },
      ] } }, palette);
      return { section: section([
        hb(copy.eyebrow, copy.heading, { onDark: true }),
        block([col([form], { display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: '24px', padding: '34px 32px', margin: '0 auto', flex: '0 1 480px', boxShadow: '0 30px 60px -28px rgba(0,0,0,0.4)' })], { display: 'flex', justifyContent: 'center' }),
      ], { background: GRAD }) };
    }

    // ── §13 ABOUT (paragraph(s) + professional photo) ──────────────────────────
    case 'about':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        block([
          copy.image ? col([photo(copy.image, 560, 340)], { display: 'flex', flex: '1 1 300px', margin: '12px' }, 'center') : null,
          col((copy.paragraphs || [copy.paragraph]).filter(Boolean).map((p, i) => T(p, i === 0 ? BODY : MUTED, 'right')),
            { display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center', flex: '1 1 340px', margin: '12px' }, 'flex-start'),
        ].filter(Boolean), { display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'center' }),
      ], { background: LIGHT }) };

    // ── §14 FAQ (accordion) ────────────────────────────────────────────────────
    case 'faq':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        block([col([
          buildElement({ type: 'accordion', props: { items: (copy.items || []).map((it) => ({ title: it.q || it.title || '', content: it.a || it.content || '' })) } }, palette),
        ], { display: 'flex', flexDirection: 'column', margin: '0 auto', flex: '0 1 720px' })], { display: 'flex', justifyContent: 'center' }),
      ], { background: '#ffffff' }) };

    // ── final CTA (dark band) ──────────────────────────────────────────────────
    case 'finalcta':
      return { section: section([
        block([col([
          H(copy.heading, '46px', '#ffffff', 'center'),
          copy.subheading ? T(copy.subheading, '#EDE7F5', 'center') : null,
          copy.cta ? button(copy.cta, GRAD, '#ffffff') : null,
        ].filter(Boolean), { display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center', textAlign: 'center' })]),
      ], { background: INK, paddingTop: '104px', paddingBottom: '104px' }) };

    default:
      throw new Error(`Unknown landing pattern "${pattern}".`);
  }
}

module.exports = { composeLandingSection };
