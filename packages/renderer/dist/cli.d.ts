import type { RenderCvRenderer } from './index';
export interface RenderCvCliRendererOptions {
    binary: string;
    themesRoot: string;
    timeoutMs?: number;
    maxPdfBytes?: number;
    rendererVersion?: string;
}
export declare function createRenderCvCliRenderer(options: RenderCvCliRendererOptions): RenderCvRenderer;
export declare function getRenderCvCliStatus(options: Pick<RenderCvCliRendererOptions, 'binary' | 'themesRoot'>): Promise<{
    available: boolean;
    executable: string;
    customThemesAvailable: boolean;
}>;
//# sourceMappingURL=cli.d.ts.map