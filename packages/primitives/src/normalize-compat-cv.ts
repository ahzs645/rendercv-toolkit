import type { CvVariantDefinition } from './types';
import YAML from 'yaml';
import {
  ENGLISH_DATE_LOCALE,
  monthNumbersByName,
  resolveDateLocale,
  type DateLocale
} from './locales';
import { matchesEntryVariant, normalizeStringList } from './variant-visibility';
const SUPPORTED_SOCIAL_NETWORKS = new Set([
  'LinkedIn',
  'GitHub',
  'GitLab',
  'IMDB',
  'Instagram',
  'ORCID',
  'Mastodon',
  'StackOverflow',
  'ResearchGate',
  'YouTube',
  'Google Scholar',
  'Telegram',
  'WhatsApp',
  'Leetcode',
  'X',
  'Bluesky'
]);
const CUSTOM_CONNECTION_ICONS: Record<string, string> = {
  Facebook: 'facebook-f'
};
const TOP_LEVEL_SOCIAL_FIELD_MAP: Record<string, string> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  gitlab: 'GitLab',
  instagram: 'Instagram',
  orcid: 'ORCID',
  mastodon: 'Mastodon',
  stackoverflow: 'StackOverflow',
  researchgate: 'ResearchGate',
  youtube: 'YouTube',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  x: 'X',
  bluesky: 'Bluesky',
  leetcode: 'Leetcode',
  imdb: 'IMDB',
  google_scholar: 'Google Scholar'
};
const POSITION_SPACING_SAME_MARKER = 'RCVSPACINGSAME:';
const POSITION_SPACING_DIFF_MARKER = 'RCVSPACINGDIFF:';
const ENTRY_META_FIELDS = new Set([
  'start_date',
  'end_date',
  'date',
  'location',
  'highlights',
  'summary',
  'tags',
  'itags',
  'flavors',
  'spacing_after',
  'show_date_in_position',
  'url',
  'doi'
]);
const DATE_FIELD_NAMES = new Set(['date', 'start_date', 'end_date']);
const TITLE_FIELD_CANDIDATES = [
  'name',
  'title',
  'course',
  'topic',
  'subject',
  'event',
  'project',
  'role',
  'company',
  'institution',
  'organization',
  'label'
];
type KnownEntryType = {
  /** Fields whose presence identifies this RenderCV entry type. */
  identity: string[];
  /** Fields this entry type keeps as-is. */
  fields: string[];
  /** Where stray scalar fields are appended so their text is not dropped. */
  overflowField: string;
};

/**
 * The RenderCV entry types, in detection order — the two-key shapes have to be
 * checked before `name` so a `{name, company, position}` entry stays an
 * experience entry. `url`/`doi` ride along on the entry types the editor offers
 * them for, even where RenderCV's own schema omits them.
 */
const KNOWN_ENTRY_TYPES: KnownEntryType[] = [
  {
    identity: ['company', 'position'],
    fields: [
      'company',
      'position',
      'date',
      'start_date',
      'end_date',
      'location',
      'summary',
      'highlights',
      'url',
      'doi'
    ],
    overflowField: 'summary'
  },
  {
    identity: ['institution', 'area'],
    fields: [
      'institution',
      'area',
      'degree',
      'date',
      'start_date',
      'end_date',
      'location',
      'summary',
      'highlights',
      'url',
      'doi'
    ],
    overflowField: 'summary'
  },
  {
    identity: ['title', 'authors'],
    fields: ['title', 'authors', 'journal', 'date', 'doi', 'url', 'summary'],
    overflowField: 'summary'
  },
  {
    identity: ['label', 'details'],
    fields: ['label', 'details'],
    overflowField: 'details'
  },
  { identity: ['bullet'], fields: ['bullet'], overflowField: 'bullet' },
  { identity: ['number'], fields: ['number'], overflowField: 'number' },
  {
    identity: ['reversed_number'],
    fields: ['reversed_number'],
    overflowField: 'reversed_number'
  },
  {
    identity: ['name'],
    fields: [
      'name',
      'technologies',
      'date',
      'start_date',
      'end_date',
      'location',
      'summary',
      'highlights',
      'url',
      'doi'
    ],
    overflowField: 'summary'
  }
];
const ENTRY_FIELD_SYNONYMS: Record<string, string[]> = {
  name: ['title', 'course', 'topic', 'subject', 'event', 'project', 'program'],
  title: ['paper'],
  authors: ['author'],
  company: ['organization', 'employer', 'funder', 'agency', 'host'],
  position: ['role', 'job_title', 'job'],
  institution: ['school', 'university', 'college'],
  area: ['field', 'major', 'department'],
  label: ['key', 'category', 'term'],
  details: ['value', 'description']
};

type UnknownRecord = Record<string, unknown>;
type NormalizeCompatibilityOptions = {
  variant?: CvVariantDefinition | null;
  /** The document's `locale:` section, used for dates this module renders itself. */
  locale?: string | null;
  /** The selected theme, used where themes differ in which fields they render. */
  theme?: string | null;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function joinParts(parts: unknown[], separator = ' · ') {
  const values: string[] = [];
  for (const part of parts) {
    if (part == null) {
      continue;
    }

    const text = String(part).trim();
    if (text) {
      values.push(text);
    }
  }

  if (values.length === 0) {
    return undefined;
  }

  return values.join(separator);
}

function cleanMapping(mapping: UnknownRecord) {
  const cleaned: UnknownRecord = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (value == null) {
      continue;
    }

    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

function asCustomConnections(cvData: UnknownRecord) {
  return Array.isArray(cvData.custom_connections)
    ? [...(cvData.custom_connections as unknown[]).filter(isRecord)]
    : [];
}

function asSocialNetworks(cvData: UnknownRecord) {
  return Array.isArray(cvData.social_networks)
    ? [...(cvData.social_networks as unknown[]).filter(isRecord)]
    : [];
}

function tryParseUrlLike(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol);
  } catch {
    return undefined;
  }
}

