import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { compileRenderCvDocument, compileRenderCvSections, RENDERCV_COMPILER_VERSION } from './compiler';
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

  it('compiles split editor sections through the same canonical pipeline', () => {
    const result = compileRenderCvSections({
      sections: {
        cv: 'cv:\n  name: Example\n  sections:\n    projects:\n      - name: Shared compiler\n',
        design: 'design:\n  theme: classic\n',
        locale: 'locale:\n  language: english\n',
        settings: 'settings: {}\n'
      }
    });
    expect(YAML.parse(result.sections.cv).cv.name).toBe('Example');
    expect(YAML.parse(result.sections.design).design.theme).toBe('classic');
    expect(result.theme).toBe('classic');
  });

  it('renders normalizer-generated dates in the language the locale section selects', () => {
    const sections = {
      cv: YAML.stringify({
        cv: {
          name: '김윤서',
          sections: {
            experience: [
              {
                company: 'FR 미디어',
                positions: [
                  { title: '영상편집자', start_date: '2023-11', end_date: 'present' },
                  { title: '보조 편집자', start_date: '2023-03', end_date: '2023-10' }
                ]
              }
            ]
          }
        }
      }),
      design: 'design:\n  theme: classic\n',
      locale: 'locale:\n  language: korean\n',
      settings: ''
    };

    // Themes that read the spacing markers keep the flattened suffix, so the
    // dates it carries have to be in the CV's language.
    const markerTheme = compileRenderCvSections({
      sections: { ...sections, design: 'design:\n  theme: ahmadstyle\n' }
    });
    expect(markerTheme.sections.cv).toContain('11월 2023 – 현재');
    expect(markerTheme.sections.cv).toContain('3월 2023 – 10월 2023');

    // Every other theme has the suffix parsed back into date columns, which
    // only works if the parser understands the language it was written in.
    const repaired = YAML.parse(compileRenderCvSections({ sections }).sections.cv) as {
      cv: { sections: { experience: { position: string; start_date?: string; end_date?: string }[] } };
    };
    expect(repaired.cv.sections.experience[0]).toMatchObject({
      position: '영상편집자',
      start_date: '2023-11',
      end_date: 'present'
    });

    // The same document in English still renders the dates it always has.
    const english = compileRenderCvSections({
      sections: {
        ...sections,
        design: 'design:\n  theme: ahmadstyle\n',
        locale: 'locale:\n  language: english\n'
      }
    });
    expect(english.sections.cv).toContain('November 2023 – Present');
  });
});
