function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value ?? null);
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(',')}]`;
    const record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}
/** Stable FNV-1a content fingerprint shared by the editor and every renderer. */
export function entryFingerprint(entry) {
    const serialized = stableStringify(entry);
    let hash = 0x811c9dc5;
    for (let index = 0; index < serialized.length; index += 1) {
        hash ^= serialized.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}
export const TOP_LEVEL_ENTRY_LISTS = ['social_networks', 'custom_connections'];
export function topLevelEntryListKey(list) {
    return `cv:${list}`;
}
export function topLevelEntryListFromKey(key) {
    if (!key.startsWith('cv:'))
        return null;
    const value = key.slice(3);
    return TOP_LEVEL_ENTRY_LISTS.includes(value) ? value : null;
}
//# sourceMappingURL=fingerprints.js.map