import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { compileRenderCvDocument, RENDERCV_COMPILER_VERSION } from './compiler';
import { entryFingerprint } from './fingerprints';
import { parseCvVariantsYaml } from './cv-variants';

describe('RenderCV shared compiler', () => {
  it('validates, applies tags/flavors/exclusions, and records its version', () => {
    const hidden = { name: 'Hidden project', tags: ['other'] };
    const excluded = { name: 'Explicitly hidden' };
    const source = YAML.stringify({
      cv: {
        name: 'Example Person',
        sections: {
          projects: [
            { name: { flavors: { concise: 'Visible project', long: 'A long project title' } }, tags: ['target'] },
            hidden,
            excluded
          ],
          publications: [{ title: 'Paper', authors: ['Example Person'], journal: 'Journal' }]
        }
      },
      design: { theme: 'classic' }
    });
    const result = compileRenderCvDocument({
      yaml: source,
      variantKey: 'target',
      variant: {
        tags: ['target'],
        flavors: ['concise'],
        exclude_sections: ['publications'],
        exclude_entries: { projects: [entryFingerprint(excluded)] }
      }
    });
    const parsed = YAML.parse(result.yaml);
    expect(parsed.cv.sections.projects).toEqual([{ name: 'Visible project' }]);
    expect(parsed.cv.sections.publications).toBeUndefined();
    expect(result.compilerVersion).toBe(RENDERCV_COMPILER_VERSION);
    expect(result.variantKey).toBe('target');
  });

  it('parses bounded variants including per-entry exclusions', () => {
    const variants = parseCvVariantsYaml(`variants:\n  product:\n    tags: [product]\n    exclude_entries:\n      projects: [abc123]\n`);
    expect(variants.product?.exclude_entries).toEqual({ projects: ['abc123'] });
    expect(() => parseCvVariantsYaml('variants:\n  "../bad": {}\n')).toThrow('Invalid variant key');
  });

  it('rejects documents without a canonical cv mapping', () => {
    expect(() => compileRenderCvDocument({ yaml: 'design:\n  theme: classic\n' })).toThrow('top-level cv mapping');
  });
});