function extractSocialUsername(value: unknown) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = tryParseUrlLike(trimmed);
  if (parsed) {
    const segments = parsed.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);
    const lastSegment = segments.at(-1);
    if (lastSegment) {
      return decodeURIComponent(lastSegment).replace(/^@/, '');
    }
  }

  return trimmed.replace(/^@/, '');
}

function stringifyNumbers(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stringifyNumbers(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, stringifyNumbers(item)])
    );
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return value;
}

function sanitizeDateSentinels(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDateSentinels(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (DATE_FIELD_NAMES.has(key) && typeof item === 'string' && item.trim().toLowerCase() === 'present') {
        return [key, 'present'];
      }

      return [key, sanitizeDateSentinels(item)];
    })
  );
}

function pickFlavorValue(value: unknown, preferredFlavors: string[]): unknown {
  if (!isRecord(value) || !('flavors' in value) || !isRecord(value.flavors)) {
    return value;
  }

  const matchedValues: unknown[] = [];
  for (const flavorName of preferredFlavors) {
    const selected = value.flavors[flavorName];
    if (selected !== undefined && selected !== null && selected !== '') {
      if (Array.isArray(selected)) {
        if (selected.length > 0) {
          matchedValues.push(...selected);
        }
        continue;
      }

      return selected;
    }
  }

  if (matchedValues.length > 0) {
    return matchedValues;
  }

  return Object.values(value.flavors)[0] ?? value;
}

function normalizeFlavoredFields(entry: unknown, preferredFlavors: string[]): unknown {
  if (!isRecord(entry)) {
    return entry;
  }

  const normalized: UnknownRecord = { ...entry };
  for (const [fieldName, fieldValue] of Object.entries(normalized)) {
    if (isRecord(fieldValue) && 'flavors' in fieldValue) {
      normalized[fieldName] = pickFlavorValue(fieldValue, preferredFlavors);
    }
  }

  return normalized;
}

function stripCompatFields(entry: unknown): unknown {
  if (!isRecord(entry)) {
    return entry;
  }

  const normalized: UnknownRecord = { ...entry };
  delete normalized.itags;
  delete normalized.tags;
  delete normalized.spacing_after;
  delete normalized.show_date_in_position;
  return normalized;
}

function formatDateForDisplay(dateString: unknown, locale: DateLocale) {
  if (dateString == null) {
    return '';
  }

  const normalized = String(dateString).trim();
  if (!normalized) {
    return '';
  }

  if (normalized.toLowerCase() === 'present') {
    return locale.present;
  }

  const parts = normalized.split('-');
  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length >= 2) {
    const monthIndex = Number.parseInt(parts[1], 10) - 1;
    const monthName = locale.monthNames[monthIndex];
    if (monthName) {
      return `${monthName} ${parts[0]}`;
    }
  }

  return normalized;
}

function formatDateRangeForDisplay(startDate: unknown, endDate: unknown, locale: DateLocale) {
  const start = formatDateForDisplay(startDate, locale);
  const end = formatDateForDisplay(endDate, locale);
  if (start && end) {
    return `${start} – ${end}`;
  }

  return start || end;
}

function selectCompanyStartDate(positions: UnknownRecord[]) {
  const startDates = positions
    .map((position) => position.start_date)
    .filter((date): date is string => date != null && String(date).trim().length > 0)
    .map((date) => String(date));

  if (startDates.length === 0) {
    return undefined;
  }

  return [...startDates].sort()[0];
}

function selectCompanyEndDate(positions: UnknownRecord[]) {
  const endDates = positions
    .map((position) => position.end_date)
    .filter((date): date is string => date != null && String(date).trim().length > 0)
    .map((date) => String(date));

  if (endDates.length === 0) {
    return undefined;
  }

  if (endDates.some((date) => date.toLowerCase() === 'present')) {
    return 'present';
  }

  return [...endDates].sort().at(-1);
}

function normalizePositionTitle(position: UnknownRecord) {
  return String(position.title ?? position.position ?? '').trim();
}

function appendSummary(entry: UnknownRecord, parts: unknown[]) {
  const summary = joinParts([entry.summary, ...parts]);
  if (!summary) {
    return entry;
  }

  return {
    ...entry,
    summary
  };
}

function normalizeExperienceEntry(entry: UnknownRecord) {
  const normalized = stripCompatFields(entry);
  if (!isRecord(normalized)) {
    return entry;
  }

  const normalizedRecord = appendSummary(normalized, [
    normalized.course,
    normalized.course_level ? `Level: ${normalized.course_level}` : undefined,
    normalized.number_of_students ? `Students: ${normalized.number_of_students}` : undefined
  ]);

  delete normalizedRecord.course;
  delete normalizedRecord.course_level;
  delete normalizedRecord.number_of_students;

  return cleanMapping(normalizedRecord);
}

/**
 * Fields an experience entry (or one of its nested `positions`) may carry.
 * RenderCV's entry models set `extra="forbid"`, so anything else has to be
 * folded into the summary rather than passed through — Korean résumés commonly
 * add fields like `employment_type` (고용형태) alongside the standard ones.
 */
const EXPERIENCE_SHAPE_FIELDS = new Set([
  'company',
  'position',
  'title',
  'date',
  'start_date',
  'end_date',
  'location',
  'summary',
  'highlights',
  'url',
  'doi',
  'positions'
]);

