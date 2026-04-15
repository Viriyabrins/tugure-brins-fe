import Papa from "papaparse";
import * as XLSX from "xlsx";

export const MC_PAGE_SIZE = 10;

export const DEFAULT_MC_FILTER = {
    status: "all",
    contractId: "",
    productType: "all",
    creditType: "all",
    startDate: "",
    endDate: "",
};

const normalizeRole = (role = "") => String(role).trim().toLowerCase();

export const ALL_ROLE_NAMES = [
    "maker-brins-role",
    "checker-brins-role",
    "approver-brins-role",
    "checker-tugure-role",
    "approver-tugure-role",
];
export const TUGURE_ACTION_ROLES = ["checker-tugure-role", "approver-tugure-role"];
export const BRINS_UPLOAD_ROLES = ["maker-brins-role", "checker-brins-role"];

export const hasTugureActionRole = (roles = []) =>
    (Array.isArray(roles) ? roles : []).map(normalizeRole).some((r) => TUGURE_ACTION_ROLES.includes(r));
export const hasBrinsUploadRole = (roles = []) =>
    (Array.isArray(roles) ? roles : []).map(normalizeRole).some((r) => BRINS_UPLOAD_ROLES.includes(r));
export const normalizeStatus = (status = "") => String(status).trim().toUpperCase();
export const normalizeRoleStr = normalizeRole;

export const extractBaseContractNo = (cn = "") => {
    if (!cn) return "";
    const m = String(cn).match(/^(.*?)(?:_V\d+_.*)?$/i);
    return m ? m[1] : String(cn);
};

// --- data transformation utils ---
export const toNullableString = (value) => {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s === "" ? null : s;
};

export const toBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || String(value).trim() === "") return fallback;
    if (typeof value === "boolean") return value;
    const v = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "y", "ya"].includes(v)) return true;
    if (["false", "0", "no", "n", "tidak"].includes(v)) return false;
    return fallback;
};

export const toNumber = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    let s = String(value).trim();
    if (!s) return null;
    s = s.replace(/\s/g, "");
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(",")) s = s.replace(",", ".");
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
};

export const toInteger = (value) => {
    const n = toNumber(value);
    return n === null ? null : Math.trunc(n);
};

export const toISODate = (value) => {
    if (value === undefined || value === null || String(value).trim?.() === "") return null;
    if (typeof value === "number") {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const d = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(String(value).trim());
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const buildContractId = (row, index) => {
    const explicitId = toNullableString(row.contract_id);
    if (explicitId) return explicitId;
    const contractNo = toNullableString(row.contract_no);
    if (contractNo) {
        return contractNo.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    }
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `MC-${stamp}-${String(index).padStart(3, "0")}`;
};

export const readableError = (error, fallback = "Terjadi kesalahan saat memproses data") => {
    const msg = String(error?.message || "").trim();
    if (!msg) return fallback;
    if (msg.includes("Unique constraint failed")) return "Data duplikat terdeteksi. Pastikan contract_id belum pernah digunakan.";
    if (msg.includes("contract_id") || msg.includes("Upload dibatalkan") || msg.includes("baris ke-") || msg.includes("Baris ke-")) return msg;
    return msg;
};

// Date fields that must be normalised to ISO strings before backend validation
const MC_DATE_FIELDS = [
    'input_date', 'offer_date', 'contract_start_date', 'contract_end_date',
    'effective_date', 'stnc_date',
];

/**
 * Pre-normalises date fields in raw Excel rows to ISO strings before backend validation.
 * Valid dates (any format, including Excel serial numbers) are converted to ISO;
 * blank/empty fields remain null; unparseable values become null (backend skips them).
 */
export const normalizeRawRowDatesForValidation = (rows) =>
    rows.map((row) => {
        const out = { ...row };
        for (const field of MC_DATE_FIELDS) {
            out[field] = toISODate(row[field]);
        }
        return out;
    });

export const parseUploadFile = async (file) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim(), transform: (v) => (typeof v === "string" ? v.trim() : v) });
        return result.data || [];
    }
    if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    }
    throw new Error("Unsupported file type. Please upload .csv, .xlsx, or .xls");
};

