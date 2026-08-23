import type { CvVariantDefinition } from './types';
type NormalizeCompatibilityOptions = {
    variant?: CvVariantDefinition | null;
    /** The document's `locale:` section, used for dates this module renders itself. */
    locale?: string | null;
    /** The selected theme, used where themes differ in which fields they render. */
    theme?: string | null;
};
export declare function themeRendersHeadline(themeName: string | undefined | null): boolean;
export declare function stripPositionMarkersFromCvYaml(yamlText: string): string;
export declare function repairFlattenedPositionDatesInCvYaml(yamlText: string, localeYaml?: string | null): string;
export declare function themeUsesPositionSpacingMarkers(themeName: string | undefined): boolean;
export declare function restoreAhmadStylePositionMarkersInCvYaml(yamlText: string): string;
export declare function normalizeCompatibilityCvYaml(yamlText: string, options?: NormalizeCompatibilityOptions): string;
export {};
//# sourceMappingURL=normalize-compat-cv.d.ts.map