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
    composeLandingSection(pattern: string, copy?: Record<string, unknown>, palette?: Palette): { section: Tree };

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
