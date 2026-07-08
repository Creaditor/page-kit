// @creaditor/page-kit — pure landing-page builder (catalog factories, brand
// tokens, palette mining, contrast repair, section composition).
//
// Extracted VERBATIM from editor-api/src/services/mcp.service.js (the MCP
// server's builder) so both the MCP server and studio's landing-chat ability
// compose identical, on-brand creaditor component trees from ONE source.
//
// PURE: no Redis, no Mongo, no editor-api models. Data in → component tree out.
// The only deps are `uuid` (client-side ids) and the catalog body data.
const { v4: uuidv4 } = require('uuid');
const CATALOG_BODIES = require('./catalog.json');

const parseColor = (str) => {
  if (typeof str !== 'string') return null;
  const s = str.trim();
  let m;
  if ((m = s.match(/^#([0-9a-f]{3})$/i))) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  if ((m = s.match(/^#([0-9a-f]{6})$/i))) {
    const n = m[1];
    return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16), a: 1 };
  }
  if ((m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i))) {
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  return null;
};

const toHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

// WCAG relative luminance (0 = black, 1 = white).
const relLuminance = ({ r, g, b }) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const saturation = ({ r, g, b }) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
};

// A readable near-black / near-white foreground for a given background.
const readableTextOn = (bg) => {
  const c = parseColor(bg);
  if (!c) return '#ffffff';
  return relLuminance(c) > 0.55 ? '#1a1a1a' : '#ffffff';
};

// WCAG contrast ratio between two colors (1 = none, 21 = max). Used to reject a
// brand "text" color that doesn't actually contrast the page background.
const contrastRatio = (a, b) => {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return 21;
  const la = relLuminance(ca);
  const lb = relLuminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// Fix ProseMirror textStyle mark colors that don't contrast the given background
// (recurses the doc, incl. list items) — so text is never invisible.
const repairMarks = (pmNode, bg) => {
  if (Array.isArray(pmNode)) return pmNode.forEach((n) => repairMarks(n, bg));
  if (!pmNode || typeof pmNode !== 'object') return;
  if (Array.isArray(pmNode.marks)) {
    pmNode.marks.forEach((mk) => {
      if (mk && mk.type === 'textStyle' && mk.attrs && typeof mk.attrs.color === 'string' && contrastRatio(mk.attrs.color, bg) < 3) {
        mk.attrs.color = readableTextOn(bg);
      }
    });
  }
  if (Array.isArray(pmNode.content)) repairMarks(pmNode.content, bg);
};

// Walk a component subtree tracking the nearest explicit background, and repair
// any low-contrast text so nothing renders invisible (e.g. white-on-white when a
// section is transparent over a light page). Mutates in place.
const repairTextContrast = (node, bg = '#ffffff') => {
  if (Array.isArray(node)) {
    node.forEach((n) => repairTextContrast(n, bg));
    return node;
  }
  if (!node || typeof node !== 'object') return node;
  let curBg = bg;
  const nb = node.props && node.props.style && node.props.style.background;
  if (typeof nb === 'string' && nb && nb !== 'transparent') curBg = nb;
  if (node.type === 'text' && node.props && node.props.text && node.props.text.childNodes) {
    repairMarks(node.props.text.childNodes, curBg);
  }
  if (Array.isArray(node.children)) node.children.forEach((ch) => repairTextContrast(ch, curBg));
  return node;
};

// Walk a site's components (+ any theme colors) and rank the colors actually in
// use into a normalized brand palette. Chromatic colors become primary/secondary/
// accent by frequency; the darkest/lightest neutrals become text/background.
const extractPalette = (components = [], themeColors = []) => {
  const counts = new Map();
  const add = (str) => {
    const c = parseColor(str);
    if (!c || c.a < 0.4) return; // ignore transparent overlays
    const hex = toHex(c);
    counts.set(hex, (counts.get(hex) || 0) + 1);
  };
  (themeColors || []).forEach(add);
  const COLOR_KEY = /(color|background|fill|border)/i;
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k in o) {
      const v = o[k];
      if (typeof v === 'string') {
        // A value like "6px solid #f57f17" carries a color inside a shorthand.
        if (COLOR_KEY.test(k)) (v.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || []).forEach(add);
      } else if (v && typeof v === 'object') {
        walk(v);
      }
    }
  };
  components.forEach(walk);

  const entries = [...counts.entries()].map(([hex, n]) => {
    const c = parseColor(hex);
    return { hex, n, lum: relLuminance(c), sat: saturation(c) };
  });
  const isChromatic = (e) => e.sat >= 0.15 && e.lum > 0.05 && e.lum < 0.95;
  const chromatic = entries.filter(isChromatic).sort((a, b) => b.n - a.n);
  const neutrals = entries.filter((e) => !isChromatic(e)).sort((a, b) => a.lum - b.lum);
  const primary = (chromatic[0] && chromatic[0].hex) || null;
  const secondary = (chromatic.find((e) => e.hex !== primary) || {}).hex || null;
  const accent = (chromatic.find((e) => e.hex !== primary && e.hex !== secondary) || {}).hex || null;
  return {
    primary,
    secondary,
    accent,
    text: (neutrals[0] && neutrals[0].hex) || null,
    background: (neutrals[neutrals.length - 1] && neutrals[neutrals.length - 1].hex) || null,
    all: entries.sort((a, b) => b.n - a.n).map((e) => e.hex),
  };
};

