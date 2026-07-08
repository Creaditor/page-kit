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
const { cid, makeText, makeButton, makeImage, makeList, buildElement, readableTextOn } = b;

const INK = '#17091F';
const MUTED = '#6C6284';
const BODY = '#40364F';
const LINE = '#ECE5F4';
const LIGHT = '#F7F5FC';
const CONTENT_WIDTH = 1080; // px, page content width (bypasses editor max-width)

// ── element helpers ──────────────────────────────────────────────────────────
// Brand font — page-kit's makeText defaults to Arial, which looks generic on a
// landing page; the creaditor editor ships Rubik/Assistant, so bake those in.
const FONT = 'Rubik, Assistant, Arial, sans-serif';
const heading = (text, fontSize, color, align) =>
  makeText(text || '', { fontSize, color, align, bold: true, fontFamily: FONT });
const para = (text, color, align) =>
  makeText(text || '', { fontSize: '17px', color, align, fontFamily: FONT });
const button = (text, background, color) => {
  const b = makeButton(text || '', { background, color, borderRadius: '999px', fontSize: '18px' });
  b.props.style.fontFamily = FONT;
  return b;
};
const bullets = (items, color, iconColor) =>
  makeList(Array.isArray(items) ? items : [], { icon: 'check', iconColor, color, fontSize: '17px', fontFamily: FONT });
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
  const kids = [];
  if (eyebrow) kids.push(para(eyebrow, onDark ? '#F6D9EE' : palette.secondary || palette.primary, 'center', palette));
  if (title) kids.push(heading(title, titleSize, onDark ? '#ffffff' : INK, 'center', palette));
  return block([col(kids, { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' })], { marginBottom: mb });
}
const centeredProse = (kids) => block([col(kids, { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' })]);

// card style for multi-item rows
const card = (extra = {}) => ({
  display: 'flex', flexDirection: 'column', gap: '10px', background: '#ffffff', borderRadius: '22px',
  padding: '28px 26px', border: `1px solid ${LINE}`, boxShadow: '0 18px 40px -24px rgba(0,0,0,0.22)',
  boxSizing: 'border-box', textAlign: 'right', flex: '1 1 240px', margin: '10px', ...extra,
});
const cardsRow = (cards) => block(cards.map((kids) => col(kids, card(), 'flex-start')), { display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', alignItems: 'stretch' });

/**
 * @param {string} pattern
 * @param {object} copy  LLM-authored copy for this section
 * @param {object} palette  { primary, secondary, accent, text, background }
 * @returns {{ section: object }}
 */
function composeLandingSection(pattern, copy = {}, palette = {}) {
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
    case 'audience':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        centeredProse([
          copy.paragraph ? T(copy.paragraph, MUTED, 'center') : null,
          bullets(copy.bullets, BODY, S),
        ].filter(Boolean)),
      ], { background: '#ffffff' }) };

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
    case 'offer':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        centeredProse([copy.paragraph ? T(copy.paragraph, MUTED, 'center') : null, bullets(copy.bullets, BODY, S)].filter(Boolean)),
      ], { background: LIGHT }) };

    // ── §9 BONUSES ─────────────────────────────────────────────────────────────
    case 'bonuses':
      return { section: section([
        hb(copy.eyebrow, copy.heading),
        cardsRow((copy.items || []).map((it) => [
          H(it.title || '', '20px', INK, 'right'),
          it.text ? T(it.text, BODY, 'right') : null,
        ].filter(Boolean))),
      ], { background: '#ffffff' }) };

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
