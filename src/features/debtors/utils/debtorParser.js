import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
    DEBTOR_HEADER_ALIAS_MAP,
    REQUIRED_UPLOAD_COLUMNS,
    NUMERIC_UPLOAD_COLUMNS,
    INTEGER_UPLOAD_COLUMNS,
    DATE_UPLOAD_COLUMNS,
    FLAG_COLUMNS,
} from "./debtorConstants";

// ─── String / number / date converters ───────────────────────────────────────
// Date fields for debtor rows that must be normalised before backend validation
const _DEBTOR_DATE_FIELDS = [
    'tanggal_mulai_covering', 'tanggal_akhir_covering',
    'tanggal_terima', 'tanggal_validasi', 'teller_premium_date',
];

export const toNullableString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text === "" ? null : text;
};

export const toNumber = (value) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;

    let text = String(value).trim();
    if (!text) return null;

    text = text.replace(/\s/g, "");
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");

    if (lastComma > -1 && lastDot > -1) {
        if (lastComma > lastDot) {
            text = text.replace(/\./g, "").replace(/,/g, ".");
        } else {
            text = text.replace(/,/g, "");
        }
    } else if (lastComma > -1) {
        text = text.replace(/,/g, ".");
    }

    text = text.replace(/[^\d.-]/g, "");
    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? parsed : null;
};

export const toInteger = (value) => {
    const parsed = toNumber(value);
    return parsed === null ? null : Math.trunc(parsed);
};

export const toIsoDate = (value) => {
    if (value === undefined || value === null || value === "") return null;

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        const utcMillis = Date.UTC(
            value.getFullYear(), value.getMonth(), value.getDate(),
            value.getHours(), value.getMinutes(), value.getSeconds(),
            value.getMilliseconds(),
        );
        return new Date(utcMillis).toISOString();
    }

    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed && parsed.y && parsed.m && parsed.d) {
            const utcMillis = Date.UTC(
                parsed.y, parsed.m - 1, parsed.d,
                parsed.H || 0, parsed.M || 0, parsed.S || 0,
            );
            const date = new Date(utcMillis);
            return Number.isNaN(date.getTime()) ? null : date.toISOString();
        }
    }

    const text = String(value).trim();
    if (!text) return null;

    const ddmmyyyyMatch = text.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (ddmmyyyyMatch) {
        const [, day, month, year, hour = "0", minute = "0", second = "0"] = ddmmyyyyMatch;
        const utcMillis = Date.UTC(
            Number(year), Number(month) - 1, Number(day),
            Number(hour), Number(minute), Number(second),
        );
        const date = new Date(utcMillis);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    const fallbackDate = new Date(text);
    if (Number.isNaN(fallbackDate.getTime())) return null;
    const utcMillis = Date.UTC(
        fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate(),
        fallbackDate.getHours(), fallbackDate.getMinutes(), fallbackDate.getSeconds(),
        fallbackDate.getMilliseconds(),
    );
    return new Date(utcMillis).toISOString();
};

export const normalizePolicyNumber = (value) => {
    if (value === undefined || value === null || value === "") {
        return { value: null, error: null };
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) return { value: null, error: "must be a valid text/number value" };
        if (!Number.isSafeInteger(value)) {
            return { value: null, error: "is too large as numeric Excel value and may lose precision. Format this column as Text" };
        }
        return { value: String(Math.trunc(value)), error: null };
    }
    let text = String(value).trim();
    if (!text) return { value: null, error: null };
    if (text.startsWith("'")) text = text.slice(1).trim();
    text = text.replace(/\s/g, "");
    const digitWithOptionalDecimalZero = text.match(/^(\d+)(?:[.,]0+)?$/);
    if (digitWithOptionalDecimalZero) return { value: digitWithOptionalDecimalZero[1], error: null };
    if (/^\d+[.,]\d+$/.test(text)) return { value: null, error: "must not contain decimal values other than .00 or ,00" };
    return { value: null, error: "must contain digits only" };
};

// ─── Header normalisation ─────────────────────────────────────────────────────

