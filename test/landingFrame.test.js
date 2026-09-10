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