// Resolve a brand token ('primary'/'secondary'/'accent'/'text'/'surface') to its
// palette hex so the client can style on-brand without hardcoding colors. Any
// other value (a real color, a gradient, 'transparent'…) passes through untouched.
const COLOR_TOKENS = ['primary', 'secondary', 'accent', 'text', 'background'];
const resolveColorToken = (value, palette = {}) => {
  if (typeof value !== 'string') return value;
  const key = value.trim().toLowerCase();
  if (key === 'surface') return palette.background || value;
  if (COLOR_TOKENS.includes(key)) return palette[key] || value;
  return value;
};

// Walk a style object and swap brand tokens inside color-ish props for palette hex.
const COLORISH_KEY = /(color|background|fill|border|shadow|gradient|outline)/i;
const resolveStyleTokens = (style = {}, palette = {}) => {
  const out = {};
  for (const k in style) {
    const v = style[k];
    out[k] = typeof v === 'string' && COLORISH_KEY.test(k) ? resolveColorToken(v, palette) : v;
  }
  return out;
};

// Recursively resolve brand tokens throughout a whole component tree (used by
// section templates): color-ish props anywhere, plus retinting icon-CDN urls to
// the brand primary. Mutates in place.
const resolveTreeTokens = (node, palette = {}) => {
  if (Array.isArray(node)) {
    node.forEach((n) => resolveTreeTokens(n, palette));
    return node;
  }
  if (!node || typeof node !== 'object') return node;
  for (const k in node) {
    const v = node[k];
    if (typeof v === 'string' && COLORISH_KEY.test(k)) {
      node[k] = resolveColorToken(v, palette);
    } else if (typeof v === 'string' && k === 'src' && /img\.creaditor\.ai\/icons/.test(v)) {
      node[k] = v.replace(/color=[^&]*/i, `color=${String(palette.primary || '#000000').replace('#', '')}`);
    } else if (v && typeof v === 'object') {
      resolveTreeTokens(v, palette);
    }
  }
  return node;
};

// ---- Component-body factories ----
// Produce valid component bodies for CREATE transactions (see app.js), matching
// the real shapes stored in the DB so they render correctly. Each node needs a
// unique `id` (app.js sets _id = id and assigns static_id/siteId itself).
const cid = () => `cdtr-${uuidv4()}`;

const makeText = (text, opts = {}) => {
  const { fontSize = '16px', color = 'rgb(56, 56, 56)', fontFamily = 'Arial', align = 'right', direction = 'rtl', bold = false } = opts;
  const marks = [{ type: 'textStyle', attrs: { fontFamily, fontSize, color } }];
  if (bold) marks.push({ type: 'bold' });
  return {
    id: cid(),
    type: 'text',
    children: [],
    props: {
      text: {
        childNodes: {
          type: 'doc',
          content: [
            { type: 'paragraph', attrs: { lineHeight: '1.4', direction, textAlign: align }, content: [{ marks, type: 'text', text: String(text || '') }] },
          ],
        },
      },
    },
  };
};

