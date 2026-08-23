import YAML from 'yaml';
const LOCALE_TABLE = {
    "english": {
        monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        present: "present",
        presentDisplay: "Present"
    },
    "arabic": {
        monthNames: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
        present: "الحاضر",
        presentDisplay: "الحاضر"
    },
    "danish": {
        monthNames: ["Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli", "August", "September", "Oktober", "November", "December"],
        present: "nuværende",
        presentDisplay: "nuværende"
    },
    "dutch": {
        monthNames: ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"],
        present: "heden",
        presentDisplay: "heden"
    },
    "french": {
        monthNames: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
        present: "présent",
        presentDisplay: "présent"
    },
    "german": {
        monthNames: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
        present: "gegenwärtig",
        presentDisplay: "gegenwärtig"
    },
    "hebrew": {
        monthNames: ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"],
        present: "הווה",
        presentDisplay: "הווה"
    },
    "hindi": {
        monthNames: ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
        present: "वर्तमान",
        presentDisplay: "वर्तमान"
    },
    "hungarian": {
        monthNames: ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"],
        present: "jelenleg",
        presentDisplay: "jelenleg"
    },
    "indonesian": {
        monthNames: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
        present: "sekarang",
        presentDisplay: "sekarang"
    },
    "italian": {
        monthNames: ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
        present: "presente",
        presentDisplay: "presente"
    },
    "japanese": {
        monthNames: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
        present: "現在",
        presentDisplay: "現在"
    },
    "korean": {
        monthNames: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
        present: "현재",
        presentDisplay: "현재"
    },
    "mandarin_chinese": {
        monthNames: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
        present: "至今",
        presentDisplay: "至今"
    },
    "norwegian_bokmål": {
        monthNames: ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"],
        present: "nåværende",
        presentDisplay: "nåværende"
    },
    "norwegian_nynorsk": {
        monthNames: ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"],
        present: "nåverande",
        presentDisplay: "nåverande"
    },
    "persian": {
        monthNames: ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"],
        present: "حال",
        presentDisplay: "حال"
    },
    "portuguese": {
        monthNames: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
        present: "presente",
        presentDisplay: "presente"
    },
    "russian": {
        monthNames: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
        present: "настоящее время",
        presentDisplay: "настоящее время"
    },
    "spanish": {
        monthNames: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
        present: "presente",
        presentDisplay: "presente"
    },
    "turkish": {
        monthNames: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
        present: "halen",
        presentDisplay: "halen"
    },
    "vietnamese": {
        monthNames: ["Tháng Một", "Tháng Hai", "Tháng Ba", "Tháng Tư", "Tháng Năm", "Tháng Sáu", "Tháng Bảy", "Tháng Tám", "Tháng Chín", "Tháng Mười", "Tháng Mười Một", "Tháng Mười Hai"],
        present: "hiện tại",
        presentDisplay: "hiện tại"
    }
};
export const ENGLISH_DATE_LOCALE = {
    language: 'english',
    monthNames: LOCALE_TABLE.english.monthNames,
    present: LOCALE_TABLE.english.presentDisplay
};
export function availableDateLocales() {
    return Object.keys(LOCALE_TABLE);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readStringList(value, expectedLength) {
    if (!Array.isArray(value) || value.length !== expectedLength) {
        return undefined;
    }
    const entries = value.map((item) => (item == null ? '' : String(item).trim()));
    return entries.every((item) => item.length > 0) ? entries : undefined;
}
/**
 * Resolve the locale used for normalizer-rendered dates.
 *
 * `localeYaml` is the document's `locale:` section. An explicit `month_names`
 * override always wins. `present` is only taken from the document when it
 * differs from the value RenderCV ships for that language, so switching to a
 * built-in locale keeps that locale's own wording while a hand-edited override
 * is still honoured.
 */
export function resolveDateLocale(localeYaml) {
    if (!localeYaml?.trim()) {
        return ENGLISH_DATE_LOCALE;
    }
    let parsed;
    try {
        parsed = YAML.parse(localeYaml);
    }
    catch {
        return ENGLISH_DATE_LOCALE;
    }
    const locale = isRecord(parsed) && isRecord(parsed.locale) ? parsed.locale : undefined;
    if (!locale) {
        return ENGLISH_DATE_LOCALE;
    }
    const language = typeof locale.language === 'string' && locale.language.trim()
        ? locale.language.trim()
        : 'english';
    const entry = LOCALE_TABLE[language];
    const monthNames = readStringList(locale.month_names, 12) ?? entry?.monthNames;
    if (!monthNames) {
        return ENGLISH_DATE_LOCALE;
    }
    const shipped = entry?.present;
    const authored = typeof locale.present === 'string' ? locale.present.trim() : '';
    const present = authored && authored !== shipped
        ? authored
        : (entry?.presentDisplay ?? ENGLISH_DATE_LOCALE.present);
    return { language, monthNames, present };
}
/**
 * Month name to `MM` lookup for parsing a previously flattened date back out.
 *
 * English is always included so documents flattened before a locale switch
 * still round-trip.
 */
export function monthNumbersByName(locale) {
    const lookup = {};
    for (const names of [ENGLISH_DATE_LOCALE.monthNames, locale.monthNames]) {
        names.forEach((name, index) => {
            lookup[name] = String(index + 1).padStart(2, '0');
        });
    }
    return lookup;
}
//# sourceMappingURL=locales.js.map