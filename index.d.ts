// Type declarations for @creaditor/page-kit (a plain-CJS package).
// Component/section trees are plain JSON (the `cdtr-`-id'd tree). They are typed
// loosely as `Tree` here on purpose — the structural contract is owned by the
// editor; page-kit produces trees that conform to it.

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

export type Transaction = Record<string, unknown>;

export interface EditPatchMessage {
  siteId: string;
  userId: string;
  transactionId: string;
  transactions: Transaction[];
}

// ── color / contrast ──
export function parseColor(str: string): { r: number; g: number; b: number } | null;
export function toHex(rgb: { r: number; g: number; b: number }): string;
export function relLuminance(rgb: { r: number; g: number; b: number }): number;
export function saturation(rgb: { r: number; g: number; b: number }): number;
export function readableTextOn(bg: string): string;
export function contrastRatio(a: string, b: string): number;
export function repairMarks(pmNode: unknown, bg: string): unknown;
export function repairTextContrast(node: Tree, bg?: string): Tree;

// ── palette + brand tokens ──
export function extractPalette(components?: Tree[], themeColors?: string[]): Palette;
export function resolveColorToken(value: string, palette?: Palette): string;
export function resolveStyleTokens(style?: Record<string, unknown>, palette?: Palette): Record<string, unknown>;
export function resolveTreeTokens(node: Tree, palette?: Palette): Tree;

// ── element + section factories ──
export function cid(): string;
export function makeText(text: string, opts?: Record<string, unknown>): Tree;
export function makeButton(text: string, opts?: Record<string, unknown>): Tree;
export function makeImage(src: string, opts?: Record<string, unknown>): Tree;
export function makeDivider(opts?: Record<string, unknown>): Tree;
export function makeSpacer(opts?: Record<string, unknown>): Tree;
export function iconUrl(name: string, fill?: string): string;
export function makeList(items?: unknown[], opts?: Record<string, unknown>): Tree;
export function assignFreshIds(node: Tree): Tree;
export function buildCatalogElement(type: string, spec?: Record<string, unknown>, palette?: Palette): Tree;
export function buildElement(spec?: Record<string, unknown>, palette?: Palette): Tree;
export function makeSection(opts?: Record<string, unknown>): Tree;
export function spreadWidths(n: number): number[];
export function composeSection(pattern: string, args?: Record<string, unknown>, palette?: Palette, pageBg?: string): Tree;

// ── data ──
export const CATALOG_BODIES: Record<string, { body: Tree; group?: string }>;
export const SECTION_TEMPLATES: Array<{ id: string; name: string; category: string; icon?: unknown; tags?: string[]; body: Tree }>;
export const ELEMENT_TYPES: string[];

// ── execution envelope (the edit:patch wire contract) ──
export function editPatch(
  siteId: string,
  userId: string,
  transactions: Transaction | Transaction[],
  transactionId?: string,
): EditPatchMessage;
