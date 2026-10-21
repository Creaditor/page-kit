/**
 * Every col the MCP builder emits must stack its children.
 *
 * The render service lays a col's children out in MUI's default row + wrap
 * unless the col's own style sets flexDirection; the editor always stacks
 * them. A col with an empty style therefore looks right in the editor and
 * publishes its heading, text and button side by side on one wrapping row.
 *
 * No em-dash (U+2014) and no en-dash (U+2013) anywhere in this file.
 */
const test = require('node:test');
const assert = require('node:assert');
const { makeSection, composeSection, SECTION_TEMPLATES } = require('../index.js');

const colsOf = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((n) => colsOf(n, out));
  else if (node && typeof node === 'object') {
    if (node.type === 'col') out.push(node);
    Object.values(node).forEach((v) => colsOf(v, out));
  }
  return out;
};

const assertStacks = (cols, where) => {
  assert.ok(cols.length > 0, `${where}: no cols found`);
  cols.forEach((c, i) => {
    assert.strictEqual(c.props.style.display, 'flex', `${where} col ${i}: display`);
    assert.strictEqual(c.props.style.flexDirection, 'column', `${where} col ${i}: flexDirection`);
  });
};

test('makeSection cols stack', () => {
  assertStacks(colsOf(makeSection({ columns: [4, 4, 4] }).section), 'makeSection');
});

test('makeSection keeps card styles on top of the stacking', () => {
  const { section } = makeSection({ columns: [6, 6], colStyles: [{ background: '#fff', borderRadius: '20px' }] });
  const [card, plain] = colsOf(section);
  assert.strictEqual(card.props.style.background, '#fff');
  assert.strictEqual(card.props.style.flexDirection, 'column');
  assert.strictEqual(plain.props.style.flexDirection, 'column');
});

const PATTERN_ARGS = {
  hero: { heading: 'H', subheading: 'S', button: { text: 'Go', href: '#' }, image: 'https://example.com/a.jpg' },
  cta: { heading: 'H', button: { text: 'Go', href: '#' } },
  features: { heading: 'H', subheading: 'S', items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] },
  pricing: { heading: 'H', tiers: [{ name: 'a', price: '1' }, { name: 'b', price: '2' }] },
  faq: { heading: 'H', items: [{ q: 'q', a: 'a' }] },
  stats: { heading: 'H', items: [{ value: 10, label: 'x' }, { value: 20, label: 'y' }] },
  testimonials: { heading: 'H', items: [{ quote: 'q', name: 'n' }] },
  'how-it-works': { heading: 'H', steps: [{ title: 'a' }, { title: 'b' }] },
  footer: { text: 'f' },
};

for (const [pattern, args] of Object.entries(PATTERN_ARGS)) {
  test(`composeSection ${pattern} cols stack`, () => {
    assertStacks(colsOf(composeSection(pattern, args, { primary: '#1a66a1' }).section), pattern);
  });
}

test('section templates cols stack', () => {
  SECTION_TEMPLATES.forEach((t) => assertStacks(colsOf(t.body), `template ${t.id}`));
});