const makeButton = (text, opts = {}) => {
  const { href = '#', target = '_blank', background = '#6c47ff', color = '#ffffff', fontSize = '20px', borderRadius = '8px', direction = 'rtl' } = opts;
  return {
    id: cid(),
    type: 'button',
    children: [],
    props: {
      text: String(text || 'Button'),
      style: { height: 'auto', width: 'auto', maxWidth: '100%', minWidth: '30px', background, color, borderRadius, fontFamily: 'Assistant, Arial, Helvetica, sans-serif', fontSize, direction, paddingTop: '14px', paddingBottom: '14px', paddingLeft: '32px', paddingRight: '32px' },
      interactions: [],
      show_on_desktop: true,
      show_on_tablet: true,
      show_on_mobile: true,
      onClick: { link: { href, target } },
    },
  };
};

const makeImage = (src, opts = {}) => {
  const { alt = '', width = 600, height = 400 } = opts;
  // Fall back to the platform placeholder so an image without a src still renders.
  const finalSrc = String(src || `https://api.creaditor.com/images/placeholder?width=${width}&height=${height}`);
  return { id: cid(), type: 'image', children: [], props: { src: finalSrc, alt, width, height, style: { width: '100%', height: 'auto', maxWidth: `${width}px` } } };
};

const makeDivider = (opts = {}) => {
  const { color = '#dddddd', thickness = '2px', width = '100%' } = opts;
  return { id: cid(), type: 'divider', children: [], props: { width, height: thickness, background: color, interactions: [], show_on_desktop: true, show_on_tablet: true, show_on_mobile: true, style: { width, borderTopWidth: thickness, borderTopStyle: 'solid', borderTopColor: color } } };
};

const makeSpacer = (opts = {}) => {
  const h = opts.height || 25;
  return { id: cid(), type: 'spacer', children: [], props: { height: h, size: `${h}px`, style: {}, interactions: [], show_on_desktop: true, show_on_tablet: true, show_on_mobile: true } };
};

// Friendly names → the platform icon set (img.creaditor.ai/icons/serve/System/*),
// used for bullet/icon lists. Confirmed-available names only.
const ICON_NAMES = {
  check: 'check-fill',
  'check-circle': 'checkbox-circle-fill',
  checkbox: 'checkbox-fill',
  bullet: 'checkbox-blank-circle-fill',
  dot: 'checkbox-blank-circle-fill',
  star: 'star-fill',
  x: 'close-fill',
  close: 'close-fill',
  cross: 'close-fill',
  shield: 'shield-check-fill',
  secure: 'shield-check-fill',
  like: 'thumb-up-fill',
  'thumbs-up': 'thumb-up-fill',
  clock: 'time-fill',
  time: 'time-fill',
  info: 'information-fill',
  warning: 'error-warning-fill',
  alert: 'error-warning-fill',
  plus: 'add-fill',
  add: 'add-fill',
  settings: 'settings-3-fill',
};

// Build an icon URL for a bullet item: accepts a full http(s) URL (color is
// enforced) or a friendly/library name; bakes width/height/color params in.
const iconUrl = (name, fill) => {
  const raw = String(name || 'check');
  const hex = String(fill || '#000000').replace('#', '');
  if (/^https?:\/\//i.test(raw)) {
    const sep = raw.includes('?') ? '&' : '?';
    const base = raw.replace(/([?&])(width|height|color)=[^&]*/gi, '').replace(/[?&]$/, '');
    return `${base}${sep}width=24&height=24&color=${hex}`;
  }
  const slug = ICON_NAMES[raw.toLowerCase()] || (raw.includes('-') ? raw : 'check-fill');
  return `https://img.creaditor.ai/icons/serve/System/${slug}.png?width=24&height=24&color=${hex}`;
};

