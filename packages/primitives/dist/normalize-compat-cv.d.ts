import type { CvVariantDefinition } from './types';
type NormalizeCompatibilityOptions = {
    variant?: CvVariantDefinition | null;
};
export declare function stripPositionMarkersFromCvYaml(yamlText: string): string;
export declare function repairFlattenedPositionDatesInCvYaml(yamlText: string): string;
export declare function themeUsesPositionSpacingMarkers(themeName: string | undefined): boolean;
export declare function restoreAhmadStylePositionMarkersInCvYaml(yamlText: string): string;
export declare function normalizeCompatibilityCvYaml(yamlText: string, options?: NormalizeCompatibilityOptions): string;
export {};
//# sourceMappingURL=normalize-compat-cv.d.ts.map