function foldStrayExperienceFields(entry: UnknownRecord) {
  const kept: UnknownRecord = { ...entry };
  const strayParts: string[] = [];

  for (const [key, value] of Object.entries({ ...kept })) {
    if (EXPERIENCE_SHAPE_FIELDS.has(key)) {
      continue;
    }
    if (value == null || value === '' || Array.isArray(value) || isRecord(value)) {
      continue;
    }

    strayParts.push(`${key.replaceAll('_', ' ')}: ${String(value)}`);
    delete kept[key];
  }

  if (strayParts.length > 0) {
    kept.summary = joinParts([kept.summary, ...strayParts]);
  }

  return cleanMapping(kept);
}

function applyFieldSynonyms(entry: unknown) {
  if (!isRecord(entry)) {
    return entry;
  }

  const updated: UnknownRecord = { ...entry };
  for (const [canonical, synonyms] of Object.entries(ENTRY_FIELD_SYNONYMS)) {
    if (updated[canonical] != null && updated[canonical] !== '') {
      continue;
    }

    for (const synonym of synonyms) {
      const value = updated[synonym];
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
        continue;
      }

      updated[canonical] = value;
      if (synonym !== canonical) {
        delete updated[synonym];
      }
      break;
    }
  }

  return updated;
}

function detectKnownEntryType(entry: unknown): KnownEntryType | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }

  const has = (...keys: string[]) =>
    keys.every((key) => entry[key] != null && entry[key] !== '');

  return KNOWN_ENTRY_TYPES.find((entryType) => has(...entryType.identity));
}

function entryMatchesKnownType(entry: unknown) {
  if (typeof entry === 'string') {
    return true;
  }
  if (!isRecord(entry)) {
    return false;
  }

  const position = entry.position;
  if ('company' in entry && entry.company === '' && position != null && position !== '') {
    return true;
  }

  if (
    typeof position === 'string' &&
    (position.startsWith(POSITION_SPACING_SAME_MARKER) ||
      position.startsWith(POSITION_SPACING_DIFF_MARKER))
  ) {
    return true;
  }

  return detectKnownEntryType(entry) !== undefined;
}

/**
 * Keeps an entry in the RenderCV shape it already matches and folds only the
 * *stray* scalar fields into that shape's overflow field. Rewriting a valid
 * entry into some other shape (e.g. a one-line `label`/`details` pair into a
 * normal entry with `summary: "details: ..."`) is lossy, and because imports
 * persist the normalized YAML it would corrupt the author's source file.
 *
 * Arrays and mappings are left in place: RenderCV allows extra keys, and
 * flattening a nested structure into text throws its shape away.
 */
function foldStrayFieldsIntoKnownEntry(entry: UnknownRecord, entryType: KnownEntryType) {
  const kept: UnknownRecord = { ...entry };
  const knownFields = new Set(entryType.fields);
  const strayParts: string[] = [];

  for (const [key, value] of Object.entries({ ...kept })) {
    if (knownFields.has(key)) {
      continue;
    }
    if (value == null || value === '' || Array.isArray(value) || isRecord(value)) {
      continue;
    }

    strayParts.push(`${key.replaceAll('_', ' ')}: ${String(value)}`);
    delete kept[key];
  }

  if (strayParts.length > 0) {
    kept[entryType.overflowField] = joinParts([kept[entryType.overflowField], ...strayParts]);
  }

  return cleanMapping(kept);
}

function coerceUnknownEntry(entry: unknown) {
  if (!isRecord(entry)) {
    return typeof entry === 'string' ? entry : undefined;
  }

  const coerced: UnknownRecord = { ...entry };
  let titleSource: string | undefined;
  let titleValue: string | undefined;

  for (const candidate of TITLE_FIELD_CANDIDATES) {
    const value = coerced[candidate];
    if (value == null || value === '' || Array.isArray(value) || isRecord(value)) {
      continue;
    }

    titleSource = candidate;
    titleValue = String(value).trim();
    break;
  }

  if (!titleValue) {
    for (const [key, value] of Object.entries(coerced)) {
      if (ENTRY_META_FIELDS.has(key)) {
        continue;
      }
      if (value == null || value === '' || Array.isArray(value) || isRecord(value)) {
        continue;
      }

      titleSource = key;
      titleValue = String(value).trim();
      break;
    }
  }

  if (!titleValue) {
    return undefined;
  }

  coerced.name = titleValue;
  if (titleSource && titleSource !== 'name') {
    delete coerced[titleSource];
  }

  const summaryParts = coerced.summary ? [String(coerced.summary)] : [];
  for (const [key, value] of Object.entries({ ...coerced })) {
    if (
      key === 'name' ||
      key === 'summary' ||
      key === 'highlights' ||
      key === 'start_date' ||
      key === 'end_date' ||
      key === 'date' ||
      key === 'location' ||
      key === 'url' ||
      key === 'doi'
    ) {
      continue;
    }
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0) || isRecord(value)) {
      continue;
    }
    if (Array.isArray(value)) {
      continue;
    }

    summaryParts.push(`${key.replaceAll('_', ' ')}: ${String(value)}`);
    delete coerced[key];
  }

  if (summaryParts.length > 0) {
    coerced.summary = summaryParts.join(' · ');
  }

  return cleanMapping(coerced);
}

