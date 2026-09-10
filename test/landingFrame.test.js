/**
 * The page frame: composeLandingNav + composeLandingFooter.
 *
 * Deterministic, no model copy, and everything a field can miss must simply
 * not render. The anchor contract is the load-bearing part: menu items and the
 * nav CTA emit `onClick.link = { href: '#name', protocol: 'anchor:' }`, which
 * is exactly what the render driver's Clicker scrolls on.
 *
 * No em-dash or en-dash anywhere -- ASCII hyphens only.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { composeLandingNav, composeLandingFooter } = require('../landingSections.js');

const PALETTE = { primary: '#1b65a0', secondary: '#841d94' };

const walk = (node, fn) => {
  if (!node || typeof node !== 'object') return;
  fn(node);
  for (const c of node.children || []) walk(c, fn);
};
const collect = (tree, type) => {
  const out = [];
  walk(tree, (n) => { if (n.type === type) out.push(n); });
  return out;
};

// ── nav ───────────────────────────────────────────────────────────────────────

test('nav: menu items carry anchor-protocol links to the given names', () => {
  const { section } = composeLandingNav(PALETTE, {
    logo: 'https://x/logo.png', businessName: 'שלח מסר',
    items: [
      { label: 'איך זה עובד', anchor: 'sec-solution' },
      { label: 'מחירים', anchor: 'sec-pricing' },
    ],
    cta: { text: 'התחילו ניסיון', anchor: 'sec-leadform' },
    language: 'he',
  });
  const [mw] = collect(section, 'menu-widget');
  assert.ok(mw, 'nav renders a menu-widget');
  const items = mw.props.items;
  assert.strictEqual(items.length, 2);
  for (const it of items) {
    assert.match(it.onClick.link.href, /^#sec-/);
    assert.strictEqual(it.onClick.link.protocol, 'anchor:');
    assert.strictEqual(it.style.backgroundColor, 'transparent');
  }
});

test('nav: the CTA button jumps in-page rather than opening a URL', () => {
  const { section } = composeLandingNav(PALETTE, {
    businessName: 'שלח מסר',
    items: [],
    cta: { text: 'התחילו ניסיון', anchor: 'sec-leadform' },
    language: 'he',
  });
  const [btn] = collect(section, 'button');
  assert.ok(btn, 'nav renders the CTA button');
  assert.strictEqual(btn.props.onClick.link.href, '#sec-leadform');
  assert.strictEqual(btn.props.onClick.link.protocol, 'anchor:');
});

test('nav: no logo falls back to the business name as a wordmark', () => {
  const { section } = composeLandingNav(PALETTE, {
    businessName: 'שלח מסר', items: [], cta: null, language: 'he',
  });
  assert.strictEqual(collect(section, 'image').length, 0);
  const texts = collect(section, 'text');
  assert.ok(texts.some((t) => JSON.stringify(t.props).includes('שלח מסר')));
});

test('nav: the band is slim, not a full section', () => {
  const { section } = composeLandingNav(PALETTE, { businessName: 'x', items: [], cta: null });
  assert.strictEqual(section.props.style.paddingTop, '14px');
  assert.strictEqual(section.props.style.paddingBottom, '14px');
});

test('nav: items without label or anchor are dropped, never rendered half-made', () => {
  const { section } = composeLandingNav(PALETTE, {
    businessName: 'x',
    items: [{ label: 'ok', anchor: 'sec-a' }, { label: '', anchor: 'sec-b' }, { label: 'no anchor' }],
    cta: null,
  });
  const [mw] = collect(section, 'menu-widget');
  assert.strictEqual(mw.props.items.length, 1);
});

// ── footer ────────────────────────────────────────────────────────────────────

test('footer: renders identity, contacts, socials and small print from real fields', () => {
  const { section } = composeLandingFooter(PALETTE, {
    businessName: 'שלח מסר', phone: '03-123-4567', email: 'support@x.co.il',
    socials: { facebook: 'https://f', linkedin: 'https://l' },
    year: 2026, language: 'he',
  });
  const flat = JSON.stringify(section);
  assert.ok(flat.includes('03-123-4567'));
  assert.ok(flat.includes('support@x.co.il'));
  const [social] = collect(section, 'social');
  assert.strictEqual(social.props.items.length, 2);
  for (const it of social.props.items) {
    assert.ok(it.url.startsWith('https://'));
    assert.ok(it.src.includes('color=ffffff'), 'white glyphs on the dark band');
  }
  assert.ok(flat.includes('© 2026'));
});

test('footer: unknown platforms and empty urls do not render', () => {
  const { section } = composeLandingFooter(PALETTE, {
    businessName: 'x',
    socials: { tiktok: 'https://t', facebook: '' },
    year: 2026,
  });
  assert.strictEqual(collect(section, 'social').length, 0);
});

test('footer: a business context with nothing to show renders no footer at all', () => {
  const { section } = composeLandingFooter(PALETTE, { socials: {}, year: 2026 });
  assert.strictEqual(section, null);
});

test('frame: neither composer emits an em-dash or en-dash anywhere', () => {
  const nav = composeLandingNav(PALETTE, {
    businessName: 'x', items: [{ label: 'a', anchor: 'sec-a' }], cta: { text: 'b', anchor: 'sec-b' },
  });
  const footer = composeLandingFooter(PALETTE, { businessName: 'x', year: 2026 });
  for (const tree of [nav.section, footer.section]) {
    assert.ok(!/[–—]/.test(JSON.stringify(tree)));
  }
});

// ── floaters ─────────────────────────────────────────────────────────────────

test('floaters: whatsapp circle SSRs as a plain link with fixed positioning', () => {
  const { composeLandingFloaters } = require('../landingSections.js');
  const { section } = composeLandingFloaters(PALETTE, {
    whatsappUrl: 'https://wa.me/972501234567',
    pill: null,
  });
  const [img] = collect(section, 'image');
  assert.ok(img, 'renders the circle image');
  assert.strictEqual(img.props.onClick.link.href, 'https://wa.me/972501234567');
  assert.strictEqual(img.props.style.position, 'fixed');
  assert.ok(img.props.src.includes('whatsapp'));
});

test('floaters: the pill jumps in-page with the anchor protocol', () => {
  const { composeLandingFloaters } = require('../landingSections.js');
  const { section } = composeLandingFloaters(PALETTE, {
    whatsappUrl: '',
    pill: { text: 'התחילו ניסיון', anchor: 'sec-leadform' },
  });
  const [btn] = collect(section, 'button');
  assert.strictEqual(btn.props.onClick.link.href, '#sec-leadform');
  assert.strictEqual(btn.props.onClick.link.protocol, 'anchor:');
  assert.strictEqual(btn.props.style.position, 'fixed');
});

test('floaters: nothing to float, no section at all', () => {
  const { composeLandingFloaters } = require('../landingSections.js');
  assert.strictEqual(composeLandingFloaters(PALETTE, {}).section, null);
  assert.strictEqual(composeLandingFloaters(PALETTE, { whatsappUrl: '', pill: null }).section, null);
});

test('floaters: the host band is zero-height, both children out of flow', () => {
  const { composeLandingFloaters } = require('../landingSections.js');
  const { section } = composeLandingFloaters(PALETTE, {
    whatsappUrl: 'https://wa.me/972501234567',
    pill: { text: 'x', anchor: 'sec-leadform' },
  });
  assert.strictEqual(section.props.style.paddingTop, '0px');
  assert.strictEqual(section.props.style.paddingBottom, '0px');
  walk(section, (n) => {
    if (n.type === 'image' || n.type === 'button') {
      assert.strictEqual(n.props.style.position, 'fixed');
    }
  });
});

// ── section ask ──────────────────────────────────────────────────────────────

test('sectionAsk: a link-styled button jumping in-page, arrow by language', () => {
  const { composeLandingSectionAsk } = require('../landingSections.js');
  const he = composeLandingSectionAsk(PALETTE, { text: 'התחילו', anchor: 'sec-leadform', onDark: false, language: 'he' });
  const [btn] = collect(he.block, 'button');
  assert.ok(btn.props.text.endsWith('←'), 'RTL arrow');
  assert.strictEqual(btn.props.onClick.link.href, '#sec-leadform');
  assert.strictEqual(btn.props.onClick.link.protocol, 'anchor:');
  assert.strictEqual(btn.props.style.background, 'transparent');
  assert.strictEqual(btn.props.style.border, 'none');
  const en = composeLandingSectionAsk(PALETTE, { text: 'Start', anchor: 'a', language: 'en' });
  assert.ok(collect(en.block, 'button')[0].props.text.endsWith('→'), 'LTR arrow');
});

test('sectionAsk: nothing to say or nowhere to go, no block', () => {
  const { composeLandingSectionAsk } = require('../landingSections.js');
  assert.strictEqual(composeLandingSectionAsk(PALETTE, { text: '', anchor: 'a' }).block, null);
  assert.strictEqual(composeLandingSectionAsk(PALETTE, { text: 'x', anchor: '' }).block, null);
});

// ── countdown ────────────────────────────────────────────────────────────────

test('countdown: renders the driver countdown element with the ISO datetime', () => {
  const { composeLandingCountdown } = require('../landingSections.js');
  const { section } = composeLandingCountdown(PALETTE, { date: '2026-11-11', label: 'הזמן אוזל', language: 'he' });
  const [cd] = collect(section, 'countdown');
  assert.ok(cd, 'countdown element present');
  assert.strictEqual(cd.props.date, '2026-11-11T00:00:00');
  assert.strictEqual(cd.props.numberColor, '#ffffff');
  const flat = JSON.stringify(section);
  assert.ok(flat.includes('11.11.2026'), 'the date is printed as text too');
  assert.ok(flat.includes('הזמן אוזל'));
});

test('countdown: anything but a complete ISO date renders nothing', () => {
  const { composeLandingCountdown } = require('../landingSections.js');
  for (const bad of ['', '11.11.26', '2026-11', 'בקרוב', undefined]) {
    assert.strictEqual(composeLandingCountdown(PALETTE, { date: bad }).section, null);
  }
});

test('countdown: a cta renders a centered anchor-jump button under the date', () => {
  const { composeLandingCountdown } = require('../landingSections.js');
  const { section } = composeLandingCountdown(PALETTE, {
    date: '2026-11-11', label: 'הזמן אוזל', language: 'he',
    cta: { text: 'הרשמו עכשיו', anchor: 'sec-leadform' },
  });
  const [btn] = collect(section, 'button');
  assert.ok(btn, 'cta button present');
  assert.strictEqual(btn.props.text, 'הרשמו עכשיו');
  assert.deepStrictEqual(btn.props.onClick.link, { href: '#sec-leadform', protocol: 'anchor:' });
  assert.strictEqual(btn.props.style.borderRadius, '28px');
  assert.notStrictEqual(btn.props.style.position, 'fixed', 'in flow, not fixed');
});

test('countdown: no cta, no button anywhere in the band', () => {
  const { composeLandingCountdown } = require('../landingSections.js');
  const { section } = composeLandingCountdown(PALETTE, { date: '2026-11-11', label: 'הזמן אוזל', language: 'he' });
  assert.strictEqual(collect(section, 'button').length, 0);
});

// ── hero ranking: photo beats stat field ─────────────────────────────────────

test('hero: with a photo AND stats, code now picks the photo (cinema-block)', () => {
  const { resolveLandingVariant } = require('../landingVocabulary.js');
  const copy = {
    heading: 'כל הקמפיינים שלכם במקום אחד, בלי לנהל שני כלים',
    image: 'https://images.pexels.com/x.jpeg',
    stats: [{ value: '14', label: 'יום' }, { value: '3,000+', label: 'לקוחות' }, { value: '149', label: 'שקל' }],
  };
  assert.strictEqual(resolveLandingVariant('hero', undefined, copy).variant, 'cinema-block');
});

test('hero: stats with NO photo still get coral-cut, the numbers are not orphaned', () => {
  const { resolveLandingVariant } = require('../landingVocabulary.js');
  const copy = {
    heading: 'כל הקמפיינים שלכם במקום אחד, בלי לנהל שני כלים',
    image: '',
    stats: [{ value: '14', label: 'יום' }, { value: '3,000+', label: 'לקוחות' }, { value: '149', label: 'שקל' }],
  };
  assert.strictEqual(resolveLandingVariant('hero', undefined, copy).variant, 'coral-cut');
});
