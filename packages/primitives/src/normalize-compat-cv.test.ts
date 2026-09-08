import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { normalizeCompatibilityCvYaml } from './normalize-compat-cv';

// These are conformance tests for every host that consumes the shared compiler.

function normalizeSections(sections: Record<string, unknown[]>) {
  const yamlText = YAML.stringify({ cv: { name: 'Test Person', sections } });
  const parsed = YAML.parse(normalizeCompatibilityCvYaml(yamlText)) as {
    cv: { sections: Record<string, unknown[]> };
  };
  return parsed.cv.sections;
}

describe('normalizeCompatibilityCvYaml entry shapes', () => {
  it('keeps one-line entries as label/details instead of flattening them', () => {
    const sections = normalizeSections({
      certifications_skills: [
        { label: 'Certifications', details: 'OFA Level 1; TCPS 2' },
        { label: 'Skills', details: 'Power BI; GIS' }
      ]
    });

    expect(sections.certifications_skills).toEqual([
      { label: 'Certifications', details: 'OFA Level 1; TCPS 2' },
      { label: 'Skills', details: 'Power BI; GIS' }
    ]);
  });

  it('keeps experience, publication, bullet and numbered shapes in custom sections', () => {
    const sections = normalizeSections({
      side_work: [{ company: 'Acme', position: 'Advisor', start_date: '2021-01' }],
      selected_papers: [{ title: 'A Paper', authors: ['Jane Doe'], journal: 'Nature' }],
      strengths: [{ bullet: 'Excellent communicator' }],
      ranked: [{ number: 'First item' }, { reversed_number: 'Last item' }]
    });

    expect(sections.side_work).toEqual([
      { company: 'Acme', position: 'Advisor', start_date: '2021-01' }
    ]);
    expect(sections.selected_papers).toEqual([
      { title: 'A Paper', authors: ['Jane Doe'], journal: 'Nature' }
    ]);
    expect(sections.strengths).toEqual([{ bullet: 'Excellent communicator' }]);
    expect(sections.ranked).toEqual([{ number: 'First item' }, { reversed_number: 'Last item' }]);
  });

  it('folds stray scalar fields into the matched shape rather than rewriting it', () => {
    const sections = normalizeSections({
      languages: [{ label: 'Languages', details: 'English, Arabic', proficiency: 'Native' }],
      side_work: [{ company: 'Acme', position: 'Advisor', course_level: 'Graduate' }]
    });

    expect(sections.languages).toEqual([
      { label: 'Languages', details: 'English, Arabic · proficiency: Native' }
    ]);
    expect(sections.side_work).toEqual([
      { company: 'Acme', position: 'Advisor', summary: 'course level: Graduate' }
    ]);
  });

  it('still coerces entries that match no RenderCV shape into a normal entry', () => {
    const sections = normalizeSections({
      committees: [{ committee: 'Ethics Board', term: '2021-2023' }]
    });

    expect(sections.committees).toEqual([
      { name: 'Ethics Board', summary: 'term: 2021-2023' }
    ]);
  });

  it('leaves nested and list values intact when folding stray fields', () => {
    const sections = normalizeSections({
      projects: [
        {
          name: 'Campus Hub',
          highlights: ['Next.js', 'React'],
          repository: 'github.com/example/campus-hub'
        }
      ]
    });

    expect(sections.projects).toEqual([
      {
        name: 'Campus Hub',
        highlights: ['Next.js', 'React'],
        summary: 'repository: github.com/example/campus-hub'
      }
    ]);
  });
});

describe('normalizeCompatibilityCvYaml localization', () => {
  function normalizeWithLocale(cv: Record<string, unknown>, locale?: string) {
    const yamlText = YAML.stringify({ cv });
    return YAML.parse(normalizeCompatibilityCvYaml(yamlText, { locale })) as {
      cv: Record<string, unknown> & { sections: Record<string, unknown[]> };
    };
  }

  const twoPositions = {
    name: '김윤서',
    sections: {
      experience: [
        {
          company: 'FR 미디어',
          positions: [
            { title: '선임 영상편집자', start_date: '2023-11', end_date: 'present' },
            { title: '영상편집자', start_date: '2023-03', end_date: '2023-10' }
          ]
        }
      ]
    }
  };

  it('renders flattened position dates with the document locale', () => {
    const { cv } = normalizeWithLocale(twoPositions, 'locale:\n  language: korean\n');
    const positions = cv.sections.experience.map((entry) => (entry as { position: string }).position);

    expect(positions[0]).toContain('11월 2023 – 현재');
    expect(positions[1]).toContain('3월 2023 – 10월 2023');
  });

  it('keeps English dates when no locale is supplied', () => {
    const { cv } = normalizeWithLocale(twoPositions);
    const positions = cv.sections.experience.map((entry) => (entry as { position: string }).position);

    expect(positions[0]).toContain('November 2023 – Present');
    expect(positions[1]).toContain('March 2023 – October 2023');
  });

  it('honours a hand-edited present translation', () => {
    const { cv } = normalizeWithLocale(
      twoPositions,
      'locale:\n  language: korean\n  present: 재직중\n'
    );
    const position = (cv.sections.experience[0] as { position: string }).position;

    expect(position).toContain('11월 2023 – 재직중');
  });
});

