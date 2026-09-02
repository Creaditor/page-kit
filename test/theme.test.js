/**
 * Independent gate on `deriveTheme`, the shared six-brand fixture ported from
 * `.planning/sketches/verify.cjs` in cdtr-studio.
 *
 * Gates, per brand: onDarkRatio >= 4.5, onLightRatio >= 4.5, textRatio >= 12,
 * inkRatio >= 12. Plus one assertion the sketch only checked by eye: the six
 * brands must produce at least five distinct ON_DARK values, guarding against
 * the earlier gold-first regression that collapsed four of six brands onto
 * the same #ddae40.
 *
 * No em-dash (U+2014) and no en-dash (U+2013) anywhere in this file.
 */
const test = require('node:test');
const assert = require('node:assert');
const { deriveTheme } = require('../landingTheme.js');

const BRANDS = [
  ['#1b65a0', '#964462', 'SendMsg'],
  ['#D6336C', '#F5A3C7', 'beauty'],
  ['#4C9A2A', null, 'nature'],
  ['#1A1A1A', null, 'luxury'],
  ['#F2A413', '#E23B2E', 'food'],
  ['#C9B79C', '#BFB3A4', 'beige'],
];

test('every brand clears both grounds on its own accent', () => {
  for (const [primary, secondary, name] of BRANDS) {
    const t = deriveTheme(primary, secondary);
    assert.ok(+t.onDarkRatio >= 4.5, `${name}: onDarkRatio ${t.onDarkRatio} < 4.5`);
    assert.ok(+t.onLightRatio >= 4.5, `${name}: onLightRatio ${t.onLightRatio} < 4.5`);
    assert.ok(+t.textRatio >= 12, `${name}: textRatio ${t.textRatio} < 12`);
    assert.ok(+t.inkRatio >= 12, `${name}: inkRatio ${t.inkRatio} < 12`);
  }
});

test('six brands produce at least five distinct ON_DARK accents', () => {
  const seen = new Set();
  for (const [primary, secondary] of BRANDS) {
    seen.add(deriveTheme(primary, secondary).ON_DARK);
  }
  assert.ok(seen.size >= 5, `only ${seen.size} distinct ON_DARK values across six brands, expected at least 5`);
});
