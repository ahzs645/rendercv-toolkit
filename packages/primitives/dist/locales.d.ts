/**
 * Locale data the compatibility normalizer needs when it renders dates itself.
 *
 * Nested `positions` are flattened into `Title | Start – End` strings before
 * RenderCV sees them, so those dates never pass through RenderCV's own
 * locale-aware date formatter. This table mirrors the `month_names` and
 * `present` values RenderCV ships in
 * `rendercv/schema/models/locale/other_locales/*.yaml` so the flattened dates
 * match the rest of the rendered document.
 */
export type DateLocale = {
    language: string;
    monthNames: string[];
    present: string;
};
export declare const ENGLISH_DATE_LOCALE: DateLocale;
export declare function availableDateLocales(): string[];
/**
 * Resolve the locale used for normalizer-rendered dates.
 *
 * `localeYaml` is the document's `locale:` section. An explicit `month_names`
 * override always wins. `present` is only taken from the document when it
 * differs from the value RenderCV ships for that language, so switching to a
 * built-in locale keeps that locale's own wording while a hand-edited override
 * is still honoured.
 */
export declare function resolveDateLocale(localeYaml: string | undefined | null): DateLocale;
/**
 * Month name to `MM` lookup for parsing a previously flattened date back out.
 *
 * English is always included so documents flattened before a locale switch
 * still round-trip.
 */
export declare function monthNumbersByName(locale: DateLocale): Record<string, string>;
//# sourceMappingURL=locales.d.ts.map