function normalizeUnknownEntry(
  entry: unknown,
  preferredFlavors: string[],
  selectedTags: string[],
  variantActive: boolean
) {
  const prepared = prepareVariantRecord(entry, preferredFlavors, selectedTags, variantActive);
  if (!prepared) {
    return undefined;
  }

  const stripped = stripCompatFields(prepared);
  const knownType = detectKnownEntryType(stripped);
  if (knownType && isRecord(stripped)) {
    return foldStrayFieldsIntoKnownEntry(stripped, knownType);
  }

  if (entryMatchesKnownType(stripped)) {
    // Continuation rows produced by `expandNestedPositions` (blank company or a
    // spacing marker) match no entry type on their own — pass them through.
    return cleanMapping(stripped as UnknownRecord);
  }

  const coerced = coerceUnknownEntry(stripped);
  if (coerced) {
    return coerced;
  }

  const adjusted = applyFieldSynonyms(stripped);
  if (entryMatchesKnownType(adjusted)) {
    if (isRecord(adjusted)) {
      if (adjusted.company != null && adjusted.position != null) {
        return normalizeExperienceEntry(adjusted);
      }
      if (adjusted.institution != null && adjusted.area != null) {
        return normalizeEducationEntry(adjusted);
      }
    }

    return cleanMapping(adjusted as UnknownRecord);
  }

  return undefined;
}

function normalizeEducationEntry(entry: UnknownRecord) {
  const normalized = stripCompatFields(entry);
  if (!isRecord(normalized)) {
    return entry;
  }

  const normalizedRecord = appendSummary(normalized, [
    normalized.supervisor ? `Supervisor: ${normalized.supervisor}` : undefined
  ]);

  delete normalizedRecord.supervisor;
  return cleanMapping(normalizedRecord);
}

function normalizeAwardEntry(entry: UnknownRecord) {
  const normalized = stripCompatFields(entry);
  if (!isRecord(normalized)) {
    return entry;
  }

  const normalizedRecord = appendSummary(normalized, [
    normalized.amount ? `Amount: ${normalized.amount}` : undefined
  ]);

  delete normalizedRecord.amount;
  return cleanMapping(normalizedRecord);
}

function expandNestedPositions(
  entry: unknown,
  preferredFlavors: string[],
  selectedTags: string[],
  variantActive: boolean,
  locale: DateLocale
): UnknownRecord[] {
  if (!isRecord(entry)) {
    return [];
  }

  const preparedEntry = normalizeFlavoredFields(entry, preferredFlavors);
  if (!isRecord(preparedEntry) || !matchesEntryVariant(preparedEntry, selectedTags, variantActive)) {
    return [];
  }

  const normalizedEntry = foldStrayExperienceFields(normalizeExperienceEntry(preparedEntry));
  const positions = normalizedEntry.positions;
  if (!Array.isArray(positions)) {
    return [normalizedEntry];
  }

  const visiblePositions = positions
    .map((position) => normalizeFlavoredFields(position, preferredFlavors))
    .filter(isRecord)
    .filter((position) => matchesEntryVariant(position, selectedTags, variantActive))
    .map((position) => foldStrayExperienceFields(normalizeExperienceEntry(position)))
    .filter((position) => isRecord(position));

  if (visiblePositions.length === 0) {
    return [];
  }

  const baseEntry: UnknownRecord = { ...normalizedEntry };
  const showDateInPosition = Boolean(entry.show_date_in_position);
  delete baseEntry.positions;
  delete baseEntry.show_date_in_position;

  const companyStartDate = selectCompanyStartDate(visiblePositions);
  const companyEndDate = selectCompanyEndDate(visiblePositions);
  const includePositionDates = visiblePositions.length > 1 || showDateInPosition;

  return visiblePositions.map((position, index) => {
    const item: UnknownRecord = { ...baseEntry };
    const positionTitle = normalizePositionTitle(position) || String(item.position ?? '').trim();
    let positionText = positionTitle;

    if (includePositionDates && positionTitle) {
      const positionDateRange = formatDateRangeForDisplay(
        position.start_date,
        position.end_date,
        locale
      );
      if (positionDateRange) {
        positionText = `${positionTitle} | ${positionDateRange}`;
      }
    }

    const marker =
      index < visiblePositions.length - 1 ? POSITION_SPACING_SAME_MARKER : POSITION_SPACING_DIFF_MARKER;
    if (positionText) {
      item.position = `${marker}${positionText}`;
    }

    if (index === 0) {
      if (companyStartDate) {
        item.start_date = companyStartDate;
      } else if (position.start_date) {
        item.start_date = position.start_date;
      }

      if (companyEndDate) {
        item.end_date = companyEndDate;
      } else if (position.end_date) {
        item.end_date = position.end_date;
      }
    } else {
      item.company = '';
      if (position.start_date) {
        item.start_date = position.start_date;
      }
      if (position.end_date) {
        item.end_date = position.end_date;
      }
    }

    if (position.summary) {
      item.summary = position.summary;
    }
    if (position.highlights) {
      item.highlights = position.highlights;
    }
    if (position.location) {
      item.location = position.location;
    }

    return cleanMapping(item);
  });
}

function prepareVariantRecord(
  entry: unknown,
  preferredFlavors: string[],
  selectedTags: string[],
  variantActive: boolean
) {
  const normalized = normalizeFlavoredFields(entry, preferredFlavors);
  if (!isRecord(normalized) || !matchesEntryVariant(normalized, selectedTags, variantActive)) {
    return undefined;
  }

  return normalized;
}

