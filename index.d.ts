// Type declarations for @creaditor/page-kit.
// page-kit is a CommonJS package (`module.exports = {...}`), so it is typed with
// `export =`. Consumers with esModuleInterop can `import pageKit from
// '@creaditor/page-kit'`; types live under the merged `pageKit` namespace
// (e.g. `pageKit.Tree`, `pageKit.Palette`).

declare const pageKit: pageKit.PageKit;

declare namespace pageKit {
  /** A creaditor component tree node (section / block / col / element). Plain JSON. */
  export type Tree = {
    id?: string;
    type: string;
    layer?: string | number;
    props?: Record<string, unknown>;
    children?: Tree[];
    [key: string]: unknown;
  };

  export interface Palette {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
    background?: string;
    all?: string[];
    /** An editor-api `cssRule` string, verbatim, or omitted to fall back to Assistant. */
    displayFont?: string;
  }

  /** What makeSection/composeSection return: the section tree plus its ids. */
  export interface SectionResult {
    section: Tree;
    sectionId: string;
    blockId: string;
    colIds: string[];
  }

  export type RGB = { r: number; g: number; b: number };
  export type Transaction = Record<string, unknown>;

  export interface EditPatchMessage {
    siteId: string;
    userId: string;
    transactionId: string;
    transactions: Transaction[];
  }

  export interface CatalogEntry {
    body: Tree;
    group?: string;
  }

  export interface SectionTemplate {
    id: string;
    name: string;
    category: string;
    icon?: unknown;
    tags?: string[];
    body: Tree;
  }

  /** One variant of a landing pattern, as declared in LANDING_VOCABULARY. */
  export interface LandingVariantSpec {
    /** What the variant is for, written for a language model to read. */
    description: string;
    /** Copy fields without which this variant cannot render. */
    needs: string[];
    /** Copy fields the variant uses if present. */
    optional?: string[];
  }

  /** One landing pattern and every variant it can be rendered as. */
  export interface LandingPatternSpec {
    description: string;
    /** Variant used when none is given, or when the requested one is unusable. */
    default: string;
    variants: Record<string, LandingVariantSpec>;
  }

  /** What resolveLandingVariant returns for a renderable request. */
  export interface ResolvedLandingVariant {
    pattern: string;
    variant: string;
    /** The requested variant, when it could not be used. Null when honoured. */
    fellBackFrom: string | null;
  }

  export interface PageKit {
    // color / contrast
    parseColor(str: string): RGB | null;
    toHex(rgb: RGB): string;
    relLuminance(rgb: RGB): number;
    saturation(rgb: RGB): number;
    readableTextOn(bg: string): string;
    contrastRatio(a: string, b: string): number;
    repairMarks(pmNode: unknown, bg: string): unknown;
    repairTextContrast(node: Tree, bg?: string): Tree;

    // palette + brand tokens
    extractPalette(components?: Tree[], themeColors?: string[]): Palette;
    resolveColorToken(value: string, palette?: Palette): string;
    resolveStyleTokens(style?: Record<string, unknown>, palette?: Palette): Record<string, unknown>;
    resolveTreeTokens(node: Tree, palette?: Palette): Tree;

    // element + section factories
    cid(): string;
    makeText(text: string, opts?: Record<string, unknown>): Tree;
    makeButton(text: string, opts?: Record<string, unknown>): Tree;
    makeImage(src: string, opts?: Record<string, unknown>): Tree;
    makeDivider(opts?: Record<string, unknown>): Tree;
    makeSpacer(opts?: Record<string, unknown>): Tree;
    iconUrl(name: string, fill?: string): string;
    makeList(items?: unknown[], opts?: Record<string, unknown>): Tree;
    assignFreshIds(node: Tree): Tree;
    buildCatalogElement(type: string, spec?: Record<string, unknown>, palette?: Palette): Tree;
    buildElement(spec?: Record<string, unknown>, palette?: Palette): Tree;
    makeSection(opts?: Record<string, unknown>): SectionResult;
    spreadWidths(n: number): number[];
    composeSection(pattern: string, args?: Record<string, unknown>, palette?: Palette, pageBg?: string, lang?: string): SectionResult;
    /** Role-based landing/sales section (hero, problem, solution, pricing, leadform,
     *  about, testimonials, …) built from LLM-authored copy + the brand palette. */
    composeLandingSection(
      pattern: string,
      copy?: Record<string, unknown>,
      palette?: Palette,
      opts?: { variant?: string | null; backgroundImage?: string; backgroundKind?: 'photo' | 'generated' },
    ): { section: Tree };

    // landing vocabulary: the single declaration of what a landing page can be
    // built from. Consumers derive their enums and prompts from this rather
    // than hardcoding a list, so an unrenderable request cannot be expressed.
    LANDING_VOCABULARY: Record<string, LandingPatternSpec>;
    LANDING_PATTERNS: string[];
    landingVariantPairs(): Array<{ pattern: string; variant: string }>;
    /** Never throws. Returns null when the pattern is unknown, so the caller skips it. */
    resolveLandingVariant(
      pattern: string,
      variant?: string | null,
      copy?: Record<string, unknown>,
    ): ResolvedLandingVariant | null;
    /** The vocabulary rendered as the menu text a generation prompt shows the model. */
    describeLandingVocabulary(): string;

    // data
    CATALOG_BODIES: Record<string, CatalogEntry>;
    SECTION_TEMPLATES: SectionTemplate[];
    ELEMENT_TYPES: string[];

    // execution envelope (the edit:patch wire contract)
    editPatch(
      siteId: string,
      userId: string,
      transactions: Transaction | Transaction[],
      transactionId?: string,
    ): EditPatchMessage;
  }
}

export = pageKit;
