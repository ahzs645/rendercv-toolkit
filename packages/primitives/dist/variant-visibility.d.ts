import type { CvVariantDefinition } from './types';
/**
 * Variant-driven visibility, shared between the renderer and the form editor.
 *
 * The renderer (normalize-compat-cv) uses {@link matchesEntryVariant} to decide
 * which entries reach the PDF. The form editor uses {@link computeVariantVisibility}
 * to mirror those same decisions in the interface, so the user can see what the
 * selected variant is hiding without rendering the PDF. Keeping the predicate in
 * one place guarantees the form and the PDF never disagree.
 */
export declare const ARCHIVED_TAG = "archived";
type UnknownRecord = Record<string, unknown>;
export declare function normalizeStringList(value: unknown): string[];
/**
 * Whether a single entry survives the active variant's tag rules.
 *
 * - `archived`-tagged entries are dropped unless the variant explicitly selects
 *   the `archived` tag (this applies even when no variant is active).
 * - When a variant is active, `itags` (inverse tags) drop an entry if the variant
 *   selects any of them, and `tags` require the variant to select at least one.
 */
export declare function matchesEntryVariant(entry: UnknownRecord, selectedTags: string[], variantActive: boolean): boolean;
export interface VariantVisibility {
    /** Section keys the variant removes entirely (`exclude_sections`). */
    excludedSections: Set<string>;
    /** Per-section entry fingerprints the variant drops from the PDF (tags/itags/archived). */
    hiddenEntries: Record<string, Set<string>>;
    /** Subset of hiddenEntries that are dropped specifically because they are `archived`. */
    archivedEntries: Record<string, Set<string>>;
}
/**
 * Compute which sections/entries the selected variant hides from the PDF, keyed
 * the same way the form identifies them (section key + entry fingerprint).
 *
 * `cvRoot` is the parsed `cv:` mapping (the form's rootValue). When `variant` is
 * null/undefined, only the always-on `archived` rule applies.
 */
export declare function computeVariantVisibility(cvRoot: unknown, variant: CvVariantDefinition | null | undefined): VariantVisibility;
export {};
//# sourceMappingURL=variant-visibility.d.ts.map