function normalizePublications(
  entries: unknown[],
  preferredFlavors: string[],
  selectedTags: string[],
  variantActive: boolean
) {
  return entries.flatMap((entry) => {
    const prepared = prepareVariantRecord(entry, preferredFlavors, selectedTags, variantActive);
    if (!prepared) {
      return [];
    }

    const item = stripCompatFields(prepared);
    if (!isRecord(item)) {
      return [];
    }

    let authors = item.authors;
    if (isRecord(authors) && 'flavors' in authors) {
      authors = pickFlavorValue(authors, preferredFlavors);
    }
    if (authors && !Array.isArray(authors)) {
      authors = [authors];
    }

    let journal: string | undefined;
    if (item.journal) {
      journal = String(item.journal).trim();
      if (item.volume && item.issue) {
        journal = `${journal}, ${item.volume}(${item.issue})`;
      } else if (item.volume) {
        journal = `${journal}, ${item.volume}`;
      }
    } else {
      journal = joinParts([item.institution, item.type]);
    }

    const doi = item.doi;
    const url = item.url ?? (doi ? `https://doi.org/${doi}` : undefined);

    return [
      cleanMapping({
        name: item.title,
        date: item.date,
        summary: joinParts([
          journal,
          Array.isArray(authors) ? authors.map((author) => String(author)).join(', ') : undefined,
          item.summary,
          item.editor ? `Editor: ${item.editor}` : undefined,
          item.publisher,
          item.pages ? `Pages: ${item.pages}` : undefined,
          doi ? `DOI: ${doi}` : undefined,
          url && !doi ? url : undefined
        ])
      })
    ];
  });
}

function normalizeTeachingEntries(
  entries: unknown[],
  preferredFlavors: string[],
  selectedTags: string[],
  variantActive: boolean
) {
  return entries.flatMap((entry) => {
    const prepared = prepareVariantRecord(entry, preferredFlavors, selectedTags, variantActive);
    if (!prepared) {
      return [];
    }

    const item = stripCompatFields(prepared);
    if (!isRecord(item)) {
      return [];
    }

    const course = item.course ?? item.name ?? item.title;
    const company = course ?? item.organization ?? item.institution ?? item.company ?? 'Teaching';
    const position = item.position ?? item.role ?? 'Instructor';
    const organization = item.organization ?? item.institution ?? item.company;

    return [
      cleanMapping({
        company,
        position,
        location: item.location,
        date: item.date,
        start_date: item.start_date,
        end_date: item.end_date,
        summary: joinParts([
          organization,
          item.course_level ? `Level: ${item.course_level}` : undefined,
          item.summary
        ]),
        highlights: item.highlights
      })
    ];
  });
}

function normalizeSupervisoryActivities(
  entries: unknown[],
  preferredFlavors: string[],
  selectedTags: string[],
  variantActive: boolean
) {
  return entries.flatMap((entry) => {
    const prepared = prepareVariantRecord(entry, preferredFlavors, selectedTags, variantActive);
    if (!prepared) {
      return [];
    }

    if ('label' in prepared && 'details' in prepared) {
      return [cleanMapping(prepared)];
    }

    return Object.entries(prepared)
      .filter(([, value]) => value != null)
      .map(([key, value]) =>
        cleanMapping({
          label: key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
          details: String(value)
        })
      );
  });
}

function normalizeSocialConnections(cvData: UnknownRecord) {
  const socialNetworks = asSocialNetworks(cvData);
  const customConnections = asCustomConnections(cvData);

  const socialEntries = cvData.social;
  if (Array.isArray(socialEntries)) {
    delete cvData.social;
  }

  if (Array.isArray(socialEntries)) {
    for (const entry of socialEntries) {
      if (!isRecord(entry)) {
        continue;
      }

      const network = entry.network;
      const username = entry.username;
      const url = entry.url;

      if (typeof network === 'string' && SUPPORTED_SOCIAL_NETWORKS.has(network) && username) {
        socialNetworks.push({
          network,
          username: String(username)
        });
        continue;
      }

      if (network && (username || url)) {
        customConnections.push({
          fontawesome_icon:
            typeof network === 'string' ? (CUSTOM_CONNECTION_ICONS[network] ?? 'link') : 'link',
          placeholder: String(username ?? network),
          url
        });
      }
    }
  }

  for (const [fieldName, network] of Object.entries(TOP_LEVEL_SOCIAL_FIELD_MAP)) {
    const rawValue = cvData[fieldName];
    if (rawValue == null || rawValue === '') {
      continue;
    }

    delete cvData[fieldName];

    const username = extractSocialUsername(rawValue);
    if (!username) {
      continue;
    }

    const alreadyPresent = socialNetworks.some(
      (entry) => entry.network === network && String(entry.username ?? '') === username
    );

    if (!alreadyPresent) {
      socialNetworks.push({ network, username });
    }
  }

  if (socialNetworks.length > 0) {
    cvData.social_networks = socialNetworks;
  }
  if (customConnections.length > 0) {
    cvData.custom_connections = customConnections;
  }
}

function normalizeAddressConnection(cvData: UnknownRecord) {
  const rawAddress = cvData.address;
  if (rawAddress == null || rawAddress === '') {
    return;
  }

  delete cvData.address;

  const address = String(rawAddress).trim();
  if (!address) {
    return;
  }

  if (typeof cvData.location !== 'string' || !cvData.location.trim()) {
    cvData.location = address;
    return;
  }

  const customConnections = asCustomConnections(cvData);
  const alreadyPresent = customConnections.some(
    (entry) =>
      String(entry.fontawesome_icon ?? '') === 'location-dot' &&
      String(entry.placeholder ?? '') === address
  );

  if (!alreadyPresent) {
    customConnections.push({
      fontawesome_icon: 'location-dot',
      placeholder: address,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    });
  }

  if (customConnections.length > 0) {
    cvData.custom_connections = customConnections;
  }
}

