import { describe, expect, it } from 'vitest';
import { RENDERCV_RENDERER_PROTOCOL_VERSION, type RenderCvRenderer } from './index';

describe('RenderCV renderer contract', () => {
  it('has a versioned, host-neutral result contract', async () => {
    const renderer: RenderCvRenderer = {
      id: 'test',
      async render(request) {
        return {
          pdf: new Uint8Array([37, 80, 68, 70, 45]),
          pdfSha256: 'pdf-hash',
          effectiveYamlSha256: 'yaml-hash',
          compilerVersion: request.compilerVersion,
          rendererVersion: 'test-1'
        };
      }
    };
    const result = await renderer.render({ yaml: 'cv: {}', compilerVersion: 'compiler-1' });
    expect(RENDERCV_RENDERER_PROTOCOL_VERSION).toBe('1.0.0');
    expect(result.compilerVersion).toBe('compiler-1');
    expect(result.pdf[0]).toBe(37);
  });
});
