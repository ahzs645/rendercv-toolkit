import type { CvVariants } from './types';
import YAML from 'yaml';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function readExcludeEntries(value: unknown) {
  if (!isRecord(value)) return undefined;
  const entries = Object.fromEntries(Object.entries(value).flatMap(([key, fingerprints]) => {
    const values = readStringList(fingerprints);
    return values ? [[key, values]] : [];
  }));
  return Object.keys(entries).length ? entries : undefined;
}

export function parseCvVariantsYaml(content: string, options: { maxBytes?: number; maxVariants?: number } = {}): CvVariants {
  const maxBytes = options.maxBytes ?? 256 * 1024;
  if (new TextEncoder().encode(content).byteLength > maxBytes) {
    throw new Error(`Variants YAML exceeds the ${maxBytes}-byte parser limit.`);
  }
  const parsed = YAML.parse(content, { maxAliasCount: 50 });
  const variantsRoot =
    isRecord(parsed) && isRecord(parsed.variants)
      ? parsed.variants
      : isRecord(parsed)
        ? parsed
        : undefined;

  if (!variantsRoot) {
    throw new Error('Expected a variants file with a top-level variants: mapping.');
  }

  const sourceEntries = Object.entries(variantsRoot);
  if (sourceEntries.length > (options.maxVariants ?? 100)) {
    throw new Error(`Variants file exceeds the ${options.maxVariants ?? 100}-variant limit.`);
  }
  const variants = Object.fromEntries(
    sourceEntries.flatMap(([key, value]) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(key)) {
        throw new Error(`Invalid variant key: ${key}`);
      }
      if (!isRecord(value)) {
        return [];
      }

      return [
        [
          key,
          {
            description: typeof value.description === 'string' ? value.description : undefined,
            exclude_sections: readStringList(value.exclude_sections),
            exclude_entries: readExcludeEntries(value.exclude_entries),
            tags: readStringList(value.tags),
            flavors: readStringList(value.flavors)
          }
        ]
      ];
    })
  );

  if (Object.keys(variants).length === 0) {
    throw new Error('This variants file does not define any usable variants.');
  }

  return variants;
}