/**
 * Additional renderings of the author's name, in the order a CJK résumé prints
 * them. Korean and Japanese application forms routinely carry the name three
 * times (한글 / 漢字 / Latin), and RenderCV's `cv` mapping only has one `name`,
 * so the extra renderings would otherwise be dropped.
 */
const ALTERNATE_NAME_FIELDS = [
  'name_hangul',
  'name_native',
  'name_hanja',
  'name_hanzi',
  'name_kanji',
  'name_kana',
  'name_romanized',
  'name_english'
];

/**
 * Themes whose header template has no headline slot, so anything folded into
 * `headline` is silently dropped from the render. For these the alternate
 * names go next to the name instead, which every theme prints.
 */
const THEMES_WITHOUT_HEADLINE = new Set(['ahmadstyle', 'tylerstyle', 'phddeedy']);

export function themeRendersHeadline(themeName: string | undefined | null) {
  return !themeName || !THEMES_WITHOUT_HEADLINE.has(themeName);
}

function normalizeAlternateNames(cvData: UnknownRecord, themeName: string | undefined | null) {
  const alternates: string[] = [];
  for (const field of ALTERNATE_NAME_FIELDS) {
    const value = cvData[field];
    delete cvData[field];
    if (value == null || Array.isArray(value) || isRecord(value)) {
      continue;
    }

    const text = String(value).trim();
    if (text && text !== String(cvData.name ?? '').trim()) {
      alternates.push(text);
    }
  }

  if (alternates.length === 0) {
    return;
  }

  if (!themeRendersHeadline(themeName)) {
    const name = String(cvData.name ?? '').trim();
    // `김윤서 (金允誓 · Yunseo Kim)` — how a CJK résumé prints the renderings
    // together when there is only one line to put them on.
    cvData.name = name ? `${name} (${alternates.join(' · ')})` : alternates.join(' · ');
    return;
  }

  const headline = typeof cvData.headline === 'string' ? cvData.headline.trim() : '';
  cvData.headline = joinParts([headline || undefined, ...alternates]);
}

function normalizeDateOfBirthConnection(cvData: UnknownRecord) {
  const rawDateOfBirth = cvData.date_of_birth;
  delete cvData.date_of_birth;
  if (rawDateOfBirth == null || Array.isArray(rawDateOfBirth) || isRecord(rawDateOfBirth)) {
    return;
  }

  const dateOfBirth = String(rawDateOfBirth).trim();
  if (!dateOfBirth) {
    return;
  }

  const customConnections = asCustomConnections(cvData);
  const alreadyPresent = customConnections.some(
    (entry) => String(entry.placeholder ?? '') === dateOfBirth
  );

  if (!alreadyPresent) {
    // A birth date has nothing to link to, but RenderCV's CustomConnection
    // declares `url` as nullable without a default, so it must still be set.
    customConnections.push({
      fontawesome_icon: 'cake-candles',
      placeholder: dateOfBirth,
      url: null
    });
  }

  cvData.custom_connections = customConnections;
}