export const buildContractPayload = (row, index, uploadMode) => {
    const contractId = uploadMode === "revise" ? null : buildContractId(row, index + 1);
    return {
        contract_id: contractId,
        underwriter_name: toNullableString(row.underwriter_name),
        input_date: toISODate(row.input_date),
        input_status: toNullableString(row.input_status),
        contract_status: toNullableString(row.contract_status) || "Draft",
        status_approval: uploadMode === "new" ? "SUBMITTED" : toNullableString(row.status_approval),
        source_type: toNullableString(row.source_type),
        source_name: toNullableString(row.source_name),
        ceding_name: toNullableString(row.ceding_name),
        ceding_same_as_source: toBoolean(row.ceding_same_as_source, false),
        bank_obligee: toNullableString(row.bank_obligee),
        endorsement_type: toNullableString(row.endorsement_type),
        endorsement_reason: toNullableString(row.endorsement_reason),
        endorsement_reason_detail: toNullableString(row.endorsement_reason_detail),
        kind_of_business: toNullableString(row.kind_of_business),
        offer_date: toISODate(row.offer_date),
        contract_no: toNullableString(row.contract_no),
        binder_no_tugure: toNullableString(row.binder_no_tugure),
        contract_no_from: toNullableString(row.contract_no_from),
        binder_no_from: toNullableString(row.binder_no_from),
        type_of_contract: toNullableString(row.type_of_contract),
        credit_type: toNullableString(row.credit_type),
        debtor_principal: toNullableString(row.debtor_principal),
        product_type: toNullableString(row.product_type),
        product_name: toNullableString(row.product_name),
        contract_start_date: toISODate(row.contract_start_date),
        contract_end_date: toISODate(row.contract_end_date),
        effective_date: toISODate(row.effective_date),
        stnc_date: toISODate(row.stnc_date),
        outward_retrocession: toNullableString(row.outward_retrocession) || "Tidak",
        automatic_cession: toNullableString(row.automatic_cession) || "Tidak",
        retro_program: toNullableString(row.retro_program),
        reinsurance_commission_pct: toInteger(row.reinsurance_commission_pct),
        profit_commission_pct: toNumber(row.profit_commission_pct),
        brokerage_fee_pct: toNumber(row.brokerage_fee_pct),
        reporting_participant_days: toInteger(row.reporting_participant_days),
        reporting_claim_days: toInteger(row.reporting_claim_days),
        claim_reporting_type: toNullableString(row.claim_reporting_type),
        payment_scenario: toNullableString(row.payment_scenario),
        installment_frequency: toNullableString(row.installment_frequency),
        stop_loss_value: toNumber(row.stop_loss_value),
        stop_loss_basis: toNullableString(row.stop_loss_basis),
        cut_loss_value: toNumber(row.cut_loss_value),
        cut_loss_basis: toNullableString(row.cut_loss_basis),
        cut_off_value: toNumber(row.cut_off_value),
        cut_off_basis: toNullableString(row.cut_off_basis),
        loss_ratio_value: toInteger(row.loss_ratio_value),
        loss_ratio_basis: toNullableString(row.loss_ratio_basis),
        evaluation_period_value: toInteger(row.evaluation_period_value),
        evaluation_period_unit: toNullableString(row.evaluation_period_unit),
        max_tenor_value: toInteger(row.max_tenor_value),
        max_tenor_unit: toNullableString(row.max_tenor_unit),
        max_sum_insured: toInteger(row.max_sum_insured),
        perils_covers: toNullableString(row.perils_covers),
        limit_coverage_type: toNullableString(row.limit_coverage_type),
        kolektibilitas_max: toInteger(row.kolektibilitas_max),
        kolektibilitas_limit_amount: toNumber(row.kolektibilitas_limit_amount),
        qs_tugure_share: toInteger(row.qs_tugure_share),
        qs_cedant_share: toInteger(row.qs_cedant_share),
        deductible: toInteger(row.deductible),
        currency: "IDR",
        version: uploadMode === "revise" ? null : 1,
        parent_contract_id: null,
    };
};

