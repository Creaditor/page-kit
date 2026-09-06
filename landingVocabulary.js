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
 * The longest heading that still renders at the display size. Lives here rather
 * than in landingSections.js because both the type scale and `display`'s guard
 * are the same fact, and duplicating it would let them drift into disagreeing
 * about which headings are short.
 */
const DISPLAY_MAX_HEADING = 24;

/**
 * @typedef {object} VariantSpec
 * @property {string} description  what this variant is for, written for the model
 * @property {string[]} needs      copy fields without which this variant cannot render
 * @property {string[]} [optional] copy fields it will use if present
 * @property {(copy: object) => boolean} [guard]
 *   Presence is not suitability. `needs` asks whether a field is there at all;
 *   a guard asks whether there is enough of it for this variant to be the right
 *   choice. Every guard below restates a condition the variant's own
 *   description already gives, so none of them invents a rule the model was not
 *   told about.
 */

/**
 * @typedef {object} PatternSpec
 * @property {string} description
 * @property {string} default
 * @property {string[]} [preference]
 *   Variants best-first. `resolveLandingVariant` walks this and takes the first
 *   the copy can actually support, which is how a strong variant gets chosen
 *   without the model having to ask for it. A pattern with no preference list
 *   keeps the old behaviour exactly (default, then declaration order), which is
 *   the same thing here because every pattern's default is also its first
 *   declared variant.
 * @property {Record<string, VariantSpec>} variants
 */