function humanizeKey(key: string) {
  const spaced = key.replaceAll('_', ' ').trim();
  if (!spaced) {
    return key;
  }

  // Only Latin text gets title-cased; Hangul, Kana and Han have no case, and
  // uppercasing their code points would be a no-op at best.
  return spaced.replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

function flattenMappingSection(section: UnknownRecord, collected: [string, string][] = []) {
  for (const [key, value] of Object.entries(section)) {
    if (isRecord(value)) {
      flattenMappingSection(value, collected);
      continue;
    }

    const text = Array.isArray(value)
      ? value
          .filter((item) => item != null && !Array.isArray(item) && !isRecord(item))
          .map((item) => String(item).trim())
          .filter(Boolean)
          .join(', ')
      : value == null
        ? ''
        : String(value).trim();

    if (text) {
      collected.push([humanizeKey(key), text]);
    }
  }

  return collected;
}

/**
 * Turn a section written as a mapping into RenderCV entries.
 *
 * Korean 자기소개서 sections are naturally authored as `prompt: answer` pairs
 * rather than a list, and RenderCV only accepts a list of entries.
 *
 * RenderCV infers a section's entry type from its first entry and then
 * validates every other entry against that one type, so the entries here have
 * to be uniform. Short answers become one-line `label`/`details` rows, which is
 * how a keyword list reads best; as soon as one answer is long enough to be
 * prose the whole section becomes normal entries instead, so the text gets a
 * paragraph rather than being squeezed onto a single line.
 */
const ONE_LINE_ANSWER_MAX_LENGTH = 120;

function normalizeMappingSection(section: UnknownRecord) {
  const answers = flattenMappingSection(section);
  const fitsOnOneLine = answers.every(([, text]) => text.length <= ONE_LINE_ANSWER_MAX_LENGTH);

  return answers.map(([label, text]) =>
    fitsOnOneLine ? { label, details: text } : { name: label, summary: text }
  );
}

function normalizeMediaEntries(
  entries: unknown[],
  preferredFlavors: string[],
  selectedTags: string[],
  variantActive: boolean
) {
  return entries.flatMap((entry) => {
    const prepared = prepareVariantRecord(entry, preferredFlavors, selectedTags, variantActive);
    if (!prepared) {
      return [];
    }

    const normalized = stripCompatFields(prepared);
    if (!isRecord(normalized)) {
      return [];
    }

    return [
      cleanMapping({
        name: normalized.name,
        location: normalized.location,
        date: normalized.date,
        url: normalized.url,
        summary: joinParts([
          normalized.summary,
          normalized.type,
          normalized.program ?? normalized.forum,
          normalized.network,
          normalized.interviewer ? `Interviewer: ${normalized.interviewer}` : undefined
        ]),
        highlights: normalized.highlights
      })
    ];
  });
}

function normalizeMembershipEntries(
  entries: unknown[],
  preferredFlavors: string[],
  selectedTags: string[],
  variantActive: boolean
) {
  return entries.flatMap((entry) => {
    const prepared = prepareVariantRecord(entry, preferredFlavors, selectedTags, variantActive);
    if (!prepared) {
      return [];
    }

    const normalized = stripCompatFields(prepared);
    if (!isRecord(normalized)) {
      return [];
    }

    return [
      cleanMapping({
        name: normalized.name,
        date: normalized.start_date,
        summary: joinParts([normalized.role, normalized.organization])
      })
    ];
  });
}

function normalizeEventAdministrationEntries(
  entries: unknown[],
  preferredFlavors: string[],
  selectedTags: string[],
  variantActive: boolean
) {
  return entries.flatMap((entry) => {
    const prepared = prepareVariantRecord(entry, preferredFlavors, selectedTags, variantActive);
    if (!prepared) {
      return [];
    }

    const normalized = stripCompatFields(prepared);
    if (!isRecord(normalized)) {
      return [];
    }

    return [
      cleanMapping({
        name: normalized.name,
        location: normalized.location,
        date: normalized.date,
        summary: joinParts([normalized.type, normalized.role]),
        highlights: normalized.highlights
      })
    ];
  });
}

function normalizeResearchKeywords(entries: unknown[]) {
  return entries.flatMap((entry) => {
    if (entry == null) {
      return [];
    }

    const text = String(entry).trim();
    if (!text) {
      return [];
    }

    return [
      {
        label: 'Keyword',
        details: text
      }
    ];
  });
}

function normalizeSectionEntries(
  sectionName: string,
  entries: unknown[],
  preferredFlavors: string[],
  selectedTags: string[],
  variantActive: boolean,
  locale: DateLocale
) {
  switch (sectionName) {
    case 'experience':
    case 'volunteer':
      return entries.flatMap((entry) =>
        expandNestedPositions(entry, preferredFlavors, selectedTags, variantActive, locale)
      );
    case 'education':
      return entries.flatMap((entry) => {
        const prepared = prepareVariantRecord(entry, preferredFlavors, selectedTags, variantActive);
        return prepared ? [normalizeEducationEntry(prepared)] : [];
      });
    case 'awards':
      return entries.flatMap((entry) => {
        const prepared = prepareVariantRecord(entry, preferredFlavors, selectedTags, variantActive);
        return prepared ? [normalizeAwardEntry(prepared)] : [];
      });
    case 'publications':
      return normalizePublications(entries, preferredFlavors, selectedTags, variantActive);
    case 'teaching':
      return normalizeTeachingEntries(entries, preferredFlavors, selectedTags, variantActive);
    case 'supervisory_activities':
      return normalizeSupervisoryActivities(entries, preferredFlavors, selectedTags, variantActive);
    case 'media':
      return normalizeMediaEntries(entries, preferredFlavors, selectedTags, variantActive);
    case 'memberships':
      return normalizeMembershipEntries(entries, preferredFlavors, selectedTags, variantActive);
    case 'event_administration':
      return normalizeEventAdministrationEntries(entries, preferredFlavors, selectedTags, variantActive);
    case 'research_keywords':
      return normalizeResearchKeywords(entries);
    default:
      return entries.reduce<unknown[]>((normalizedEntries, entry) => {
        if (typeof entry === 'string') {
          const text = entry.trim();
          if (text) {
            normalizedEntries.push(text);
          }
          return normalizedEntries;
        }

        const normalized = normalizeUnknownEntry(
          entry,
          preferredFlavors,
          selectedTags,
          variantActive
        );
        if (normalized) {
          normalizedEntries.push(normalized);
        }

        return normalizedEntries;
      }, []);
  }
}

function stripPositionMarker(position: string) {
  if (position.startsWith(POSITION_SPACING_SAME_MARKER)) {
    return position.slice(POSITION_SPACING_SAME_MARKER.length);
  }

  if (position.startsWith(POSITION_SPACING_DIFF_MARKER)) {
    return position.slice(POSITION_SPACING_DIFF_MARKER.length);
  }

  return position;
}

function parseDisplayDate(dateText: string, locale: DateLocale) {
  const normalized = dateText.trim();
  if (!normalized) {
    return undefined;
  }

  if (
    normalized.toLowerCase() === 'present' ||
    normalized === locale.present ||
    normalized === ENGLISH_DATE_LOCALE.present
  ) {
    return 'present';
  }

  if (/^\d{4}$/.test(normalized)) {
    return normalized;
  }

  // The month name is not necessarily alphabetic: Korean renders "3월 2025".
  const monthMatch = normalized.match(/^(\S+)\s+(\d{4})$/);
  if (!monthMatch) {
    return undefined;
  }

  const [, monthName, year] = monthMatch;
  const month = monthNumbersByName(locale)[monthName];
  if (!month) {
    return undefined;
  }

  return `${year}-${month}`;
}

function splitPositionDateSuffix(position: string, locale: DateLocale) {
  const separatorIndex = position.lastIndexOf(' | ');
  if (separatorIndex < 0) {
    return undefined;
  }

  const title = position.slice(0, separatorIndex).trim();
  const rawRange = position.slice(separatorIndex + 3).trim();
  if (!title || !rawRange) {
    return undefined;
  }

  const [rawStart, rawEnd] = rawRange.split(/\s+[–-]\s+/, 2);
  const startDate = rawStart ? parseDisplayDate(rawStart, locale) : undefined;
  const endDate = rawEnd ? parseDisplayDate(rawEnd, locale) : undefined;
  if (!startDate && !endDate) {
    return undefined;
  }

  return {
    title,
    startDate,
    endDate
  };
}

function isContinuationEntry(entry: unknown) {
  return (
    isRecord(entry) &&
    typeof entry.position === 'string' &&
    String(entry.company ?? '').trim().length === 0
  );
}

export function stripPositionMarkersFromCvYaml(yamlText: string) {
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlText);
  } catch {
    return yamlText;
  }
  if (!isRecord(parsed)) {
    return yamlText;
  }

  const cvData = parsed.cv;
  if (!isRecord(cvData)) {
    return yamlText;
  }

  const sections = cvData.sections;
  if (!isRecord(sections)) {
    return yamlText;
  }

  for (const entries of Object.values(sections)) {
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      if (!isRecord(entry) || typeof entry.position !== 'string') {
        continue;
      }

      entry.position = stripPositionMarker(entry.position);
    }
  }

  return YAML.stringify(parsed);
}

