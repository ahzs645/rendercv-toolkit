import YAML from 'yaml';
import { entryFingerprint, topLevelEntryListFromKey } from './fingerprints';
import { normalizeCompatibilityCvYaml, repairFlattenedPositionDatesInCvYaml, restoreAhmadStylePositionMarkersInCvYaml, stripPositionMarkersFromCvYaml, themeUsesPositionSpacingMarkers } from './normalize-compat-cv';
export const RENDERCV_COMPILER_VERSION = '1.0.0';
const DEFAULT_MAX_YAML_BYTES = 1024 * 1024;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseDocument(yaml, maxBytes = DEFAULT_MAX_YAML_BYTES) {
    if (new TextEncoder().encode(yaml).byteLength > maxBytes) {
        throw new Error(`RenderCV YAML exceeds the ${maxBytes}-byte compiler limit.`);
    }
    const parsed = YAML.parse(yaml, { maxAliasCount: 50 });
    if (!isRecord(parsed) || !isRecord(parsed.cv)) {
        throw new Error('RenderCV document must contain a top-level cv mapping.');
    }
    return parsed;
}
function removeEntries(document, hidden) {
    if (!hidden || !isRecord(document.cv))
        return;
    const cv = document.cv;
    const sections = isRecord(cv.sections) ? cv.sections : null;
    for (const [key, fingerprints] of Object.entries(hidden)) {
        const topLevel = topLevelEntryListFromKey(key);
        const container = topLevel ? cv : sections;
        const containerKey = topLevel ?? key;
        if (!container || !Array.isArray(container[containerKey]))
            continue;
        const excluded = new Set(fingerprints);
        const entries = container[containerKey].filter((entry) => !excluded.has(entryFingerprint(entry)));
        if (entries.length)
            container[containerKey] = entries;
        else
            delete container[containerKey];
    }
}
function removeSections(document, disabledSections) {
    if (!disabledSections?.length || !isRecord(document.cv) || !isRecord(document.cv.sections))
        return;
    for (const section of disabledSections)
        delete document.cv.sections[section];
}
function stripEmptySections(yaml) {
    const document = parseDocument(yaml);
    if (!isRecord(document.cv) || !isRecord(document.cv.sections))
        return yaml;
    for (const [key, entries] of Object.entries(document.cv.sections)) {
        if (Array.isArray(entries) && entries.length === 0)
            delete document.cv.sections[key];
    }
    return YAML.stringify(document);
}
function readTheme(document) {
    return isRecord(document.design) && typeof document.design.theme === 'string'
        ? document.design.theme.trim() || null
        : null;
}
export function compileRenderCvDocument(input) {
    const source = parseDocument(input.yaml, input.maxBytes);
    removeEntries(source, input.hiddenEntries);
    removeEntries(source, input.variant?.exclude_entries);
    removeSections(source, input.disabledSections);
    // The `locale:` section travels inside the same document here, so the dates
    // the normalizer renders itself follow the CV's language.
    const localeYaml = source.locale === undefined ? undefined : YAML.stringify({ locale: source.locale });
    const normalized = normalizeCompatibilityCvYaml(YAML.stringify(source), {
        variant: input.variant,
        locale: localeYaml,
        theme: readTheme(source)
    });
    const normalizedDocument = parseDocument(normalized, input.maxBytes);
    const theme = readTheme(normalizedDocument);
    const withoutMarkers = stripPositionMarkersFromCvYaml(normalized);
    const positioned = themeUsesPositionSpacingMarkers(theme ?? undefined)
        ? restoreAhmadStylePositionMarkersInCvYaml(withoutMarkers)
        : repairFlattenedPositionDatesInCvYaml(withoutMarkers, localeYaml);
    const yaml = stripEmptySections(positioned);
    parseDocument(yaml, input.maxBytes);
    return {
        yaml,
        compilerVersion: RENDERCV_COMPILER_VERSION,
        theme,
        variantKey: input.variantKey?.trim() || null
    };
}
export function validateRenderCvDocument(yaml, maxBytes) {
    parseDocument(yaml, maxBytes);
}
function parseOptionalSection(yaml, key) {
    if (!yaml?.trim())
        return {};
    const parsed = YAML.parse(yaml, { maxAliasCount: 50 });
    if (!isRecord(parsed))
        throw new Error(`RenderCV ${key} section must be a YAML mapping.`);
    return parsed;
}
export function compileRenderCvSections(input) {
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
//# sourceMappingURL=compiler.js.map