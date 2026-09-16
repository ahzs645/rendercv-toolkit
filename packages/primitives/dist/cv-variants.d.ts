import type { CvVariants } from './types';
export declare function parseCvVariantsYaml(content: string, options?: {
    maxBytes?: number;
    maxVariants?: number;
}): CvVariants;
/**
 * Inverse of {@link parseCvVariantsYaml}: render authored variants back to the
 * `variants:` document the loader and the `?variants=` URL parameter accept.
 *
 * Absent, blank and empty-list fields are dropped rather than emitted as `null`
 * or `[]`, so a variant that only carries a description stays a one-line entry
 * and the result round-trips through the parser unchanged.
 */
export declare function serializeCvVariantsYaml(variants: CvVariants): string;
//# sourceMappingURL=cv-variants.d.ts.map