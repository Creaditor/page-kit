/**
 * LANDING_VOCABULARY, the single declaration of what a landing page can be
 * built from.
 *
 * Why this exists as DATA rather than as knowledge split across two repos:
 *
 * cdtr-studio used to hardcode the list of section patterns in its own Zod
 * schema and again in its prompt. That is the same failure that produced the
 * 2026-09-01 incident where `landingSections.js` existed in three states at
 * once (page-kit main 236 lines, its landing branch 299, the copy installed in
 * studio 243, matching neither) and Hebrew card rows shipped laying out
 * left-to-right for months. A hardcoded list is that bug one level up: studio
 * asks for something this file cannot render, and nothing catches it.
 *
 * So studio derives BOTH its validation enum and the menu it shows the model
 * from this object, at runtime. An unrenderable request becomes impossible to
 * express, and the prompt cannot drift from the renderer.
 *
 * `description` fields are written for a language model to read. They end up
 * verbatim in the generation prompt, so they describe when to REACH for a
 * thing, not what it looks like.
 *
 * No em-dash (U+2014) and no en-dash (U+2013) anywhere in this file.
 */

/**
 * @typedef {object} VariantSpec
 * @property {string} description  what this variant is for, written for the model
 * @property {string[]} needs      copy fields without which this variant cannot render
 * @property {string[]} [optional] copy fields it will use if present
 */

/**
 * @typedef {object} PatternSpec
 * @property {string} description
 * @property {string} default      variant used when none is given, or when the
 *                                 requested one is unknown or unsatisfiable
 * @property {Record<string, VariantSpec>} variants
 */