export const normalizeHeader = (header = "") => {
    const normalized = String(header)
        .trim()
        .toLowerCase()
        .replace(/[%().]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_");
    return DEBTOR_HEADER_ALIAS_MAP[normalized] || normalized;
};

export const normalizeRow = (row = {}) => {
    const normalized = {};
    Object.entries(row || {}).forEach(([key, value]) => {
        normalized[normalizeHeader(key)] = typeof value === "string" ? value.trim() : value;
    });
    return normalized;
};

// ─── Row validation ───────────────────────────────────────────────────────────

export const validateUploadRows = (rows = [], headers = []) => {
    const validationErrors = [];
    const normalizedRows = [];
    const normalizedHeaders = (headers || []).map((h) => normalizeHeader(h));
    const headerSet = new Set(normalizedHeaders);

    const missingColumns = REQUIRED_UPLOAD_COLUMNS.filter((c) => !headerSet.has(c));
    if (missingColumns.length > 0) {
        validationErrors.push(
            `Invalid file format: missing required column "${missingColumns[0]}".`,
        );
        return { normalizedRows: [], validationErrors };
    }

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index] || {};
        const rowNumber = index + 2;
        const normalizedRow = { ...row };

        if (Array.isArray(row.__parsed_extra) && row.__parsed_extra.length > 0) {
            validationErrors.push(`Row ${rowNumber}: too many columns detected.`);
        }

        REQUIRED_UPLOAD_COLUMNS.forEach((column) => {
            if (!toNullableString(row[column])) {
                validationErrors.push(`Row ${rowNumber}: missing required value in column "${column}".`);
            }
        });

        NUMERIC_UPLOAD_COLUMNS.forEach((column) => {
            const raw = row[column];
            if (raw !== undefined && raw !== null && raw !== "" && toNumber(raw) === null) {
                validationErrors.push(`Row ${rowNumber}: invalid numeric format in column "${column}".`);
            }
        });

        INTEGER_UPLOAD_COLUMNS.forEach((column) => {
            const raw = row[column];
            if (raw === undefined || raw === null || raw === "") return;
            const int = toInteger(raw);
            if (int === null) {
                validationErrors.push(`Row ${rowNumber}: invalid integer format in column "${column}".`);
                return;
            }
            if (FLAG_COLUMNS.includes(column) && ![0, 1].includes(int)) {
                validationErrors.push(`Row ${rowNumber}: invalid value in column "${column}". Allowed values are 0 or 1.`);
                return;
            }
            if (column === "kolektabilitas" && (int < 0 || int > 5)) {
                validationErrors.push(`Row ${rowNumber}: invalid value in "kolektabilitas". Allowed range is 0–5.`);
            }
        });

        DATE_UPLOAD_COLUMNS.forEach((column) => {
            const raw = row[column];
            if (raw !== undefined && raw !== null && raw !== "" && toIsoDate(raw) === null) {
                validationErrors.push(`Row ${rowNumber}: invalid date format in column "${column}".`);
            }
        });

        const policyNoResult = normalizePolicyNumber(row.policy_no);
        if (policyNoResult.error) {
            validationErrors.push(`Row ${rowNumber}: invalid format in column "policy_no" (${policyNoResult.error}).`);
        }
        normalizedRow.policy_no = policyNoResult.value;
        normalizedRows.push(normalizedRow);
    }

    return { normalizedRows, validationErrors };
};

// ─── File parsing ─────────────────────────────────────────────────────────────

export const parseDebtorFile = async (file) => {
    const fileName = (file?.name || "").toLowerCase();

    if (fileName.endsWith(".csv")) {
        const text = await file.text();
        const parseResult = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => normalizeHeader(h),
            transform: (v) => (typeof v === "string" ? v.trim() : v),
        });
        const rows = (parseResult.data || []).map((r) => normalizeRow(r));
        const headers = Array.isArray(parseResult.meta?.fields)
            ? parseResult.meta.fields
            : Object.keys(rows[0] || {});
        return { rows, headers, parseErrors: parseResult.errors || [] };
    }

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames?.[0];
        if (!firstSheetName) return { rows: [], headers: [], parseErrors: [] };
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true, blankrows: false });
        const normalizedRows = rows.map((r) => normalizeRow(r));
        const headers = Object.keys(normalizedRows[0] || {});
        return { rows: normalizedRows, headers, parseErrors: [] };
    }

    throw new Error("Unsupported file format. Please upload .csv, .xlsx, or .xls");
};