// A bullet / icon list — a `text` component whose ProseMirror doc is a
// customBulletList of customBulletItems. Each item carries an svgIcon, so this
// is BOTH "text with bullets" and "text with icons" (dot icon = plain bullet).
const makeList = (items = [], opts = {}) => {
  const {
    color = 'rgb(56, 56, 56)',
    fontFamily = 'Assistant, Arial, Helvetica, sans-serif',
    fontSize = '20px',
    direction = 'rtl',
    align = 'right',
    icon = 'check',
    iconColor = '#000000',
  } = opts;
  const svgIcon = iconUrl(icon, iconColor);
  const rows = (Array.isArray(items) && items.length ? items : ['']).map((t) => ({
    type: 'customBulletItem',
    attrs: { svgIcon, width: 24, height: 24, mt: 0, fill: iconColor },
    content: [
      {
        type: 'paragraph',
        attrs: { lineHeight: '1.5', direction, textAlign: align },
        content: [{ type: 'text', text: String(t || ''), marks: [{ type: 'textStyle', attrs: { fontSize, fontFamily, color } }] }],
      },
    ],
  }));
  return {
    id: cid(),
    type: 'text',
    children: [],
    props: {
      text: {
        childNodes: {
          type: 'doc',
          content: [{ type: 'customBulletList', attrs: { lineHeight: '1.5', direction, textAlign: align }, content: rows }],
        },
      },
    },
  };
};

// Give a cloned catalog body (and its children / social-style items) fresh ids,
// so app.js persists it without id collisions.
const assignFreshIds = (node) => {
  if (!node || typeof node !== 'object') return node;
  node.id = cid();
  if (Array.isArray(node.children)) node.children.forEach(assignFreshIds);
  if (node.props && Array.isArray(node.props.items)) {
    node.props.items.forEach((it) => {
      if (it && typeof it === 'object' && it.id === 'ID_PLACEHOLDER') it.id = cid();
    });
  }
  return node;
};

// Build one of the richer catalog elements (map, icon, video, form, chart…) from
// its extracted default body. `spec.props` deep-merges over the defaults and
// `spec.style` / brand tokens are resolved, so e.g.
// add_element(type:'map', props:{ address:'תל אביב' }) just works.
const buildCatalogElement = (type, spec = {}, palette = {}) => {
  const def = CATALOG_BODIES[type];
  if (!def) throw new Error(`Unknown element type "${type}".`);
  const body = assignFreshIds(JSON.parse(JSON.stringify(def.body)));
  body.props = body.props || {};
  // Convenience shorthands common enough to hoist out of `props`.
  if (spec.address !== undefined) body.props.address = spec.address; // map
  if (spec.src !== undefined && 'src' in body.props) body.props.src = spec.src; // image/icon/iframe/giphy
  if (spec.url !== undefined && 'url' in body.props) body.props.url = spec.url; // video
  if (spec.link !== undefined && 'link' in body.props) body.props.link = spec.link; // qr
  if (spec.props && typeof spec.props === 'object') {
    const resolvedTop = resolveStyleTokens(spec.props, palette); // swaps color-ish top-level props (containerBg, numberColor…)
    const style = { ...(body.props.style || {}), ...resolveStyleTokens(spec.props.style || {}, palette) };
    body.props = { ...body.props, ...resolvedTop, style };
  }
  if (spec.style && typeof spec.style === 'object') {
    body.props.style = { ...(body.props.style || {}), ...resolveStyleTokens(spec.style, palette) };
  }
  return body;
};

