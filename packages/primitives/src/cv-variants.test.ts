import { describe, expect, it } from 'vitest';
import { parseCvVariantsYaml, serializeCvVariantsYaml } from './cv-variants';

describe('serializeCvVariantsYaml', () => {
  it('round-trips authored variants through the parser', () => {
    const variants = {
      tech_focus: {
        description: 'Industry roles',
        tags: ['industry', 'swe'],
        flavors: ['short'],
        exclude_sections: ['publications'],
        exclude_entries: { experience: ['fp-1', 'fp-2'] }
      }
    };

    expect(parseCvVariantsYaml(serializeCvVariantsYaml(variants))).toEqual(variants);
  });

  it('omits blank and empty fields instead of emitting null or []', () => {
    const yaml = serializeCvVariantsYaml({
      academic: {
        description: '   ',
        tags: [],
        flavors: undefined,
        exclude_sections: [],
        exclude_entries: { experience: [] }
      }
    });

    expect(yaml).not.toMatch(/description|tags|flavors|exclude_/);
    expect(yaml).toContain('academic');
  });

  it('keeps a description-only variant to a single field', () => {
    const yaml = serializeCvVariantsYaml({ academic: { description: 'Research roles' } });

    expect(yaml).toContain('description: Research roles');
    expect(parseCvVariantsYaml(yaml).academic).toMatchObject({ description: 'Research roles' });
  });

  it('trims the description on the way out', () => {
    const yaml = serializeCvVariantsYaml({ academic: { description: '  Research roles  ' } });

    expect(yaml).toContain('description: Research roles');
  });

  it('drops only the empty sections of exclude_entries', () => {
    const variants = {
      academic: { exclude_entries: { experience: ['fp-1'], projects: [] } }
    };

    expect(parseCvVariantsYaml(serializeCvVariantsYaml(variants)).academic.exclude_entries).toEqual({
      experience: ['fp-1']
    });
  });
});
