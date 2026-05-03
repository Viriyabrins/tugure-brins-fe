import * as XLSX from "xlsx";
import {
    toNullableString,
    toNumber,
} from "@/shared/utils/dataTransform";
import { HEADER_ALIAS_MAP } from "../utils/subrogationConstants";

/** Normalizes a raw header string to its canonical field name. */
function normalizeHeader(header = "") {
    const cleaned = String(header)
        .trim()
        .toLowerCase()
        .replace(/[%().\/]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
    return HEADER_ALIAS_MAP[cleaned] || cleaned;
}

/** Parses various date formats to ISO-8601 DateTime string */
function parseDate(value) {
    if (!value || value === "") return null;
    
    // If it's already a Date object, convert to ISO string
    if (value instanceof Date) {
        return value.toISOString();
    }
    
    // If it's a number (Excel serial date), convert to date
    if (typeof value === 'number') {
        const excelDate = new Date((value - 25569) * 86400 * 1000);
        return excelDate.toISOString();
    }
    
    // Parse string formats
    const str = String(value).trim();
    if (!str) return null;
    
    // Try parsing "MMM-YY" format FIRST (e.g., "Mar-23", "Dec-20", "Jul-20")
    // This MUST come before the generic Date parser to avoid misinterpretation
    const monthYearRegex = /^([A-Za-z]{3})-(\d{2})$/;
    const monthYearMatch = str.match(monthYearRegex);
    if (monthYearMatch) {
        const monthStr = monthYearMatch[1].toUpperCase();
        const year = parseInt(monthYearMatch[2], 10);
        
        const months = {
            'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
            'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
            'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
        };
        
        const month = months[monthStr];
        if (month) {
            // For 2-digit years: 00-49 → 2000-2049, 50-99 → 1950-1999
            const fullYear = year <= 49 ? 2000 + year : 1900 + year;
            // Use first day of month if only month-year is provided
            return `${fullYear}-${month}-01T00:00:00Z`;
        }
    }
    
    // Try parsing "DD-MMM-YY" format (e.g., "29-Dec-22")
    const dateRegex = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/;
    const match = str.match(dateRegex);
    if (match) {
        const day = String(match[1]).padStart(2, '0');
        const monthStr = match[2].toUpperCase();
        const year = parseInt(match[3], 10);
        
        const months = {
            'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
            'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
            'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
        };
        
        const month = months[monthStr];
        if (month) {
            // For 2-digit years: 00-49 → 2000-2049, 50-99 → 1950-1999
            const fullYear = year <= 49 ? 2000 + year : 1900 + year;
            return `${fullYear}-${month}-${day}T00:00:00Z`;
        }
    }
    
    // Try parsing with standard date parser as fallback
    let parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
    }
    
    // Return null if can't parse
    return null;
}

/**
 * Parses a CSV/XLSX/XLS file into an array of raw subrogation rows.
 * Each row contains all fields mapped by header aliases.
 *
 * @param {File} file
 * @returns {Promise<Array>}
 */
export async function parseSubrogationFile(file) {
    const fileName = (file?.name || "").toLowerCase();
    if (
        !fileName.endsWith(".csv") &&
        !fileName.endsWith(".xlsx") &&
        !fileName.endsWith(".xls")
    ) {
        throw new Error(
            "Unsupported file format. Please upload .csv, .xlsx, or .xls",
        );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
        raw: false,
    });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
    });

    if (!Array.isArray(rows) || rows.length <= 1) {
        throw new Error("No data found in file");
    }

    const headers = (rows[0] || []).map(normalizeHeader);
    const headerIndexMap = headers.reduce((acc, header, idx) => {
        if (!acc[header]) acc[header] = [];
        acc[header].push(idx);
        return acc;
    }, {});

    const getFirst = (candidates) => {
        for (const c of candidates) {
            const arr = headerIndexMap[c];
            if (Array.isArray(arr) && arr.length > 0) return arr[0];
        }
        return -1;
    };

    const idx = {
        cedantRemarks: getFirst(["cedant_remarks", "remarks", "keterangan"]),
        claimNo: getFirst(["claim_no", "no_claim_asli", "claimno"]),
        policyNo: getFirst(["policy_no", "policyno"]),
        originalSharePct: getFirst(["original_share_pct", "share"]),
        contractId: getFirst(["contract_id", "af"]),
        subrogationAmount: getFirst(["subrogation_amount", "sum_of_subrogasi"]),
        grossTuguAmount: getFirst(["gross_tugu_amount", "tugu"]),
        feeTuguAmount: getFirst(["fee_tugu_amount", "fee_tugu"]),
        netTuguShare: getFirst(["net_tugu_share", "share_tugu"]),
        transferredSubrogationAmount: getFirst(["transferred_subrogation_amount", "pelimpahan_subro"]),
        expenseFeeAmount: getFirst(["expense_fee_amount", "expense_fee"]),
        dolDate: getFirst(["dol_date", "dol"]),
        bdoClaimDate: getFirst(["bdo_claim_date", "bdo_klaim"]),
        bdoPremiumDate: getFirst(["bdo_premium_date", "bdo_premi"]),
        brinsRemarks: getFirst(["brins_remarks", "remarks_brins"]),
    };

    return rows.slice(1).map((rowValues, index) => {
        const vals = Array.isArray(rowValues) ? rowValues : [];
        const read = (i) => (i >= 0 ? vals[i] : "");

        return {
            excelRow: index + 2,
            cedant_remarks: toNullableString(read(idx.cedantRemarks)),
            claim_no: toNullableString(read(idx.claimNo)),
            policy_no: toNullableString(read(idx.policyNo)),
            original_share_pct: toNumber(read(idx.originalSharePct)),
            contract_id: toNullableString(read(idx.contractId)),
            subrogation_amount: toNumber(read(idx.subrogationAmount)),
            gross_tugu_amount: toNumber(read(idx.grossTuguAmount)),
            fee_tugu_amount: toNumber(read(idx.feeTuguAmount)),
            net_tugu_share: toNumber(read(idx.netTuguShare)),
            transferred_subrogation_amount: toNumber(read(idx.transferredSubrogationAmount)),
            expense_fee_amount: toNumber(read(idx.expenseFeeAmount)),
            dol_date: parseDate(read(idx.dolDate)),
            bdo_claim_date: parseDate(read(idx.bdoClaimDate)),
            bdo_premium_date: parseDate(read(idx.bdoPremiumDate)),
            brins_remarks: toNullableString(read(idx.brinsRemarks)),
        };
    });
}