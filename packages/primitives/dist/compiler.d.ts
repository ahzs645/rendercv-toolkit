import type { CompiledRenderCvDocument, CompiledRenderCvSections, CvVariantDefinition, RenderCvSections } from './types';
export declare const RENDERCV_COMPILER_VERSION = "1.0.0";
export declare function compileRenderCvDocument(input: {
    yaml: string;
    variant?: CvVariantDefinition | null;
    variantKey?: string | null;
    hiddenEntries?: Record<string, string[]>;
    disabledSections?: string[];
    maxBytes?: number;
}): CompiledRenderCvDocument;
export declare function validateRenderCvDocument(yaml: string, maxBytes?: number): void;
export declare function compileRenderCvSections(input: {
    sections: RenderCvSections;
    variant?: CvVariantDefinition | null;
    variantKey?: string | null;
    hiddenEntries?: Record<string, string[]>;
    disabledSections?: string[];
    maxBytes?: number;
}): CompiledRenderCvSections;
//# sourceMappingURL=compiler.d.ts.map