import * as XLSX from "xlsx";

/**
 * Returns null for empty/null/undefined values, otherwise trimmed string.
 */
export const toNullableString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text === "" ? null : text;
};

/**
 * Parses numbers in Indonesian (1.000,50) or English (1,000.50) format.
 */
export const toNumber = (value) => {
    if (value === undefined || value === null || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    let text = String(value).trim();
    if (!text) return 0;

    text = text.replace(/\s/g, "");
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");

    if (lastComma > -1 && lastDot > -1) {
        if (lastComma > lastDot) {
            text = text.replace(/\./g, "").replace(",", ".");
        } else {
            text = text.replace(/,/g, "");
        }
    } else if (lastComma > -1) {
        text = text.replace(/\./g, "").replace(",", ".");
    } else if (lastDot > -1) {
        if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
            text = text.replace(/\./g, "");
        }
    }

    text = text.replace(/[^\d.-]/g, "");
    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Converts common truthy string representations to boolean.
 */
export const toBoolean = (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "boolean") return value;
    const text = String(value).trim().toLowerCase();
    return ["true", "1", "yes", "y", "v", "☑", "✅", "checked"].includes(text);
};

/**
 * Masks an ID/KTP value, showing only the first 3 characters.
 */
export const maskKtp = (value) => {
    const text = toNullableString(value);
    if (!text) return null;
    if (text.length <= 3) return text;
    return `${text.slice(0, 3)}${"*".repeat(text.length - 3)}`;
};

/**
 * Parses a value to ISO date string, handling Excel serial numbers,
 * Date objects, and date strings.
 */
export const getExcelDate = (value) => {
    if (value === undefined || value === null || value === "") return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
    }
    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed) return null;
        const date = new Date(
            Date.UTC(
                parsed.y,
                (parsed.m || 1) - 1,
                parsed.d || 1,
                parsed.H || 0,
                parsed.M || 0,
                parsed.S || 0,
            ),
        );
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    const text = String(value).trim();
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