describe('normalizeCompatibilityCvYaml CJK résumé shapes', () => {
  function normalizeCv(cv: Record<string, unknown>) {
    return (
      YAML.parse(normalizeCompatibilityCvYaml(YAML.stringify({ cv }))) as {
        cv: Record<string, unknown> & { sections: Record<string, unknown[]> };
      }
    ).cv;
  }

  it('folds alternate name renderings into the headline', () => {
    const cv = normalizeCv({
      name: '김윤서',
      name_hanja: '金允誓',
      name_english: 'Yunseo Kim'
    });

    expect(cv.headline).toBe('金允誓 · Yunseo Kim');
    expect(cv.name_hanja).toBeUndefined();
    expect(cv.name_english).toBeUndefined();
  });

  it('keeps an authored headline ahead of the alternate names', () => {
    const cv = normalizeCv({ name: '김윤서', headline: '영상편집자', name_english: 'Yunseo Kim' });

    expect(cv.headline).toBe('영상편집자 · Yunseo Kim');
  });

  it('turns a date of birth into a header connection', () => {
    const cv = normalizeCv({ name: '김윤서', date_of_birth: '2003-04-24' });

    expect(cv.date_of_birth).toBeUndefined();
    // RenderCV declares `url` as nullable without a default, so it has to be
    // present even when there is nothing to link to.
    expect(cv.custom_connections).toEqual([
      { fontawesome_icon: 'cake-candles', placeholder: '2003-04-24', url: null }
    ]);
  });

  it('turns a section of short answers into one-line entries', () => {
    const cv = normalizeCv({
      name: '김윤서',
      sections: {
        자기소개서: {
          keywords: ['성실함', '열정'],
          지원동기: '선한 영향력을 끼치고 싶습니다.'
        }
      }
    });

    expect(cv.sections.자기소개서).toEqual([
      { label: 'Keywords', details: '성실함, 열정' },
      { label: '지원동기', details: '선한 영향력을 끼치고 싶습니다.' }
    ]);
  });

  it('keeps a mapping section uniform when one answer is prose', () => {
    // RenderCV infers the entry type from the first entry and validates the
    // rest against it, so a section may not mix one-line and normal entries.
    const essay = '가'.repeat(200);
    const cv = normalizeCv({
      name: '김윤서',
      sections: { 자기소개서: { keywords: ['성실함', '열정'], 지원동기: essay } }
    });

    expect(cv.sections.자기소개서).toEqual([
      { name: 'Keywords', summary: '성실함, 열정' },
      { name: '지원동기', summary: essay }
    ]);
  });

  it('folds fields RenderCV forbids on an experience entry into its summary', () => {
    const cv = normalizeCv({
      name: '김윤서',
      sections: {
        experience: [
          { company: 'FR 미디어', position: '영상편집자', employment_type: '단기계약' }
        ]
      }
    });

    expect(cv.sections.experience).toEqual([
      { company: 'FR 미디어', position: '영상편집자', summary: 'employment type: 단기계약' }
    ]);
  });
});

describe('normalizeCompatibilityCvYaml alternate names per theme', () => {
  const cv = { name: '김윤서', name_hanja: '金允誓', name_english: 'Yunseo Kim' };

  function normalizeFor(theme?: string) {
    return (
      YAML.parse(
        normalizeCompatibilityCvYaml(YAML.stringify({ cv }), { theme })
      ) as { cv: Record<string, unknown> }
    ).cv;
  }

  it('uses the headline on themes that render one', () => {
    expect(normalizeFor('classic')).toMatchObject({
      name: '김윤서',
      headline: '金允誓 · Yunseo Kim'
    });
    expect(normalizeFor()).toMatchObject({ headline: '金允誓 · Yunseo Kim' });
  });

  it('puts them next to the name on themes with no headline slot', () => {
    // ahmadstyle, tylerstyle and phddeedy have no headline in their header
    // template, so a folded headline would never reach the page.
    for (const theme of ['ahmadstyle', 'tylerstyle', 'phddeedy']) {
      const result = normalizeFor(theme);
      expect(result.name).toBe('김윤서 (金允誓 · Yunseo Kim)');
      expect(result.headline).toBeUndefined();
    }
  });
});

it('preserves project technologies through import instead of folding them into summary', () => {
  const entry = { name: 'Planet', technologies: 'React Native, Expo Go', summary: 'A student project.' };
  expect(normalizeSections({ projects: [entry] }).projects).toEqual([entry]);
  expect(normalizeSections({ 'Projects & Leadership': [entry] })['Projects & Leadership']).toEqual([entry]);
});