export function repairFlattenedPositionDatesInCvYaml(
  yamlText: string,
  localeYaml?: string | null
) {
  const locale = resolveDateLocale(localeYaml);

  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlText);
  } catch {
    return yamlText;
  }
  if (!isRecord(parsed)) {
    return yamlText;
  }

  const cvData = parsed.cv;
  if (!isRecord(cvData)) {
    return yamlText;
  }

  const sections = cvData.sections;
  if (!isRecord(sections)) {
    return yamlText;
  }

  for (const entries of Object.values(sections)) {
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      if (!isRecord(entry) || typeof entry.position !== 'string') {
        continue;
      }

      const cleanedPosition = stripPositionMarker(entry.position);
      const parsedPosition = splitPositionDateSuffix(cleanedPosition, locale);
      if (!parsedPosition) {
        entry.position = cleanedPosition;
        continue;
      }

      entry.position = parsedPosition.title;
      if (parsedPosition.startDate) {
        entry.start_date = parsedPosition.startDate;
      }
      if (parsedPosition.endDate) {
        entry.end_date = parsedPosition.endDate;
      }
    }
  }

  return YAML.stringify(parsed);
}

// Themes whose ExperienceEntry template reads the RCVSPACING position markers
// to tell "next position at the same company" from "next company" apart. For
// these the markers must survive into the render instead of being stripped, and
// flattened `position | dates` strings must not be repaired back into columns.
const POSITION_MARKER_THEMES = new Set(['ahmadstyle', 'tylerstyle']);

export function themeUsesPositionSpacingMarkers(themeName: string | undefined) {
  return themeName !== undefined && POSITION_MARKER_THEMES.has(themeName);
}

export function restoreAhmadStylePositionMarkersInCvYaml(yamlText: string) {
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlText);
  } catch {
    return yamlText;
  }
  if (!isRecord(parsed)) {
    return yamlText;
  }

  const cvData = parsed.cv;
  if (!isRecord(cvData)) {
    return yamlText;
  }

  const sections = cvData.sections;
  if (!isRecord(sections)) {
    return yamlText;
  }

  for (const entries of Object.values(sections)) {
    if (!Array.isArray(entries)) {
      continue;
    }

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!isRecord(entry) || typeof entry.position !== 'string') {
        continue;
      }

      const nextEntry = entries[index + 1];
      const cleanedPosition = stripPositionMarker(entry.position);
      entry.position = isContinuationEntry(nextEntry)
        ? `${POSITION_SPACING_SAME_MARKER}${cleanedPosition}`
        : cleanedPosition;
    }
  }

  return YAML.stringify(parsed);
}

export function normalizeCompatibilityCvYaml(
  yamlText: string,
  options?: NormalizeCompatibilityOptions
) {
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlText);
  } catch {
    return yamlText;
  }
  if (!isRecord(parsed)) {
    return yamlText;
  }

  const cvData = parsed.cv;
  if (!isRecord(cvData)) {
    return yamlText;
  }

  normalizeSocialConnections(cvData);
  normalizeAddressConnection(cvData);
  normalizeAlternateNames(cvData, options?.theme);
  normalizeDateOfBirthConnection(cvData);

  const locale = resolveDateLocale(options?.locale);
  const variantActive = Boolean(options?.variant);
  const selectedTags = normalizeStringList(options?.variant?.tags);
  const preferredFlavors = normalizeStringList(options?.variant?.flavors);
  const excludedSections = new Set(
    variantActive ? normalizeStringList(options?.variant?.exclude_sections) : []
  );
  const sections = cvData.sections;
  if (isRecord(sections)) {
    for (const [sectionName, entries] of Object.entries(sections)) {
      if (excludedSections.has(sectionName)) {
        delete sections[sectionName];
        continue;
      }

      if (isRecord(entries)) {
        // A section authored as `prompt: answer` pairs instead of a list.
        sections[sectionName] = normalizeMappingSection(entries);
        continue;
      }

      if (!Array.isArray(entries)) {
        continue;
      }

      sections[sectionName] = normalizeSectionEntries(
        sectionName,
        entries,
        preferredFlavors,
        selectedTags,
        variantActive,
        locale
      );

      if (sectionName === 'publications') {
        const existingResearchPublications = Array.isArray(sections.research_publications)
          ? sections.research_publications
          : [];
        sections.research_publications = [
          ...existingResearchPublications,
          ...(Array.isArray(sections[sectionName]) ? sections[sectionName] : [])
        ];
        delete sections[sectionName];
      }
    }
  }

  return YAML.stringify(stringifyNumbers(sanitizeDateSentinels(parsed)));
}