/** @type {Record<string, PatternSpec>} */
const LANDING_VOCABULARY = {
  hero: {
    description: 'The opening statement. Every page has exactly one, first.',
    default: 'centered',
    // Best first. `centered` is last on purpose: its own description calls it
    // the safe default and the only one that works with nothing but a headline,
    // which makes it the floor rather than a choice.
    preference: ['display', 'coral-cut', 'gold-night', 'cinema-block', 'asymmetric', 'conversation', 'centered'],
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
        // `stats` is optional because the variant RENDERS without them. It is
        // only worth CHOOSING with them: the ruled numeral row is the whole
        // device, and empty it is a plain dark hero.
        guard: (copy) => Array.isArray(copy.stats) && copy.stats.length >= 2,
      },
      'coral-cut': {
        description: 'Copy on one side, three numbers in their own accent-coloured field on the other. Use when the business has three short stats worth foregrounding and wants the most colour-forward opening.',
        needs: ['heading', 'stats'],
        optional: ['eyebrow', 'subheading', 'cta'],
        // "three numbers in their own accent-coloured field", per its own
        // description. With one or two the field renders half empty.
        guard: (copy) => Array.isArray(copy.stats) && copy.stats.length >= 3,
      },
      display: {
        description: 'The biggest opening we have: the heading alone at display size on a ground shown at nearly full strength. Use when the page opens on a NAME or a short claim, never on a sentence. The size is computed from the heading length, so a long headline quietly renders small and the variant is wasted; aim for under 24 characters. `facts` is optional and holds 2 or 3 short strings, normally a date and a venue for an event, rendered on their own line under the heading. `headingAccent` may name ONE word inside `heading` to set in the brand accent while the rest stays white; it must appear in the heading word for word and be at most half of it, or it is ignored.',
        needs: ['heading'],
        optional: ['eyebrow', 'subheading', 'cta', 'facts', 'headingAccent'],
        // Two conditions, and the second one is the ordering rule of this whole
        // list: prefer the variant that uses the MOST of what the tenant
        // actually has.
        //
        // The heading must be short enough to set at display size. `facts`
        // became optional when the variant was renamed, leaving it needing
        // nothing but a heading, and a 60-character headline at the smallest
        // step on a loud ground is not this variant, it is `centered` wearing
        // its background.
        //
        // And it must not be throwing away numbers. Sitting at the top of the
        // preference list, this variant would otherwise win on a business with
        // a price, a trial length and a tool count and then show none of them,
        // while `coral-cut` two places down exists to put exactly those three
        // on the page. Measured on a real render: a SaaS tenant with three
        // stats got a beautiful hero that said nothing. So it yields whenever
        // there are three stats and no facts of its own to lead with.
        guard: (copy) => String(copy.heading || '').trim().length <= DISPLAY_MAX_HEADING
          && ((Array.isArray(copy.facts) && copy.facts.length >= 2)
            || !(Array.isArray(copy.stats) && copy.stats.length >= 3)),
      },
      'cinema-block': {
        description: 'Copy beside a tall narrow photograph. Use when the business has a real photograph of its product, place or work, for an opening with more atmosphere than `asymmetric`. The narrow crop asks far less of the image than a full-bleed band, so it tolerates an ordinary tenant photo where other photo variants would not.',
        needs: ['heading', 'image'],
        optional: ['eyebrow', 'subheading', 'cta'],
      },
    },
  },

  lineup: {
    description: 'Who is on the stage. Use for an event, a conference or a workshop, never for a product. It is the section an event page is bought for.',
    default: 'placeholder',
    variants: {
      placeholder: {
        description: 'The section before the speakers are confirmed: a title, one line saying the lineup is on its way, and an invitation to be told when it lands. Use this whenever the brief does not name real speakers. It is the default because an event page is built and published months before its lineup is signed, so this is the state the section spends most of its life in.',
        needs: ['heading'],
        optional: ['eyebrow', 'subheading', 'cta'],
      },
      roster: {
        description: 'The confirmed speakers, each as a name with one line saying who they are or what they will talk about. Use ONLY when the brief names real people. Needs `items`, up to 8, each { title: the name exactly as the brief writes it, text: their role or subject }.',
        needs: ['items'],
        optional: ['eyebrow', 'heading', 'subheading', 'cta'],
      },
    },
  },

  problem: {
    description: 'Name the pain the reader already feels. Do not sell here.',
    default: 'prose',
    // The dark item variants first: the approved look is a page of saturated
    // dark grounds, and `continuous` is the one that makes it read as a single
    // scroll rather than a series of screens. `lift` is kept above the light
    // card variants because a page that never changes register is monotonous,
    // but below the dark ones because it is the exception, not the rule.
    // `prose` last: one paragraph is what you write when there is nothing to
    // itemise, not what you choose.
    preference: ['continuous', 'panels', 'lift', 'badge-cards', 'prose'],
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
        // "2 to 4 obstacles", per its own description: one item in a layout
        // built for a row is a single card in half-empty space.
        guard: (copy) => Array.isArray(copy.items) && copy.items.length >= 2,
      },
      continuous: {
        description: 'Stays on the same dark ground as the hero, no colour break between the two sections. Each obstacle is a ruled row with an ordinal marker in the accent colour. Use when the page should read as one continuous scroll rather than a series of separate screens. Needs `items`, 2 to 4 obstacles, each { title, text }.',
        needs: ['items'],
        optional: ['eyebrow', 'heading'],
        // "2 to 4 obstacles", per its own description: one item in a layout
        // built for a row is a single card in half-empty space.
        guard: (copy) => Array.isArray(copy.items) && copy.items.length >= 2,
      },
      panels: {
        description: 'Stays dark like continuous, but each obstacle owns a solid block one shade off the ground, flush and touching rather than floating on a shadow. Use when the obstacles need more visual weight than a plain ruled list. Needs `items`, 2 to 4 obstacles, each { title, text }.',
        needs: ['items'],
        optional: ['eyebrow', 'heading'],
        // "2 to 4 obstacles", per its own description: one item in a layout
        // built for a row is a single card in half-empty space.
        guard: (copy) => Array.isArray(copy.items) && copy.items.length >= 2,
      },
      lift: {
        description: 'Comes up to a pale ground tinted from the brand, the one moment on the page that is not near-black. Use for a page that should feel like it takes a breath after a dark hero, or when the reader needs a change of register to keep reading. Needs `items`, 2 to 4 obstacles, each { title, text }.',
        needs: ['items'],
        optional: ['eyebrow', 'heading'],
        // "2 to 4 obstacles", per its own description: one item in a layout
        // built for a row is a single card in half-empty space.
        guard: (copy) => Array.isArray(copy.items) && copy.items.length >= 2,
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
    // `conversation` first because its own description says so: the strongest
    // option when the capabilities are things the business sends, needing no
    // photograph and sidestepping the stock-photo problem entirely.
    // `bullets-image` last because it is the one that DEPENDS on a stock photo,
    // which is the known weak point of every page we generate.
    preference: ['conversation', 'tiles', 'stack', 'bullets-image'],
    variants: {
      'bullets-image': {
        description: 'Capability bullets beside a feature image. Needs an image to look right.',
        needs: ['bullets'],
        optional: ['eyebrow', 'heading', 'paragraph', 'image'],
      },
      conversation: {
        description: 'Each capability shown as the thing the business actually sends, beside a real message thread. The strongest option when the capabilities are things the business sends or says: it is the product own material, needs no photograph, and sidesteps the stock-photo problem entirely. Needs `items` (2 to 4 capabilities, each { title, text }) and `thread` (2 to 4 messages, each { text, from: "business" | "customer", time }).',
        needs: ['items', 'thread'],
        optional: ['eyebrow', 'heading', 'paragraph'],
      },
      tiles: {
        description: 'The capabilities as a tight grid of solid cells with a thin seam between them, the name carrying the weight in the accent colour. Use when there are several distinct capabilities to show at once and none of them should read as more important than the others. Needs `items`, up to 6 capabilities, each { title, text }.',
        needs: ['items'],
        optional: ['eyebrow', 'heading', 'paragraph'],
        // Worth choosing only with something to arrange. One capability in a
        // grid or a display list is the layout announcing itself over its
        // content.
        guard: (copy) => Array.isArray(copy.items) && copy.items.length >= 2,
      },
      stack: {
        description: 'The capabilities set as one continuous typographic list at display size, no cells and no rules. Use for a shorter, calmer list where each capability name should carry the weight on its own line. Needs `items`, up to 6 capabilities, each { title, text }.',
        needs: ['items'],
        optional: ['eyebrow', 'heading', 'paragraph'],
        // Worth choosing only with something to arrange. One capability in a
        // grid or a display list is the layout announcing itself over its
        // content.
        guard: (copy) => Array.isArray(copy.items) && copy.items.length >= 2,
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

  tip: {
    description:
      'One genuinely useful piece of advice the reader can act on whether or not they buy. Earns trust by giving something away. Use at most once on a page, and only when there is a real, specific tip to give; a vague platitude here is worse than no tip.',
    default: 'panel',
    variants: {
      panel: {
        description: 'A white panel with an accent edge and a lightbulb, on the light band.',
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
    if (!vs) return false;
    if (!vs.needs.every(has)) return false;
    // Presence is not suitability. A variant whose fields are all there can
    // still be the wrong choice, and the guard is where that is said.
    return typeof vs.guard === 'function' ? !!vs.guard(copy) : true;
  };

  const requested = typeof variant === 'string' && variant ? variant : null;
  const known = requested && spec.variants[requested] ? requested : null;

  // 1. An explicit, satisfiable request from the model wins. Some of these
  //    calls are genuinely semantic and no rule over the copy can make them:
  //    `conversation` is right when a message exchange tells the story better,
  //    and only the model has read the business.
  if (known && satisfied(known)) {
    return { pattern, variant: known, fellBackFrom: null, chosenBy: 'model' };
  }

  // 2. Otherwise CODE picks, best-first, and the model being silent is the
  //    normal case rather than the exception: two real generations returned
  //    `variant: ""` for both hero and solution. This used to return
  //    `spec.default` there, which meant every strong variant in this file was
  //    unreachable in a real generation, and on an unsatisfiable request it
  //    scanned declaration order, which is not a quality order.
  const order = Array.isArray(spec.preference) && spec.preference.length
    ? spec.preference
    : Object.keys(spec.variants);
  const best = order.find(satisfied);

  return {
    pattern,
    variant: best || spec.default,
    // `requested`, not `known`: a model asking for a variant that does not
    // exist at all is worth reporting too, and it is the loudest signal that
    // the prompt and this file have drifted apart.
    fellBackFrom: requested,
    chosenBy: 'code',
  };
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
  DISPLAY_MAX_HEADING,
  LANDING_PATTERNS,
  landingVariantPairs,
  resolveLandingVariant,
  describeLandingVocabulary,
};