/** @type {Record<string, PatternSpec>} */
const LANDING_VOCABULARY = {
  hero: {
    description: 'The opening statement. Every page has exactly one, first.',
    default: 'centered',
    variants: {
      centered: {
        description: 'Headline, subheading and CTA stacked and centered on a brand gradient. The safe default, and the only one that works with nothing but a headline.',
        needs: ['heading'],
        optional: ['eyebrow', 'subheading', 'cta'],
      },
      asymmetric: {
        description: 'Copy on one side, a feature image on the other. Use when the business has a real photograph of its product, place or work. Do not choose it for a generic stock photo.',
        needs: ['heading', 'image'],
        optional: ['eyebrow', 'subheading', 'cta'],
      },
      conversation: {
        description: 'Copy on one side, a short message exchange between the business and a customer on the other. Use when the offer is about staying in touch with customers, or when the business has no photograph worth showing. Needs `thread`: 2 to 4 messages, each { text, from: "business" | "customer", time }.',
        needs: ['heading', 'thread'],
        optional: ['eyebrow', 'subheading', 'cta'],
      },
      'gold-night': {
        description: 'Deep ink ground, a single gold accent, and a ruled row of numbers under the headline. Use when the business has round numbers worth leading with (a price, a count, a duration) and no photograph or second colour worth featuring.',
        needs: ['heading'],
        optional: ['eyebrow', 'subheading', 'cta', 'stats'],
      },
      'coral-cut': {
        description: 'Copy on one side, three numbers in their own accent-coloured field on the other. Use when the business has three short stats worth foregrounding and wants the most colour-forward opening.',
        needs: ['heading', 'stats'],
        optional: ['eyebrow', 'subheading', 'cta'],
      },
      'cinema-block': {
        description: 'Copy beside a tall narrow photograph. Use when the business has a real photograph of its product, place or work, for an opening with more atmosphere than `asymmetric`. The narrow crop asks far less of the image than a full-bleed band, so it tolerates an ordinary tenant photo where other photo variants would not.',
        needs: ['heading', 'image'],
        optional: ['eyebrow', 'subheading', 'cta'],
      },
    },
  },

  problem: {
    description: 'Name the pain the reader already feels. Do not sell here.',
    default: 'prose',
    variants: {
      prose: {
        description: 'One empathetic paragraph under a heading. Use when the pain is a single feeling.',
        needs: ['heading'],
        optional: ['eyebrow', 'paragraph'],
      },
      'badge-cards': {
        description: 'Two to four obstacles as numbered cards. Use when the reader faces several distinct blockers rather than one feeling. Needs `items`, each { title, text }.',
        needs: ['items'],
        optional: ['eyebrow', 'heading'],
      },
    },
  },

  audience: {
    description: 'Who this is for. Use when the offer is easy to mistake for someone else.',
    default: 'cards',
    variants: {
      cards: {
        description: 'Short "who benefits" lines as a row of cards.',
        needs: ['bullets'],
        optional: ['eyebrow', 'heading', 'paragraph'],
      },
    },
  },

  solution: {
    description: 'What you actually do about the problem.',
    default: 'bullets-image',
    variants: {
      'bullets-image': {
        description: 'Capability bullets beside a feature image. Needs an image to look right.',
        needs: ['bullets'],
        optional: ['eyebrow', 'heading', 'paragraph', 'image'],
      },
      conversation: {
        description: 'Each capability as a message the business sends, in a staggered thread. Use when the capabilities are things the business sends or says, and when no worthwhile photograph exists. Needs `thread`.',
        needs: ['thread'],
        optional: ['eyebrow', 'heading'],
      },
    },
  },

  testimonials: {
    description: 'Proof in a customer voice. Skip entirely rather than invent quotes.',
    default: 'quotes',
    variants: {
      quotes: {
        description: 'Quote cards in a row. Needs `items`, each { quote, name, role }.',
        needs: ['items'],
        optional: ['eyebrow', 'heading'],
      },
    },
  },

  whyBuy: {
    description: 'Reasons to choose you over the alternative.',
    default: 'cards',
    variants: {
      cards: {
        description: 'A short reason stated as prose under a heading.',
        needs: ['heading'],
        optional: ['eyebrow', 'paragraph'],
      },
    },
  },

  offer: {
    description: 'What the reader gets, concretely.',
    default: 'cards',
    variants: {
      cards: {
        description: 'The components of the offer as cards.',
        needs: ['bullets'],
        optional: ['eyebrow', 'heading', 'paragraph'],
      },
    },
  },

  bonuses: {
    description: 'Extras included. Only when they are real.',
    default: 'cards',
    variants: {
      cards: {
        description: 'Bonus items as cards. Needs `items`, each { title, text }.',
        needs: ['items'],
        optional: ['eyebrow', 'heading'],
      },
    },
  },

  pricing: {
    description: 'Price. One plan, stated plainly.',
    default: 'single',
    variants: {
      single: {
        description: 'One priced offer card, centered. Studio flattens tiers[0] into planName/price/features, so this renders a single plan, never a tier grid.',
        needs: ['price'],
        optional: ['eyebrow', 'heading', 'planName', 'features', 'regularNote', 'urgency', 'cta'],
      },
    },
  },

  guarantee: {
    description: 'Risk reversal. One short, confident statement.',
    default: 'panel',
    variants: {
      panel: {
        description: 'A single reassurance panel.',
        needs: ['heading'],
        optional: ['eyebrow', 'paragraph'],
      },
    },
  },

  leadform: {
    description: 'The conversion point. Every page needs one.',
    default: 'panel',
    variants: {
      panel: {
        description: 'Name, phone and email on a dark panel with a submit button.',
        needs: [],
        optional: ['eyebrow', 'heading', 'submit'],
      },
    },
  },

  about: {
    description: 'Who is behind this. Builds trust late, not early.',
    default: 'text-image',
    variants: {
      'text-image': {
        description: 'Paragraphs beside a photo. Needs `paragraphs` (an array).',
        needs: ['paragraphs'],
        optional: ['eyebrow', 'heading', 'image'],
      },
    },
  },

  faq: {
    description: 'Objections, answered. Use real objections only.',
    default: 'list',
    variants: {
      list: {
        description: 'Question and answer pairs. Needs `items`, each { q, a }.',
        needs: ['items'],
        optional: ['eyebrow', 'heading'],
      },
    },
  },

  articles: {
    description: 'Linked content cards, each with its own destination.',
    default: 'cards',
    variants: {
      cards: {
        description: 'Article cards with a thumbnail and a per-item link. Needs `items`.',
        needs: ['items'],
        optional: ['eyebrow', 'heading', 'cta'],
      },
    },
  },

  statbar: {
    description: 'Three or four numbers that make the offer concrete. Use PRODUCT FACTS (how many tools, what it costs, how long setup takes), never invented performance claims.',
    default: 'row',
    variants: {
      row: {
        description: 'A standalone dark bar. Needs `stats`, each { value, label }.',
        needs: ['stats'],
        optional: [],
      },
      overlap: {
        description: 'The same bar pulled up so it overlaps the section above. Only valid directly after a hero.',
        needs: ['stats'],
        optional: [],
      },
    },
  },

  announcement: {
    description: 'A thin strip above everything carrying one timely line (a date, a deadline, a free trial). Omit unless there is something genuinely time-bound to say.',
    default: 'bar',
    variants: {
      bar: {
        description: 'One short line, centered, no button. Needs `text`.',
        needs: ['text'],
        optional: [],
      },
    },
  },

  stickyCta: {
    description: 'A repeated ask placed late on the page, after the case is made.',
    default: 'panel',
    variants: {
      panel: {
        description: 'A full-width brand band with one button. Needs `cta`.',
        needs: ['cta'],
        optional: ['heading'],
      },
    },
  },

  finalcta: {
    description: 'The closing ask, after the case has been made.',
    default: 'panel',
    variants: {
      panel: {
        description: 'A full-width brand panel with one button.',
        needs: ['heading'],
        optional: ['eyebrow', 'subheading', 'cta'],
      },
    },
  },
};

