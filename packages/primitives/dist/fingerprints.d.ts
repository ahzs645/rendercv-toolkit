/** Stable FNV-1a content fingerprint shared by the editor and every renderer. */
export declare function entryFingerprint(entry: unknown): string;
export declare const TOP_LEVEL_ENTRY_LISTS: readonly ["social_networks", "custom_connections"];
export type TopLevelEntryList = (typeof TOP_LEVEL_ENTRY_LISTS)[number];
export declare function topLevelEntryListKey(list: TopLevelEntryList): string;
export declare function topLevelEntryListFromKey(key: string): TopLevelEntryList | null;
//# sourceMappingURL=fingerprints.d.ts.map