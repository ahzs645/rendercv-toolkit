import YAML from 'yaml';
import { entryFingerprint, topLevelEntryListFromKey } from './fingerprints';
import {
  normalizeCompatibilityCvYaml,
  repairFlattenedPositionDatesInCvYaml,
  restoreAhmadStylePositionMarkersInCvYaml,
  stripPositionMarkersFromCvYaml,
  themeUsesPositionSpacingMarkers
} from './normalize-compat-cv';
import type {
  CompiledRenderCvDocument,
  CompiledRenderCvSections,
  CvVariantDefinition,
  RenderCvSections
} from './types';

export const RENDERCV_COMPILER_VERSION = '1.0.0';
const DEFAULT_MAX_YAML_BYTES = 1024 * 1024;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDocument(yaml: string, maxBytes = DEFAULT_MAX_YAML_BYTES): UnknownRecord {
  if (new TextEncoder().encode(yaml).byteLength > maxBytes) {
    throw new Error(`RenderCV YAML exceeds the ${maxBytes}-byte compiler limit.`);
  }
  const parsed = YAML.parse(yaml, { maxAliasCount: 50 });
  if (!isRecord(parsed) || !isRecord(parsed.cv)) {
    throw new Error('RenderCV document must contain a top-level cv mapping.');
  }
  return parsed;
}

function removeEntries(document: UnknownRecord, hidden: Record<string, string[]> | undefined) {
  if (!hidden || !isRecord(document.cv)) return;
  const cv = document.cv;
  const sections = isRecord(cv.sections) ? cv.sections : null;
  for (const [key, fingerprints] of Object.entries(hidden)) {
    const topLevel = topLevelEntryListFromKey(key);
    const container = topLevel ? cv : sections;
    const containerKey = topLevel ?? key;
    if (!container || !Array.isArray(container[containerKey])) continue;
    const excluded = new Set(fingerprints);
    const entries = container[containerKey].filter((entry) => !excluded.has(entryFingerprint(entry)));
    if (entries.length) container[containerKey] = entries;
    else delete container[containerKey];
  }
}

function removeSections(document: UnknownRecord, disabledSections: string[] | undefined) {
  if (!disabledSections?.length || !isRecord(document.cv) || !isRecord(document.cv.sections)) return;
  for (const section of disabledSections) delete document.cv.sections[section];
}

function stripEmptySections(yaml: string): string {
  const document = parseDocument(yaml);
  if (!isRecord(document.cv) || !isRecord(document.cv.sections)) return yaml;
  for (const [key, entries] of Object.entries(document.cv.sections)) {
    if (Array.isArray(entries) && entries.length === 0) delete document.cv.sections[key];
  }
  return YAML.stringify(document);
}

function readTheme(document: UnknownRecord): string | null {
  return isRecord(document.design) && typeof document.design.theme === 'string'
    ? document.design.theme.trim() || null
    : null;
}

export function compileRenderCvDocument(input: {
  yaml: string;
  variant?: CvVariantDefinition | null;
  variantKey?: string | null;
  hiddenEntries?: Record<string, string[]>;
  disabledSections?: string[];
  maxBytes?: number;
}): CompiledRenderCvDocument {
  const source = parseDocument(input.yaml, input.maxBytes);
  removeEntries(source, input.hiddenEntries);
  removeEntries(source, input.variant?.exclude_entries);
  removeSections(source, input.disabledSections);

  const normalized = normalizeCompatibilityCvYaml(YAML.stringify(source), { variant: input.variant });
  const normalizedDocument = parseDocument(normalized, input.maxBytes);
  const theme = readTheme(normalizedDocument);
  const withoutMarkers = stripPositionMarkersFromCvYaml(normalized);
  const positioned = themeUsesPositionSpacingMarkers(theme ?? undefined)
    ? restoreAhmadStylePositionMarkersInCvYaml(withoutMarkers)
    : repairFlattenedPositionDatesInCvYaml(withoutMarkers);
  const yaml = stripEmptySections(positioned);
  parseDocument(yaml, input.maxBytes);
  return {
    yaml,
    compilerVersion: RENDERCV_COMPILER_VERSION,
    theme,
    variantKey: input.variantKey?.trim() || null
  };
}

export function validateRenderCvDocument(yaml: string, maxBytes?: number): void {
  parseDocument(yaml, maxBytes);
}

function parseOptionalSection(yaml: string | undefined, key: string): UnknownRecord {
  if (!yaml?.trim()) return {};
  const parsed = YAML.parse(yaml, { maxAliasCount: 50 });
  if (!isRecord(parsed)) throw new Error(`RenderCV ${key} section must be a YAML mapping.`);
  return parsed;
}

export function compileRenderCvSections(input: {
  sections: RenderCvSections;
  variant?: CvVariantDefinition | null;
  variantKey?: string | null;
  hiddenEntries?: Record<string, string[]>;
  disabledSections?: string[];
  maxBytes?: number;
}): CompiledRenderCvSections {
  const combined = {
    ...parseOptionalSection(input.sections.cv, 'cv'),
    ...parseOptionalSection(input.sections.design, 'design'),
    ...parseOptionalSection(input.sections.locale, 'locale'),
    ...parseOptionalSection(input.sections.settings, 'settings')
  };
  const compiled = compileRenderCvDocument({
    yaml: YAML.stringify(combined),
    variant: input.variant,
    variantKey: input.variantKey,
    hiddenEntries: input.hiddenEntries,
    disabledSections: input.disabledSections,
    maxBytes: input.maxBytes
  });
  const parsed = parseDocument(compiled.yaml, input.maxBytes);
  return {
    ...compiled,
    sections: {
      cv: YAML.stringify({ cv: parsed.cv }),
      design: parsed.design === undefined ? '' : YAML.stringify({ design: parsed.design }),
      locale: parsed.locale === undefined ? '' : YAML.stringify({ locale: parsed.locale }),
      settings: parsed.settings === undefined ? '' : YAML.stringify({ settings: parsed.settings })
    }
  };
}
