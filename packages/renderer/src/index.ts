export const RENDERCV_RENDERER_PROTOCOL_VERSION = '1.0.0';

export interface RenderCvRenderRequest {
  yaml: string;
  compilerVersion: string;
}

export interface RenderCvRenderResult {
  pdf: Uint8Array;
  pdfSha256: string;
  effectiveYamlSha256: string;
  compilerVersion: string;
  rendererVersion: string;
}

export interface RenderCvRenderer {
  readonly id: string;
  render(request: RenderCvRenderRequest): Promise<RenderCvRenderResult>;
}