// Dispatch a caller spec → a valid element body. Core content types use tuned,
// palette-aware factories; everything else falls through to the catalog defaults.
// `palette` supplies on-brand defaults so an element is on-brand even when the
// caller omits explicit colors; an explicit spec.color/background always wins.
const buildElement = (spec = {}, palette = {}) => {
  const dir = spec.direction; // undefined falls through to factory defaults
  const align = spec.align;
  switch (spec.type) {
    case 'heading':
      return makeText(spec.text, {
        fontSize: spec.fontSize || '34px',
        color: spec.color || palette.text || 'rgb(56, 56, 56)',
        align, direction: dir,
        bold: true,
      });
    case 'text':
      return makeText(spec.text, {
        fontSize: spec.fontSize || '16px',
        color: spec.color || palette.text || 'rgb(56, 56, 56)',
        align, direction: dir,
      });
    case 'list':
      // Bullet / icon list. Icon defaults to a brand-colored check; pass a name
      // (check, star, dot, shield, x…) or an icon URL, and iconColor.
      return makeList(spec.items, {
        fontSize: spec.fontSize || '20px',
        color: spec.color || palette.text || 'rgb(56, 56, 56)',
        align, direction: dir,
        icon: spec.icon || 'check',
        iconColor: spec.iconColor || palette.primary || '#000000',
      });
    case 'button': {
      const background = spec.background || palette.primary || '#6c47ff';
      return makeButton(spec.text, { href: spec.href, background, color: spec.color || readableTextOn(background), direction: dir });
    }
    case 'image':
      return makeImage(spec.src, { alt: spec.alt, width: spec.width, height: spec.height });
    case 'divider':
      return makeDivider({ color: spec.color });
    case 'spacer':
      return makeSpacer({ height: spec.height });
    default:
      // Any of the richer catalog elements (map, icon, card, video, social,
      // form, accordion, count-up, countdown, charts, qr, iframe, html, ai…).
      if (CATALOG_BODIES[spec.type]) return buildCatalogElement(spec.type, spec, palette);
      throw new Error(
        `Unsupported element type "${spec.type}". Core: heading, text, list, button, image, divider, spacer. ` +
          `Plus: ${Object.keys(CATALOG_BODIES).sort().join(', ')}.`
      );
  }
};

// A fresh section → block → col(s) subtree, with layout + styling baked into
// props.style. `columns` is an array of 12-grid widths (e.g. [8,4] for a
// content+media split, [4,4,4] for a 3-up grid); defaults to a single full col.
const makeSection = (opts = {}) => {
  const {
    columns = [12],
    background = 'transparent',
    padding = '72px 48px',
    align = 'center',
    maxWidth = '1100px',
    minHeight = '40vh',
    style = {},
    colChildren = [],
    colStyles = [],
  } = opts;
  const widths = Array.isArray(columns) && columns.length ? columns : [12];
  // colChildren[i] = the element bodies to nest inside column i (used by
  // build_section to emit a whole populated section as one atomic CREATE).
  // colStyles[i] = optional style object merged into column i's props.style
  // (used for card-like appearances: background, borderRadius, boxShadow…).
  const cols = widths.map((w, i) => ({
    id: cid(),
    type: 'col',
    children: Array.isArray(colChildren[i]) ? colChildren[i] : [],
    props: { style: (Array.isArray(colStyles) && colStyles[i]) ? { ...colStyles[i] } : {}, lg: w, justify: align },
  }));
  const block = {
    id: cid(),
    type: 'block',
    // Column layout is handled by the cdtr-col grid (col.lg sums to 12, wrapping
    // container), so the block only needs width/maxWidth/padding — matching the
    // editor's own splitter output.
    children: cols,
    props: { style: { width: '100%', maxWidth, padding } },
  };
  const section = {
    id: cid(),
    type: 'section',
    layer: '1',
    children: [block],
    props: { opacity: 1, classList: [], style: { minHeight, background, width: '100%', ...style } },
  };
  return { section, sectionId: section.id, blockId: block.id, colIds: cols.map((c) => c.id) };
};

// Spread N items across a 12-grid: 1→[12], 2→[6,6], 3→[4,4,4], 4→[3,3,3,3],
// more→4s (wrap 3 per row). Used by the multi-item section patterns.
const spreadWidths = (n) => {
  if (n <= 1) return [12];
  if (n === 2) return [6, 6];
  if (n === 3) return [4, 4, 4];
  if (n === 4) return [3, 3, 3, 3];
  return Array.from({ length: n }, () => 4);
};