/** Every pattern name, in a stable order. */
const LANDING_PATTERNS = Object.keys(LANDING_VOCABULARY);

/** Every `pattern:variant` pair, for exhaustive iteration in tests. */
function landingVariantPairs() {
  const out = [];
  for (const pattern of LANDING_PATTERNS) {
    for (const variant of Object.keys(LANDING_VOCABULARY[pattern].variants)) {
      out.push({ pattern, variant });
    }
  }
  return out;
}

/**
 * Resolve a requested variant to one that can actually be rendered.
 *
 * Never throws and never returns something unrenderable. Three ways to fall
 * back, in order:
 *   1. unknown pattern            -> null, the caller skips the section
 *   2. unknown variant            -> the pattern's default
 *   3. variant missing required copy -> the first variant whose `needs` are
 *      satisfied, else the default
 *
 * Case 3 is not defensive padding. Today `pricing` renders a multi-column tier
 * layout even when the model supplies one tier, which is how a landing page
 * ends up with a single card floating in dead space.
 *
 * @param {string} pattern
 * @param {string|undefined} variant
 * @param {object} copy
 * @returns {{pattern: string, variant: string, fellBackFrom: string|null}|null}
 */
function resolveLandingVariant(pattern, variant, copy = {}) {
  const spec = LANDING_VOCABULARY[pattern];
  if (!spec) return null;

  const has = (field) => {
    const v = copy[field];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    return v != null;
  };
  const satisfied = (name) => {
    const vs = spec.variants[name];
    return !!vs && vs.needs.every(has);
  };

  const requested = typeof variant === 'string' && variant ? variant : null;

  if (requested && spec.variants[requested]) {
    if (satisfied(requested)) return { pattern, variant: requested, fellBackFrom: null };
    const alt = Object.keys(spec.variants).find(satisfied);
    return { pattern, variant: alt || spec.default, fellBackFrom: requested };
  }

  // Unknown or absent variant: the default, unless its needs are unmet.
  if (satisfied(spec.default)) {
    return { pattern, variant: spec.default, fellBackFrom: requested };
  }
  const alt = Object.keys(spec.variants).find(satisfied);
  return { pattern, variant: alt || spec.default, fellBackFrom: requested };
}

/**
 * Render the vocabulary as the menu text a generation prompt shows the model.
 *
 * Generated rather than hand-written for the same reason studio derives its
 * enum from here: a hand-maintained prompt drifts from the renderer, and the
 * drift is invisible until a page comes out wrong.
 */
function describeLandingVocabulary() {
  const lines = [];
  for (const pattern of LANDING_PATTERNS) {
    const spec = LANDING_VOCABULARY[pattern];
    lines.push(`- ${pattern}: ${spec.description}`);
    for (const [name, v] of Object.entries(spec.variants)) {
      const needs = v.needs.length ? ` requires ${v.needs.join(', ')}.` : '';
      const dflt = name === spec.default ? ' (default)' : '';
      lines.push(`    variant "${name}"${dflt}: ${v.description}${needs}`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  LANDING_VOCABULARY,
  LANDING_PATTERNS,
  landingVariantPairs,
  resolveLandingVariant,
  describeLandingVocabulary,
};