// ─── Payload builder ──────────────────────────────────────────────────────────

export const buildDebtorPayload = (row, borderoId, batchId, contractId) => ({
    cover_id: toNullableString(row.cover_id),
    program_id: toNullableString(row.program_id),
    bordero_id: borderoId,
    nomor_rekening_pinjaman: toNullableString(row.nomor_rekening_pinjaman),
    nomor_peserta: toNullableString(row.nomor_peserta),
    loan_type: toNullableString(row.loan_type),
    loan_type_desc: toNullableString(row.loan_type_desc),
    cif_rekening_pinjaman: toNullableString(row.cif_rekening_pinjaman),
    jenis_pengajuan_desc: toNullableString(row.jenis_pengajuan_desc),
    jenis_covering_desc: toNullableString(row.jenis_covering_desc),
    tanggal_mulai_covering: toIsoDate(row.tanggal_mulai_covering),
    tanggal_akhir_covering: toIsoDate(row.tanggal_akhir_covering),
    plafon: toNumber(row.plafon),
    nominal_premi: toNumber(row.nominal_premi),
    premi_percentage: toNumber(row.premi_percentage),
    premium_amount: toNumber(row.premium_amount),
    ric_percentage: toNumber(row.ric_percentage),
    ric_amount: toNumber(row.ric_amount),
    bf_percentage: toNumber(row.bf_percentage),
    bf_amount: toNumber(row.bf_amount),
    net_premi: toNumber(row.net_premi),
    unit_code: toNullableString(row.unit_code),
    unit_desc: toNullableString(row.unit_desc),
    branch_desc: toNullableString(row.branch_desc),
    region_desc: toNullableString(row.region_desc),
    nama_peserta: toNullableString(row.nama_peserta),
    alamat_usaha: toNullableString(row.alamat_usaha),
    nomor_perjanjian_kredit: toNullableString(row.nomor_perjanjian_kredit),
    tanggal_terima: toIsoDate(row.tanggal_terima),
    tanggal_validasi: toIsoDate(row.tanggal_validasi),
    teller_premium_date: toIsoDate(row.teller_premium_date),
    status_aktif: toInteger(row.status_aktif),
    remark_premi: toNullableString(row.remark_premi),
    flag_restruk: toInteger(row.flag_restruk ?? row.flag_restruktur),
    kolektabilitas: toInteger(row.kolektabilitas),
    policy_no: toNullableString(row.policy_no),
    contract_id: contractId,
    batch_id: toNullableString(row.batch_id) || batchId,
    version_no: 1,
    status: "SUBMITTED",
    is_locked: false,
});

// ─── Error formatting ─────────────────────────────────────────────────────────

export const formatUploadError = (message) => {
    if (!message) return { title: "", items: [], summary: "" };
    const lines = String(message).split("\n").map((l) => l.trim()).filter(Boolean);
    const summary = lines[0] || "Upload failed.";
    const rowItems = lines.filter((l) => /^Row\s+\d+:/i.test(l));
    if (rowItems.length > 0) {
        return { title: "Please review the following issues:", items: rowItems.slice(0, 6), summary };
    }
    return { title: "Please review the following issues:", items: lines.slice(1, 7), summary };
};

/**
 * Pre-normalises date fields in debtor rows to ISO strings before backend validation.
 * Valid dates (any format, including Excel serial numbers and DD/MM/YYYY) are converted;
 * blank/empty fields remain null; unparseable values become null (backend skips them).
 */
export const normalizeDebtorRowDatesForValidation = (rows) =>
    rows.map((row) => {
        const out = { ...row };
        for (const field of _DEBTOR_DATE_FIELDS) {
            out[field] = toIsoDate(row[field]);
        }
        return out;
    });
