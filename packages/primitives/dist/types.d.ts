export interface CvVariantDefinition {
    description?: string;
    exclude_sections?: string[];
    exclude_entries?: Record<string, string[]>;
    tags?: string[];
    flavors?: string[];
}
export type CvVariants = Record<string, CvVariantDefinition>;
export interface CompiledRenderCvDocument {
    yaml: string;
    compilerVersion: string;
    theme: string | null;
    variantKey: string | null;
}
export interface RenderCvSections {
    cv: string;
    design?: string;
    locale?: string;
    settings?: string;
}
export interface CompiledRenderCvSections extends CompiledRenderCvDocument {
    sections: Required<RenderCvSections>;
}
//# sourceMappingURL=types.d.ts.map