// Detect CSS gradient values (linear-gradient, radial-gradient, conic-gradient).
// Gradients are valid section backgrounds but cannot be parsed as a single color,
// so readableTextOn defaults to white — which is correct for typical dark/vibrant
// gradient hero and CTA bands.
const isGradient = (v) => typeof v === 'string' && /gradient\s*\(/i.test(v);

// Compose a whole, on-brand section from a named pattern. Returns a fully nested
// section→block→cols→elements body (published as ONE atomic CREATE — app.js
// recurses children, so no multi-call orchestration). Colors derive from the
// palette; on a colored background, text/headings flip to a readable contrast.
const composeSection = (pattern, args = {}, palette = {}, pageBg = '#ffffff', lang = 'he') => {
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const textAlign = lang === 'he' ? 'right' : 'left';
  const el = (spec) => buildElement({ ...spec, align: spec.align || textAlign, direction: dir }, palette);
  const heading = (text, fontSize, color) => el({ type: 'heading', text: text || '', fontSize, color });
  const para = (text, color) => el({ type: 'text', text: text || '', color });
  const spacer = (height) => buildElement({ type: 'spacer', height }, palette);
  const button = (b, background) => (b && b.text ? buildElement({ type: 'button', text: b.text, href: b.href, background, direction: dir }, palette) : null);
  const compact = (arr) => arr.filter(Boolean);
  const resolvedBg = args.background ? resolveColorToken(args.background, palette) : undefined;
  const onColored = resolvedBg && resolvedBg !== 'transparent';
  // Text must contrast the ACTUAL background: the colored band if set, else the
  // page background (transparent sections show the page, usually light).
  // Gradients can't be parsed as a single color — assume dark/vibrant → white text.
  const fg = isGradient(resolvedBg) ? '#ffffff' : readableTextOn(onColored ? resolvedBg : pageBg);
  const mutedFg = onColored || isGradient(resolvedBg) ? fg : (palette.text ? palette.text + 'cc' : '#4a5568');
  const header = (h, sub) => compact([h ? heading(h, '40px', fg) : null, sub ? spacer(14) : null, sub ? para(sub, mutedFg) : null, spacer(40)]);
  // Centered header for card-based sections (features, testimonials, how-it-works, pricing, stats).
  const centeredHeading = (text, fontSize, color) => buildElement({ type: 'heading', text: text || '', fontSize, color, align: 'center', direction: dir }, palette);
  const centeredPara = (text, color) => buildElement({ type: 'text', text: text || '', color, align: 'center', direction: dir }, palette);
  const centeredHeader = (h, sub) => compact([h ? centeredHeading(h, '40px', fg) : null, sub ? spacer(12) : null, sub ? centeredPara(sub, mutedFg) : null, spacer(40)]);

  switch (pattern) {
    case 'hero': {
      const hasImg = !!args.image;
      const heroSubFg = onColored || isGradient(resolvedBg) ? fg : mutedFg;
      const col0 = compact([
        heading(args.heading || 'Your headline here', '56px', fg),
        spacer(24),
        args.subheading ? para(args.subheading, heroSubFg) : null,
        spacer(40),
        button(args.cta, palette.primary),
      ]);
      const colChildren = hasImg ? [col0, compact([el({ type: 'image', src: args.image })])] : [col0];
      return makeSection({ columns: hasImg ? [7, 5] : [12], background: resolvedBg, minHeight: '70vh', align: hasImg ? 'flex-start' : 'center', colChildren, style: { paddingTop: '80px', paddingBottom: '80px' } });
    }
    case 'cta': {
      // Default to a gradient band when no explicit background — looks much richer than a flat color.
      const defaultGrad = palette.primary && palette.secondary
        ? `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`
        : palette.primary || '#6c47ff';
      const bg = resolvedBg || defaultGrad;
      const on = isGradient(bg) ? '#ffffff' : readableTextOn(bg);
      const col0 = compact([
        heading(args.heading || 'Ready to get started?', '40px', on),
        spacer(16),
        args.subheading ? para(args.subheading, on) : null,
        spacer(36),
        button(args.cta, '#ffffff'), // white button pops on the gradient/colored band
      ]);
      return makeSection({ columns: [12], background: bg, align: 'center', minHeight: '40vh', colChildren: [col0], style: { borderRadius: '24px' } });
    }
    case 'features': {
      const items = Array.isArray(args.items) ? args.items : [];
      const widths = spreadWidths(items.length || 1);
      const columns = [];
      const colChildren = [];
      const colStyles = [];
      if (args.heading || args.subheading) { columns.push(12); colChildren.push(centeredHeader(args.heading, args.subheading)); colStyles.push({}); }
      // Cards are ON by default — only skip with explicit card_style: false.
      const useCards = args.card_style !== false;
      const cardStyle = useCards ? { background: '#ffffff', borderRadius: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '40px 28px 36px', margin: '8px' } : {};
      const itemFg = useCards ? readableTextOn('#ffffff') : fg;
      const itemMuted = useCards ? '#6b7280' : mutedFg;
      const iconBg = (palette.primary || '#6c47ff') + '1a'; // 10% opacity brand tint for icon circle
      // Default icons when none specified — gives every card a visual anchor.
      const defaultIcons = ['star', 'shield', 'check-circle', 'settings', 'like', 'clock'];
      items.forEach((it, i) => {
        const iconName = it.icon || defaultIcons[i % defaultIcons.length];
        columns.push(widths[i]);
        colChildren.push(compact([
          el({ type: 'icon', props: { src: iconUrl(iconName, palette.primary || '#000000').replace('width=24&height=24', 'width=48&height=48'), style: { width: '56px', height: '56px', padding: '4px', borderRadius: '50%', background: iconBg } } }),
          spacer(24),
          heading(it.title, '20px', itemFg),
          spacer(12),
          it.text ? para(it.text, itemMuted) : null,
        ]));
        colStyles.push(cardStyle);
      });
      // Default section bg to a subtle gray so white cards pop.
      const sectionBg = resolvedBg || '#f5f7fb';
      return makeSection({ columns: columns.length ? columns : [12], background: sectionBg, align: 'center', colChildren, colStyles });
    }
    case 'pricing': {
      const tiers = Array.isArray(args.tiers) ? args.tiers : [];
      const widths = spreadWidths(tiers.length || 1);
      const columns = [];
      const colChildren = [];
      const colStyles = [];
      if (args.heading || args.subheading) { columns.push(12); colChildren.push(centeredHeader(args.heading, args.subheading)); colStyles.push({}); }
      const cardStyle = { background: '#ffffff', borderRadius: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '40px 28px 36px', margin: '8px' };
      const tierFg = '#111827';
      tiers.forEach((t, i) => {
        columns.push(widths[i]);
        colChildren.push(compact([
          heading(t.name, '24px', tierFg),
          spacer(8),
          heading(t.price, '40px', palette.primary || tierFg),
          spacer(16),
          Array.isArray(t.features) && t.features.length ? el({ type: 'list', items: t.features, icon: 'check', iconColor: palette.primary }) : null,
          t.cta ? spacer(16) : null,
          button(t.cta, palette.primary),
        ]));
        colStyles.push(cardStyle);
      });
      const sectionBg = resolvedBg || '#f5f7fb';
      return makeSection({ columns: columns.length ? columns : [12], background: sectionBg, align: 'center', colChildren, colStyles });
    }
    case 'faq': {
      const items = (Array.isArray(args.items) ? args.items : []).map((it) => ({ title: it.title || it.question || '', content: it.content || it.answer || '' }));
      const col0 = compact([
        heading(args.heading || 'FAQ', '34px', fg),
        args.subheading ? para(args.subheading, fg) : null,
        spacer(16),
        buildCatalogElement('accordion', { props: { items } }, palette),
      ]);
      return makeSection({ columns: [12], background: resolvedBg, align: 'center', minHeight: 'auto', colChildren: [col0] });
    }
    case 'stats': {
      const items = Array.isArray(args.items) ? args.items : [];
      const widths = spreadWidths(items.length || 1);
      const columns = [];
      const colChildren = [];
      const colStyles = [];
      if (args.heading) { columns.push(12); colChildren.push(compact([centeredHeading(args.heading, '40px', fg)])); colStyles.push({}); }
      // On a colored/gradient band, use semi-transparent white cards; on light bg, use solid white cards.
      const onDark = onColored || isGradient(resolvedBg);
      const statCard = onDark
        ? { background: 'rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px 16px', margin: '8px' }
        : { background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '24px 16px', margin: '8px' };
      items.forEach((it, i) => {
        columns.push(widths[i]);
        colChildren.push(compact([
          el({ type: 'count-up', props: { endVal: Number(it.value) || 0, suffix: it.suffix || '', prefix: it.prefix || '', style: { fontSize: '56px', color: onDark ? '#ffffff' : (palette.primary || fg || '#000000'), fontWeight: 'bold' } } }),
          spacer(8),
          it.label ? para(it.label, fg) : null,
        ]));
        colStyles.push(statCard);
      });
      const sectionBg = resolvedBg || '#f5f7fb';
      return makeSection({ columns: columns.length ? columns : [12], background: sectionBg, align: 'center', colChildren, colStyles });
    }
    case 'testimonials': {
      const items = Array.isArray(args.items) ? args.items : [];
      const widths = spreadWidths(items.length || 1);
      const columns = [];
      const colChildren = [];
      const colStyles = [];
      if (args.heading || args.subheading) { columns.push(12); colChildren.push(centeredHeader(args.heading, args.subheading)); colStyles.push({}); }
      const cardStyle = { background: '#ffffff', borderRadius: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '36px 28px', margin: '8px' };
      items.forEach((it, i) => {
        columns.push(widths[i]);
        colChildren.push(compact([
          // Star rating
          para('\u2B50\u2B50\u2B50\u2B50\u2B50', '#f59e0b'),
          spacer(14),
          para(`\u201C${it.text}\u201D`, '#374151'),
          spacer(20),
          heading(it.title, '15px', '#111827'),
        ]));
        colStyles.push(cardStyle);
      });
      const sectionBg = resolvedBg || '#f5f7fb';
      return makeSection({ columns: columns.length ? columns : [12], background: sectionBg, align: 'center', colChildren, colStyles });
    }
    case 'how-it-works': {
      const items = Array.isArray(args.items) ? args.items : [];
      const widths = spreadWidths(items.length || 1);
      const columns = [];
      const colChildren = [];
      const colStyles = [];
      if (args.heading || args.subheading) { columns.push(12); colChildren.push(centeredHeader(args.heading, args.subheading)); colStyles.push({}); }
      const stepCard = { background: '#ffffff', borderRadius: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '40px 28px 36px', margin: '8px' };
      const numBg = (palette.primary || '#6c47ff') + '1a';
      items.forEach((it, i) => {
        columns.push(widths[i]);
        colChildren.push(compact([
          // Step number as styled text in a brand-tinted circle
          heading(String(i + 1), '28px', palette.primary || '#6c47ff'),
          spacer(20),
          heading(it.title, '20px', '#111827'),
          spacer(12),
          it.text ? para(it.text, '#6b7280') : null,
        ]));
        colStyles.push(stepCard);
      });
      const sectionBg = resolvedBg || '#f5f7fb';
      return makeSection({ columns: columns.length ? columns : [12], background: sectionBg, align: 'center', colChildren, colStyles });
    }
    default:
      throw new Error(`Unknown pattern "${pattern}". Use: hero, features, pricing, cta, faq, stats, testimonials, how-it-works.`);
  }
};

module.exports = {
  parseColor, toHex, relLuminance, saturation, readableTextOn, contrastRatio,
  repairMarks, repairTextContrast,
  extractPalette, resolveColorToken, resolveStyleTokens, resolveTreeTokens,
  cid, makeText, makeButton, makeImage, makeDivider, makeSpacer, iconUrl, makeList,
  assignFreshIds, buildCatalogElement, buildElement, makeSection, spreadWidths, composeSection,
  isGradient, CATALOG_BODIES,
};