export const PREVIEW_COLUMNS = [
    { key: "contract_id", label: "Contract ID" },
    { key: "underwriter_name", label: "Underwriter Name" },
    { key: "input_date", label: "Input Date", isDate: true },
    { key: "input_status", label: "Input Status" },
    { key: "status_approval", label: "Status Approval" },
    { key: "contract_status", label: "Contract Status" },
    { key: "source_type", label: "Source Type" },
    { key: "source_name", label: "Source Name" },
    { key: "ceding_name", label: "Ceding Name" },
    { key: "ceding_same_as_source", label: "Ceding = Source", isBoolean: true },
    { key: "bank_obligee", label: "Bank Obligee" },
    { key: "endorsement_type", label: "Endorsement Type" },
    { key: "endorsement_reason", label: "Endorsement Reason" },
    { key: "endorsement_reason_detail", label: "Endorsement Detail" },
    { key: "kind_of_business", label: "Kind of Business" },
    { key: "offer_date", label: "Offer Date", isDate: true },
    { key: "contract_no", label: "Contract No" },
    { key: "binder_no_tugure", label: "Binder No Tugure" },
    { key: "contract_no_from", label: "Contract No From" },
    { key: "binder_no_from", label: "Binder No From" },
    { key: "type_of_contract", label: "Type of Contract" },
    { key: "credit_type", label: "Credit Type" },
    { key: "debtor_principal", label: "Debtor Principal" },
    { key: "product_type", label: "Product Type" },
    { key: "product_name", label: "Product Name" },
    { key: "contract_start_date", label: "Start Date", isDate: true },
    { key: "contract_end_date", label: "End Date", isDate: true },
    { key: "effective_date", label: "Effective Date", isDate: true },
    { key: "stnc_date", label: "STNC Date", isDate: true },
    { key: "outward_retrocession", label: "Outward Retrocession" },
    { key: "automatic_cession", label: "Automatic Cession" },
    { key: "retro_program", label: "Retro Program" },
    { key: "reinsurance_commission_pct", label: "RI Commission %" },
    { key: "profit_commission_pct", label: "Profit Commission %" },
    { key: "brokerage_fee_pct", label: "Brokerage Fee %" },
    { key: "reporting_participant_days", label: "Report Participant Days" },
    { key: "reporting_claim_days", label: "Report Claim Days" },
    { key: "claim_reporting_type", label: "Claim Reporting Type" },
    { key: "payment_scenario", label: "Payment Scenario" },
    { key: "installment_frequency", label: "Installment Freq." },
    { key: "stop_loss_value", label: "Stop Loss Value", isCurrency: true },
    { key: "stop_loss_basis", label: "Stop Loss Basis" },
    { key: "cut_loss_value", label: "Cut Loss Value", isCurrency: true },
    { key: "cut_loss_basis", label: "Cut Loss Basis" },
    { key: "cut_off_value", label: "Cut Off Value", isCurrency: true },
    { key: "cut_off_basis", label: "Cut Off Basis" },
    { key: "loss_ratio_value", label: "Loss Ratio Value" },
    { key: "loss_ratio_basis", label: "Loss Ratio Basis" },
    { key: "evaluation_period_value", label: "Eval. Period Value" },
    { key: "evaluation_period_unit", label: "Eval. Period Unit" },
    { key: "max_tenor_value", label: "Max Tenor Value" },
    { key: "max_tenor_unit", label: "Max Tenor Unit", isCurrency: true },
    { key: "max_sum_insured", label: "Max Sum Insured", isCurrency: true },
    { key: "perils_covers", label: "Perils Covers" },
    { key: "limit_coverage_type", label: "Limit Coverage Type" },
    { key: "kolektibilitas_max", label: "Kolektibilitas Max" },
    { key: "kolektibilitas_limit_amount", label: "Kolektibilitas Limit", isCurrency: true },
    { key: "qs_tugure_share", label: "QS Tugure Share" },
    { key: "qs_cedant_share", label: "QS Cedant Share" },
    { key: "deductible", label: "Deductible" },
];

export const MC_TEMPLATE_CSV = [
    ["contract_id", "policy_no", "program_id", "product_type", "credit_type", "loan_type", "loan_type_desc", "coverage_start_date", "coverage_end_date", "max_tenor_month", "max_plafond", "share_tugure_percentage", "premium_rate", "ric_rate", "bf_rate", "allowed_kolektabilitas", "allowed_region", "currency", "remark"].join(","),
    ["MC-001", "POL-2025-001", "PRG-001", "Treaty", "Individual", "KPR", "Kredit Pemilikan Rumah", "2025-01-01", "2030-12-31", "240", "1000000000", "75", "1.0", "0.1", "0.05", "1,2,3", "DKI Jakarta,Jawa Barat", "IDR", "Housing credit treaty"].join(","),
].join("\n");
