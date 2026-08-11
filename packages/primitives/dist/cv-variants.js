import YAML from 'yaml';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readStringList(value, field = 'list') {
    if (!Array.isArray(value)) {
        return undefined;
    }
    if (value.length > 100)
        throw new Error(`${field} may contain at most 100 items.`);
    const items = value
        .map((item) => {
        if (typeof item !== 'string' || item.length > 120)
            throw new Error(`${field} entries must be short strings.`);
        return item.trim();
    })
        .filter(Boolean);
    return items.length > 0 ? items : undefined;
}
function readExcludeEntries(value) {
    if (!isRecord(value))
        return undefined;
    if (Object.keys(value).length > 50)
        throw new Error('exclude_entries may contain at most 50 sections.');
    const entries = Object.fromEntries(Object.entries(value).flatMap(([key, fingerprints]) => {
        const values = readStringList(fingerprints, `exclude_entries.${key}`);
        return values ? [[key, values]] : [];
    }));
    return Object.keys(entries).length ? entries : undefined;
}
export function parseCvVariantsYaml(content, options = {}) {
    const maxBytes = options.maxBytes ?? 256 * 1024;
    if (new TextEncoder().encode(content).byteLength > maxBytes) {
        throw new Error(`Variants YAML exceeds the ${maxBytes}-byte parser limit.`);
    }
    const parsed = YAML.parse(content, { maxAliasCount: 50 });
    const variantsRoot = isRecord(parsed) && isRecord(parsed.variants)
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
    const variants = Object.fromEntries(sourceEntries.flatMap(([key, value]) => {
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
                    description: typeof value.description === 'string' ? value.description.slice(0, 500) : undefined,
                    exclude_sections: readStringList(value.exclude_sections, `${key}.exclude_sections`),
                    exclude_entries: readExcludeEntries(value.exclude_entries),
                    tags: readStringList(value.tags, `${key}.tags`),
                    flavors: readStringList(value.flavors, `${key}.flavors`)
                }
            ]
        ];
    }));
    if (Object.keys(variants).length === 0) {
        throw new Error('This variants file does not define any usable variants.');
    }
    return variants;
}
//# sourceMappingURL=cv-variants.js.map