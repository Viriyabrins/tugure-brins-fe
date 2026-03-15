import React, { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/common/PageHeader";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { backend } from "@/api/backendClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import {
    Download,
    Upload,
    FileSpreadsheet,
    Loader2,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    FileText,
    Users,
    Pen,
    AlertTriangle,
    Check,
    ShieldCheck,
    Eye,
    ChevronLeft,
    History,
} from "lucide-react";
import { toast } from "sonner";
import {
    createAuditLog,
    sendNotificationEmail,
} from "@/components/utils/emailTemplateHelper";
import { formatRupiahAdaptive } from "@/utils/currency";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";


const defaultFilter = {
    contract: "all",
    batch: "",
    submitStatus: "all",
    name: "",
};

const HEADER_ALIAS_MAP = {
    premium_425: "premium_amount",
    premium_42_5: "premium_amount",
    premium: "premium_amount",
    ric_325: "ric_amount",
    ric_32_5: "ric_amount",
    komisi: "ric_amount",
    bf_25: "bf_amount",
    bf_2_5: "bf_amount",
    nominal_komisi_broker: "bf_amount",
    flag_restruktur: "flag_restruk",
    policyno: "policy_no",
};

const REQUIRED_UPLOAD_COLUMNS = ["nomor_peserta", "nama_peserta"];
const NUMERIC_UPLOAD_COLUMNS = [
    "plafon",
    "nominal_premi",
    "premi_percentage",
    "premium_amount",
    "ric_percentage",
    "ric_amount",
    "bf_percentage",
    "bf_amount",
    "net_premi",
];
const INTEGER_UPLOAD_COLUMNS = ["status_aktif", "flag_restruk", "flag_restruktur", "kolektabilitas"];
const DATE_UPLOAD_COLUMNS = [
    "tanggal_mulai_covering",
    "tanggal_akhir_covering",
    "tanggal_terima",
    "tanggal_validasi",
    "teller_premium_date",
];

const FLAG_COLUMNS = ["status_aktif", "flag_restruk", "flag_restruktur"];

const normalizeHeader = (header = "") => {
    const normalized = String(header)
        .trim()
        .toLowerCase()
        .replace(/[%().]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_");
    return HEADER_ALIAS_MAP[normalized] || normalized;
};

const normalizeRow = (row = {}) => {
    const normalized = {};
    Object.entries(row || {}).forEach(([key, value]) => {
        const normalizedKey = normalizeHeader(key);
        normalized[normalizedKey] = typeof value === "string" ? value.trim() : value;
    });
    return normalized;
};

const toNullableString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text === "" ? null : text;
};

const toNumber = (value) => {
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

const toInteger = (value) => {
    const parsed = toNumber(value);
    return parsed === null ? null : Math.trunc(parsed);
};

const toIsoDate = (value) => {
    if (value === undefined || value === null || value === "") return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed && parsed.y && parsed.m && parsed.d) {
            const date = new Date(
                parsed.y,
                parsed.m - 1,
                parsed.d,
                parsed.H || 0,
                parsed.M || 0,
                parsed.S || 0,
            );
            return Number.isNaN(date.getTime()) ? null : date.toISOString();
        }
    }

    const text = String(value).trim();
    if (!text) return null;

    const ddmmyyyyMatch = text.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );

    if (ddmmyyyyMatch) {
        const [, day, month, year, hour = "0", minute = "0", second = "0"] =
            ddmmyyyyMatch;
        const date = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
        );
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    const fallbackDate = new Date(text);
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate.toISOString();
};

const normalizePolicyNumber = (value) => {
    if (value === undefined || value === null || value === "") {
        return { value: null, error: null };
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            return {
                value: null,
                error: "must be a valid text/number value",
            };
        }

        if (!Number.isSafeInteger(value)) {
            return {
                value: null,
                error: "is too large as numeric Excel value and may lose precision. Format this column as Text",
            };
        }

        return { value: String(Math.trunc(value)), error: null };
    }

    let text = String(value).trim();
    if (!text) {
        return { value: null, error: null };
    }

    if (text.startsWith("'")) {
        text = text.slice(1).trim();
    }

    text = text.replace(/\s/g, "");

    const digitWithOptionalDecimalZero = text.match(/^(\d+)(?:[.,]0+)?$/);
    if (digitWithOptionalDecimalZero) {
        return { value: digitWithOptionalDecimalZero[1], error: null };
    }

    if (/^\d+[.,]\d+$/.test(text)) {
        return {
            value: null,
            error: "must not contain decimal values other than .00 or ,00",
        };
    }

    return {
        value: null,
        error: "must contain digits only",
    };
};

const validateUploadRows = (rows = [], headers = []) => {
    const validationErrors = [];
    const normalizedRows = [];
    const normalizedHeaders = (headers || []).map((header) => normalizeHeader(header));
    const headerSet = new Set(normalizedHeaders);

    const missingColumns = REQUIRED_UPLOAD_COLUMNS.filter((column) => !headerSet.has(column));
    if (missingColumns.length > 0) {
        validationErrors.push(
            `Invalid file format: missing required column \"${missingColumns[0]}\".`,
        );
        return { normalizedRows: [], validationErrors };
    }

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index] || {};
        const rowNumber = index + 2;
        const normalizedRow = { ...row };

        if (Array.isArray(row.__parsed_extra) && row.__parsed_extra.length > 0) {
            validationErrors.push(
                `Row ${rowNumber}: too many columns detected. Please check for unescaped commas in the CSV row.`,
            );
        }

        REQUIRED_UPLOAD_COLUMNS.forEach((column) => {
            const value = toNullableString(row[column]);
            if (!value) {
                validationErrors.push(
                    `Row ${rowNumber}: missing required value in column \"${column}\".`,
                );
            }
        });

        NUMERIC_UPLOAD_COLUMNS.forEach((column) => {
            const rawValue = row[column];
            if (rawValue === undefined || rawValue === null || rawValue === "") {
                return;
            }

            if (toNumber(rawValue) === null) {
                validationErrors.push(
                    `Row ${rowNumber}: invalid numeric format in column \"${column}\".`,
                );
            }
        });

        INTEGER_UPLOAD_COLUMNS.forEach((column) => {
            const rawValue = row[column];
            if (rawValue === undefined || rawValue === null || rawValue === "") {
                return;
            }

            const parsedInteger = toInteger(rawValue);
            if (parsedInteger === null) {
                validationErrors.push(
                    `Row ${rowNumber}: invalid integer format in column \"${column}\".`,
                );
                return;
            }

            if (FLAG_COLUMNS.includes(column) && ![0, 1].includes(parsedInteger)) {
                validationErrors.push(
                    `Row ${rowNumber}: invalid value in column \"${column}\". Allowed values are 0 or 1.`,
                );
                return;
            }

            if (column === "kolektabilitas" && (parsedInteger < 0 || parsedInteger > 5)) {
                validationErrors.push(
                    `Row ${rowNumber}: invalid value in column \"kolektabilitas\". Allowed range is 0 to 5.`,
                );
            }
        });

        DATE_UPLOAD_COLUMNS.forEach((column) => {
            const rawValue = row[column];
            if (rawValue === undefined || rawValue === null || rawValue === "") {
                return;
            }

            if (toIsoDate(rawValue) === null) {
                validationErrors.push(
                    `Row ${rowNumber}: invalid date format in column \"${column}\".`,
                );
            }
        });

        const policyNoResult = normalizePolicyNumber(row.policy_no);
        if (policyNoResult.error) {
            validationErrors.push(
                `Row ${rowNumber}: invalid format in column \"policy_no\" (${policyNoResult.error}).`,
            );
        }
        normalizedRow.policy_no = policyNoResult.value;

        normalizedRows.push(normalizedRow);
    }

    return { normalizedRows, validationErrors };
};

const parseUploadRows = async (file) => {
    const fileName = (file?.name || "").toLowerCase();

    if (fileName.endsWith(".csv")) {
        const text = await file.text();
        const parseResult = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => normalizeHeader(header),
            transform: (value) =>
                typeof value === "string" ? value.trim() : value,
        });

        const rows = (parseResult.data || []).map((row) => normalizeRow(row));
        const headers = Array.isArray(parseResult.meta?.fields)
            ? parseResult.meta.fields
            : Object.keys(rows[0] || {});

        return {
            rows,
            headers,
            parseErrors: parseResult.errors || [],
        };
    }

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, {
            type: "array",
            cellDates: true,
        });
        const firstSheetName = workbook.SheetNames?.[0];
        if (!firstSheetName) {
            return {
                rows: [],
                headers: [],
                parseErrors: [],
            };
        }

        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
            defval: "",
            raw: true,
            blankrows: false,
        });

        const normalizedRows = rows.map((row) => normalizeRow(row));
        const headers = Object.keys(normalizedRows[0] || {});

        return {
            rows: normalizedRows,
            headers,
            parseErrors: [],
        };
    }

    throw new Error("Unsupported file format. Please upload .csv, .xlsx, or .xls");
};

/**
 * Build a normalized debtor payload from a parsed CSV row
 * Used for both preview and actual database insert
 */
const buildDebtorPayload = (row, borderoId, batchId, contractId) => {
    const nomorPeserta = toNullableString(row.nomor_peserta);
    const namaPeserta = toNullableString(row.nama_peserta);

    return {
        cover_id: toNullableString(row.cover_id),
        program_id: toNullableString(row.program_id),
        bordero_id: borderoId,
        nomor_rekening_pinjaman: toNullableString(row.nomor_rekening_pinjaman),
        nomor_peserta: nomorPeserta,
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
        nama_peserta: namaPeserta,
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
        batch_id: batchId,
        version_no: 1,
        status: "SUBMITTED",
        is_locked: false,
    };
};

export default function SubmitDebtor() {
    const [user, setUser] = useState(null);
    const [auditActor, setAuditActor] = useState(null);
    const [userRoles, setUserRoles] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [totalDebtors, setTotalDebtors] = useState(0);
    // Split loading states: page boot vs table refetch
    const [pageLoading, setPageLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);

    // Form state
    const [selectedContract, setSelectedContract] = useState("");
    const [batchMode, setBatchMode] = useState("new"); // 'new' or 'revise'
    const [selectedBatch, setSelectedBatch] = useState("");
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Upload dialog two-tab state
    const [uploadTabActive, setUploadTabActive] = useState(1); // 1 = upload, 2 = preview
    const [uploadPreviewData, setUploadPreviewData] = useState([]); // normalized debtor objects ready for DB
    const [uploadPreviewLoading, setUploadPreviewLoading] = useState(false);

    // Dialog state
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [selectedDebtors, setSelectedDebtors] = useState([]);
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [revisionNote, setRevisionNote] = useState("");
    const [actionNote, setActionNote] = useState("");
    const [revisionDiffs, setRevisionDiffs] = useState([]);

    // Message state
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const [filters, setFilters] = useState(defaultFilter);
    const [page, setPage] = useState(1);
    const isFirstPageEffect = useRef(true);
    const canShowActionButtons = userRoles.some((role) => {
        const normalizedRole = String(role || "").trim().toLowerCase();
        return (
            normalizedRole === "maker-brins-role"
        );
    });

    const isCheckerBrins = userRoles.some(
        (role) => String(role || "").trim().toLowerCase() === "checker-brins-role",
    );
    const isApproverBrins = userRoles.some(
        (role) => String(role || "").trim().toLowerCase() === "approver-brins-role",
    );

    useEffect(() => {
        console.log('%c[RevisionDiffs] useEffect triggered', 'color: cyan; font-weight: bold');
        console.log('showDetailDialog:', showDetailDialog, 'selectedDebtor:', selectedDebtor);
        
        let mounted = true;
        const fetchPrevRevision = async () => {
            console.log('%c[RevisionDiffs] fetchPrevRevision called', 'color: yellow');
            
            if (!showDetailDialog || !selectedDebtor) {
                console.log('[RevisionDiffs] Early return: showDetailDialog or selectedDebtor is falsy');
                if (mounted) setRevisionDiffs([]);
                return;
            }
            
            const version = selectedDebtor?.version_no || 0;
            console.log('[RevisionDiffs] Debtor version_no:', version, 'Is revised?', version > 1);
            
            if (version <= 1) {
                console.log('[RevisionDiffs] Early return: not a revised debtor (version_no <= 1)');
                if (mounted) setRevisionDiffs([]);
                return;
            }

            try {
                console.log('[RevisionDiffs] Fetching for nomor_peserta:', selectedDebtor.nomor_peserta);
                const res = await backend.listPaginated('DebtorRevise', {
                    page: 1,
                    limit: 100,
                    q: JSON.stringify({ 
                        nomor_peserta: selectedDebtor.nomor_peserta
                    }),
                });
                
                console.log('[RevisionDiffs] Query response:', res);
                console.log('[RevisionDiffs] res.data:', res?.data);

                if (!Array.isArray(res?.data) || res.data.length === 0) {
                    console.warn('[RevisionDiffs] No records found OR res.data is not array. res.data:', res?.data);
                    if (mounted) setRevisionDiffs([]);
                    return;
                }

                const prev = res.data[0];
                console.log('[RevisionDiffs] Previous version:', prev);
                console.log('[RevisionDiffs] Current version_no:', selectedDebtor.version_no);

                const diffs = [];
                const keys = Object.keys(selectedDebtor || {}).filter((k) => 
                    k !== 'id' && k !== 'created_at' && k !== 'updated_at' && k !== 'archived_at'
                );
                
                console.log('[RevisionDiffs] Keys to compare:', keys);
                
                for (const k of keys) {
                    const oldVal = prev[k];
                    const newVal = selectedDebtor[k];
                    const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal);
                    const newStr = newVal === null || newVal === undefined ? '' : String(newVal);
                    if (oldStr !== newStr) {
                        diffs.push({ key: k, old: oldStr || '-', new: newStr || '-' });
                    }
                }
                
                console.log('[RevisionDiffs] Final diffs array:', diffs);
                if (mounted) {
                    setRevisionDiffs(diffs);
                    console.log('[RevisionDiffs] setRevisionDiffs called with:', diffs);
                }
            } catch (e) {
                console.error('[RevisionDiffs] Exception caught:', e);
                if (mounted) setRevisionDiffs([]);
            }
        };
        
        fetchPrevRevision();
        return () => {
            mounted = false;
        };
    }, [showDetailDialog, selectedDebtor]);

    // === GENERATE PREVIEW DATA FOR TAB 2 ===
    const handlePreviewData = async () => {
        // Validate inputs
        if (!selectedContract) {
            setErrorMessage("Please select a contract");
            toast.error("Please select a contract");
            return;
        }

        if (batchMode === "revise" && !selectedBatch) {
            setErrorMessage("Please select a batch to revise");
            toast.error("Please select a batch to revise");
            return;
        }

        if (!uploadFile) {
            setErrorMessage("Please select a file to upload");
            toast.error("Please select a file to upload");
            return;
        }

        // Validate revision debtors exist
        if (batchMode === "revise") {
            const revisionDebtorsInBatch = debtors.filter(
                (d) =>
                    d.batch_id === selectedBatch &&
                    d.contract_id === selectedContract &&
                    d.status === "REVISION",
            );

            if (revisionDebtorsInBatch.length === 0) {
                const revisionMessage = `No debtors with status REVISION found in batch ${selectedBatch} for contract ${selectedContract}.`;
                setErrorMessage(revisionMessage);
                toast.error(revisionMessage);
                return;
            }
        }

        setUploadPreviewLoading(true);
        setErrorMessage("");

        try {
            // Parse file
            const rows = await parseUploadRows(uploadFile);

            if (rows.parseErrors?.length > 0) {
                const firstParseError = rows.parseErrors[0];
                const parseMessage = `Invalid CSV format${firstParseError?.row ? ` on row ${firstParseError.row}` : ""}: ${firstParseError?.message || "Unable to parse the uploaded file."}`;
                setErrorMessage(parseMessage);
                toast.error(parseMessage);
                setUploadPreviewLoading(false);
                return;
            }

            let normalizedRows = Array.isArray(rows.rows) ? rows.rows : [];

            // Validate rows
            const uploadValidation = validateUploadRows(
                normalizedRows,
                rows.headers,
            );
            normalizedRows = uploadValidation.normalizedRows;

            if (uploadValidation.validationErrors.length > 0) {
                const shortMessage = uploadValidation.validationErrors[0];
                const detailedMessage =
                    `Upload validation failed: ${uploadValidation.validationErrors.length} issue(s) found.\n` +
                    `${uploadValidation.validationErrors.slice(0, 5).join("\n")}` +
                    `${uploadValidation.validationErrors.length > 5 ? `\n...and ${uploadValidation.validationErrors.length - 5} more issue(s)` : ""}`;

                setErrorMessage(detailedMessage);
                toast.error(shortMessage);
                setUploadPreviewLoading(false);
                return;
            }

            if (!normalizedRows || normalizedRows.length === 0) {
                setErrorMessage("File is empty or invalid format");
                toast.error("File is empty or invalid format");
                setUploadPreviewLoading(false);
                return;
            }

            // Validate revision mode debtor matching
            if (batchMode === "revise") {
                const revisionDebtorsInBatch = debtors.filter(
                    (d) =>
                        d.batch_id === selectedBatch &&
                        d.contract_id === selectedContract &&
                        d.status === "REVISION",
                );
                const revisionNomorPesertaSet = new Set(
                    revisionDebtorsInBatch.map((d) => d.nomor_peserta),
                );

                const invalidRows = [];
                for (let i = 0; i < normalizedRows.length; i++) {
                    const nomorPeserta = toNullableString(
                        normalizedRows[i].nomor_peserta,
                    );
                    if (!revisionNomorPesertaSet.has(nomorPeserta)) {
                        invalidRows.push({
                            row: i + 2,
                            nomor_peserta: nomorPeserta || "(empty)",
                        });
                    }
                }

                if (invalidRows.length > 0) {
                    const details = invalidRows
                        .slice(0, 5)
                        .map(
                            (r) =>
                                `Row ${r.row}: nomor_peserta "${r.nomor_peserta}" is not a REVISION debtor in this batch`,
                        )
                        .join("\n");
                    setErrorMessage(
                        `Validation failed — file contains debtors that are not marked as REVISION in batch ${selectedBatch}:\n${details}${invalidRows.length > 5 ? `\n...and ${invalidRows.length - 5} more` : ""}`,
                    );
                    toast.error(
                        `Validation failed: non-REVISION debtor found for batch ${selectedBatch}`,
                    );
                    setUploadPreviewLoading(false);
                    return;
                }
            }

            // Generate or retrieve batch ID
            let batchId;
            let borderoId;
            let period;

            if (batchMode === "new") {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, "0");
                const randomNum =
                    Math.floor(Math.random() * 900000) + 100000;
                batchId = `BATCH-${year}-${month}-${randomNum}`;

                const now2 = new Date();
                period = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, "0")}`;
                borderoId = `BRD-${batchId.replace("BATCH-", "")}`;
            } else {
                // Revision mode: use existing batch and bordero
                batchId = selectedBatch;
                const borderos = await backend.list("Bordero");
                const match = Array.isArray(borderos)
                    ? borderos.find(
                          (b) =>
                              b.batch_id === batchId &&
                              b.contract_id === selectedContract,
                      )
                    : null;

                if (!match?.bordero_id) {
                    const borderoMessage = `Bordero not found for batch ${batchId} and contract ${selectedContract}. Please generate Bordero first.`;
                    setErrorMessage(borderoMessage);
                    toast.error(borderoMessage);
                    setUploadPreviewLoading(false);
                    return;
                }

                borderoId = match.bordero_id;
                period = match.period || null;
            }

            // Build normalized debtor payloads
            const previewPayloads = [];
            for (let i = 0; i < normalizedRows.length; i++) {
                try {
                    const row = normalizedRows[i];
                    const nomorPeserta = toNullableString(
                        row.nomor_peserta,
                    );
                    const namaPeserta = toNullableString(row.nama_peserta);

                    if (!nomorPeserta || !namaPeserta) {
                        throw new Error(
                            `Row ${i + 2}: nomor_peserta and nama_peserta are required`,
                        );
                    }

                    const payload = buildDebtorPayload(
                        row,
                        borderoId,
                        batchId,
                        selectedContract,
                    );
                    previewPayloads.push(payload);
                } catch (rowError) {
                    const rowMessage = rowError?.message ||
                        "Unknown upload error";
                    if (/^Row\s+\d+:/i.test(rowMessage)) {
                        throw new Error(rowMessage);
                    }
                    throw new Error(`Row ${i + 2}: ${rowMessage}`);
                }
            }

            // Store preview data and switch to Tab 2
            setUploadPreviewData(previewPayloads);
            setUploadTabActive(2);
        } catch (error) {
            const errorMsg =
                error?.message || "Failed to generate preview";
            setErrorMessage(errorMsg);
            toast.error(errorMsg);
        } finally {
            setUploadPreviewLoading(false);
        }
    };

    // === CHECKER BRINS: SUBMITTED → CHECKED_BRINS ===
    const handleCheckerBrinsCheck = async () => {
        if (selectedDebtors.length === 0) {
            toast.error("Please select debtors to check");
            return;
        }
        setUploading(true);
        setErrorMessage("");
        setSuccessMessage("");
        try {
            let processedCount = 0;
            for (const debtorId of selectedDebtors) {
                const debtor = debtors.find((d) => d.id === debtorId);
                if (!debtor || debtor.status !== "SUBMITTED") continue;

                await backend.update("Debtor", debtor.id, {
                    status: "CHECKED_BRINS",
                });
                processedCount++;

                try {
                    await backend.create("AuditLog", {
                        action: "DEBTOR_CHECKED_BRINS",
                        module: "DEBTOR",
                        entity_type: "Debtor",
                        entity_id: debtor.id,
                        old_value: JSON.stringify({ status: "SUBMITTED" }),
                        new_value: JSON.stringify({ status: "CHECKED_BRINS" }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason: `Checker BRINS checked debtor ${debtor.nama_peserta}`,
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
            }

            if (processedCount === 0) {
                toast.warning("No debtors with SUBMITTED status were found in your selection.");
                setSelectedDebtors([]);
                setUploading(false);
                return;
            }

            // Create notifications for all BRINS roles
            const brinsRoles = ["maker-brins-role", "checker-brins-role", "approver-brins-role"];
            for (const role of brinsRoles) {
                try {
                    await backend.create("Notification", {
                        title: "Debtors Checked by BRINS Checker",
                        message: `${auditActor?.user_role || user?.role} checked ${processedCount} debtor(s). Awaiting BRINS Approver approval.`,
                        type: "INFO",
                        module: "DEBTOR",
                        target_role: role,
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            }

            // Send notification email for status transition
            try {
                sendNotificationEmail({
                    targetGroup: 'brins-approver',
                    objectType: 'Record',
                    statusTo: 'CHECKED_BRINS',
                    recipientRole: 'BRINS',
                    variables: {
                        batch_id: debtors.find(d => selectedDebtors.includes(d.id))?.batch_id || '',
                        user_name: auditActor?.user_email || user?.email || 'System',
                        date: new Date().toLocaleDateString('id-ID'),
                        count: String(processedCount),
                    },
                    fallbackSubject: 'Debtors Checked – Batch {batch_id}',
                    fallbackBody: '<p>{user_name} has checked {count} debtor(s) in batch {batch_id} on {date}. Awaiting Approver BRINS approval.</p>',
                }).catch(err => console.error("Background email failed:", err));
            } catch (emailError) {
                console.warn('Failed to send notification email:', emailError);
            }

            setSuccessMessage(`${processedCount} debtor(s) checked successfully. Awaiting Approver BRINS approval.`);
            toast.success(`${processedCount} debtor(s) checked.`);
            setSelectedDebtors([]);
            await loadDebtors();
        } catch (error) {
            console.error("Check failed:", error);
            setErrorMessage(`Check failed: ${error.message}`);
        }
        setUploading(false);
    };

    // === APPROVER BRINS: CHECKED_BRINS → APPROVED_BRINS ===
    const handleApproverBrinsApprove = async () => {
        if (selectedDebtors.length === 0) {
            toast.error("Please select debtors to approve");
            return;
        }
        setUploading(true);
        setErrorMessage("");
        setSuccessMessage("");
        try {
            let processedCount = 0;
            for (const debtorId of selectedDebtors) {
                const debtor = debtors.find((d) => d.id === debtorId);
                if (!debtor || debtor.status !== "CHECKED_BRINS") continue;

                await backend.update("Debtor", debtor.id, {
                    status: "APPROVED_BRINS",
                });
                processedCount++;

                try {
                    await backend.create("AuditLog", {
                        action: "DEBTOR_APPROVED_BRINS",
                        module: "DEBTOR",
                        entity_type: "Debtor",
                        entity_id: debtor.id,
                        old_value: JSON.stringify({ status: "CHECKED_BRINS" }),
                        new_value: JSON.stringify({ status: "APPROVED_BRINS" }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason: `Approver BRINS approved debtor ${debtor.nama_peserta}`,
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
            }

            if (processedCount === 0) {
                toast.warning("No debtors with CHECKED_BRINS status were found in your selection.");
                setSelectedDebtors([]);
                setUploading(false);
                return;
            }

            // Create notifications for all BRINS + Tugure roles
            const allRoles = ["maker-brins-role", "checker-brins-role", "approver-brins-role", "checker-tugure-role", "approver-tugure-role"];
            for (const role of allRoles) {
                try {
                    await backend.create("Notification", {
                        title: "Debtors Approved by BRINS",
                        message: `${auditActor?.user_role || user?.role} approved ${processedCount} debtor(s). Now available for Tugure review.`,
                        type: "INFO",
                        module: "DEBTOR",
                        target_role: role,
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            }

            // Send notification email for status transition
            try {
                sendNotificationEmail({
                    targetGroup: 'tugure-checker',
                    objectType: 'Record',
                    statusTo: 'APPROVED_BRINS',
                    recipientRole: 'ALL',
                    variables: {
                        batch_id: debtors.find(d => selectedDebtors.includes(d.id))?.batch_id || '',
                        user_name: auditActor?.user_email || user?.email || 'System',
                        date: new Date().toLocaleDateString('id-ID'),
                        count: String(processedCount),
                    },
                    fallbackSubject: 'Debtors Approved by BRINS – Batch {batch_id}',
                    fallbackBody: '<p>{user_name} has approved {count} debtor(s) in batch {batch_id} on {date}. Now available for Tugure review.</p>',
                }).catch(err => console.error("Background email failed:", err));
            } catch (emailError) {
                console.warn('Failed to send notification email:', emailError);
            }

            setSuccessMessage(`${processedCount} debtor(s) approved by BRINS. Now available on Debtor Review for Tugure.`);
            toast.success(`${processedCount} debtor(s) approved by BRINS.`);
            setSelectedDebtors([]);
            await loadDebtors();
        } catch (error) {
            console.error("Approve failed:", error);
            setErrorMessage(`Approve failed: ${error.message}`);
        }
        setUploading(false);
    };

    const formatUploadError = (message) => {
        if (!message) {
            return {
                title: "",
                items: [],
                summary: "",
            };
        }

        const lines = String(message)
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        const summary = lines[0] || "Upload failed.";
        const rowItems = lines.filter((line) => /^Row\s+\d+:/i.test(line));

        if (rowItems.length > 0) {
            return {
                title: "Please review the following issues:",
                items: rowItems.slice(0, 6),
                summary,
            };
        }

        const fallbackItems = lines.slice(1, 7);
        return {
            title: "Please review the following issues:",
            items: fallbackItems,
            summary,
        };
    };

    const uploadErrorView = formatUploadError(errorMessage);

    const pageSize = 10;
    const total = totalDebtors;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    const pageData = Array.isArray(debtors) ? debtors : [];

    useEffect(() => {
        loadUser();
        loadInitialData();
    }, []);

    const loadUser = async () => {
        try {
            const { default: keycloakService } = await import('@/services/keycloakService');
            const userInfo = keycloakService.getCurrentUserInfo();
            if (userInfo) {
                const roles = keycloakService.getRoles();
                const roleList = Array.isArray(roles) ? roles : [];
                const normalizedRoles = roleList
                    .map((roleName) => String(roleName || "").trim().toLowerCase())
                    .filter(Boolean);
                const actor = keycloakService.getAuditActor();
                setUserRoles(roleList);
                setAuditActor(actor || null);
                let role = 'USER';
                if (normalizedRoles.includes('admin')) role = 'admin';
                else if (normalizedRoles.includes('approver-brins-role')) role = 'approver';
                else if (normalizedRoles.includes('checker-brins-role')) role = 'checker';
                else if (normalizedRoles.includes('maker-brins-role')) role = 'maker';
                setUser({ id: userInfo.id, email: userInfo.email, full_name: userInfo.name, role });
            }
        } catch (error) {
            console.error("Failed to load user:", error);
        }
    };

    const loadInitialData = async () => {
        setPageLoading(true);
        setSuccessMessage("");
        setErrorMessage("");

        try {
            await Promise.all([loadContracts(), loadBatches()]);
        } catch (error) {
            console.error("Failed to load data:", error);
            setErrorMessage("Failed to load data. Please refresh the page.");
        } finally {
            setPageLoading(false);
        }
    };

    const loadContracts = async () => {
        try {
            const data = await backend.list("MasterContract");
            // Keep the full list from backend and let `activeContracts` determine
            // which ones are displayed. Previously we filtered here by
            // `effective_status` which removed contracts that are `APPROVED` but
            // not marked `Active` in `effective_status`.
            setContracts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading contracts:", error);
            setContracts([]);
        }
    };

    const loadBatches = async () => {
        try {
            const data = await backend.list("Batch");
            setBatches(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading batches:", error);
            setBatches([]);
        }
    };

    const loadDebtors = async (pageToLoad = page, activeFilters = filters) => {
        setTableLoading(true);
        try {
            const query = { page: pageToLoad, limit: pageSize };
            if (activeFilters) {
                query.q = JSON.stringify(activeFilters);
            }

            const useReviseLog =
                activeFilters?.submitStatus === "REVISION" ||
                activeFilters?.status === "REVISION";
            const entityName = useReviseLog ? "ReviseLog" : "Debtor";

            const result = await backend.listPaginated(entityName, query);
            setDebtors(Array.isArray(result.data) ? result.data : []);
            setTotalDebtors(Number(result.pagination?.total) || 0);
        } catch (error) {
            console.error("Error loading debtors:", error);
            setDebtors([]);
            setTotalDebtors(0);
        } finally {
            setTableLoading(false);
        }
    };

    const handleRefresh = () => {
        setSuccessMessage("");
        setErrorMessage("");
        loadInitialData();
        loadDebtors(page, filters);
    };

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages]);

    useEffect(() => {
        setSelectedDebtors([]);
        if (page !== 1) {
            setPage(1);
            return;
        }

        loadDebtors(1, filters);
    }, [
        filters.contract,
        filters.batch,
        filters.submitStatus,
        filters.name,
    ]);

    useEffect(() => {
        if (isFirstPageEffect.current) {
            isFirstPageEffect.current = false;
            return;
        }

        setSelectedDebtors([]);
        loadDebtors(page, filters);
    }, [page]);

    // Download template
    const handleDownloadTemplate = () => {
        const headers = [
            "COVER_ID", "PROGRAM_ID", "NOMOR_REKENING_PINJAMAN", "NOMOR_PESERTA",
            "LOAN_TYPE", "CIF_REKENING_PINJAMAN", "JENIS_PENGAJUAN_DESC",
            "JENIS_COVERING_DESC", "TANGGAL_MULAI_COVERING", "TANGGAL_AKHIR_COVERING",
            "PLAFON", "NOMINAL_PREMI", "PREMIUM", "KOMISI", "NET_PREMI",
            "NOMINAL_KOMISI_BROKER", "UNIT_CODE", "UNIT_DESC", "BRANCH_DESC",
            "REGION_DESC", "NAMA_PESERTA", "ALAMAT_USAHA", "NOMOR_PERJANJIAN_KREDIT",
            "TANGGAL_TERIMA", "TANGGAL_VALIDASI", "TELLER_PREMIUM_DATE",
            "STATUS_AKTIF", "REMARK_PREMI", "FLAG_RESTRUK", "KOLEKTABILITAS"
        ];

        const sampleData = [
            ["1111301", "501", "002101000888123", "0000B.00021.2026.01.00001.1.1", "DL", "HEC7001", "New", "Conditional Automatic Cover", "01/01/2026", "01/01/2027", 500000000, 12500000, 5312500, 1460937, 3851563, 119000, "0021", "KCP JAKARTA PUSAT", "KC Jakarta", "Jakarta", "Budi Santoso", "Jl. Thamrin No. 10", "PK-001", "2026-01-05", "2026-01-06", "2026-01-06", 1, "BRISURF_COV_00501_002101000888123_01", 0, 1],
            ["1111302", "501", "002101000888456", "0000C.00021.2026.01.00002.1.1", "DL", "HEC7002", "New", "Conditional Automatic Cover", "05/01/2026", "05/01/2027", 250000000, 6250000, 2656250, 730468, 1925782, 119000, "0021", "KCP JAKARTA PUSAT", "KC Jakarta", "Jakarta", "Siti Aminah", "Jl. Sudirman Kav 25", "PK-002", "2026-01-10", "2026-01-11", "2026-01-11", 1, "BRISURF_COV_00501_002101000888456_01", 0, 1],
            ["1111303", "501", "004501502999789", "0000D.00045.2026.02.00001.1.1", "DL", "HEC7003", "New", "Conditional Automatic Cover", "12/02/2026", "12/02/2027", 750000000, 18750000, 7968750, 2191406, 5777344, 119000, "0045", "KCP BANDUNG", "KC Bandung", "Jawa Barat", "Andi Wijaya", "Jl. Asia Afrika No. 5", "PK-003", "2026-02-15", "2026-02-16", "2026-02-16", 1, "BRISURF_COV_00501_004501502999789_02", 0, 1],
            ["1111304", "501", "004501502999000", "0000E.00045.2026.02.00002.1.1", "DL", "HEC7004", "New", "Conditional Automatic Cover", "20/02/2026", "20/02/2027", 100000000, 2500000, 1062500, 292187, 770313, 119000, "0045", "KCP BANDUNG", "KC Bandung", "Jawa Barat", "Dewi Lestari", "Jl. Braga No. 12", "PK-004", "2026-02-22", "2026-02-23", "2026-02-23", 1, "BRISURF_COV_00501_004501502999000_02", 0, 1],
            ["1111305", "501", "009901000777321", "0000F.00099.2026.03.00001.1.1", "DL", "HEC7005", "New", "Conditional Automatic Cover", "01/03/2026", "01/03/2027", 300000000, 7500000, 3187500, 876562, 2310938, 119000, "0099", "KCP MEDAN", "KC Medan", "Sumatera Utara", "Ahmad Fauzi", "Jl. Gatot Subroto No. 88", "PK-005", "2026-03-05", "2026-03-06", "2026-03-06", 1, "BRISURF_COV_00501_009901000777321_03", 0, 1]
        ];

        const data = [headers, ...sampleData];

        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Debtor Template");

        XLSX.writeFile(workbook, "debtor_template.xlsx");

        toast.success("Template downloaded");
    };

    // Get all column keys for preview table
    const getPreviewColumnKeys = () => {
        if (!uploadPreviewData || uploadPreviewData.length === 0) return [];
        
        const allowedHeaders = [
            "COVER_ID", "PROGRAM_ID", "NOMOR_REKENING_PINJAMAN", "NOMOR_PESERTA",
            "LOAN_TYPE", "CIF_REKENING_PINJAMAN", "JENIS_PENGAJUAN_DESC",
            "JENIS_COVERING_DESC", "TANGGAL_MULAI_COVERING", "TANGGAL_AKHIR_COVERING",
            "PLAFON", "NOMINAL_PREMI", "PREMIUM", "KOMISI", "NET_PREMI",
            "NOMINAL_KOMISI_BROKER", "UNIT_CODE", "UNIT_DESC", "BRANCH_DESC",
            "REGION_DESC", "NAMA_PESERTA", "ALAMAT_USAHA", "NOMOR_PERJANJIAN_KREDIT",
            "TANGGAL_TERIMA", "TANGGAL_VALIDASI", "TELLER_PREMIUM_DATE",
            "STATUS_AKTIF", "REMARK_PREMI", "FLAG_RESTRUK", "KOLEKTABILITAS"
        ].map(h => h.toLowerCase());

        const firstRow = uploadPreviewData[0];
        
        // Only return columns that are explicitly in the allowed headers list
        return allowedHeaders.filter(key => key in firstRow);
    };

    // Format column header name (e.g., nomor_peserta -> Nomor Peserta)
    const formatHeaderName = (key) => {
        return key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Format value for display
    const formatCellValue = (key, value) => {
        if (value === null || value === undefined || value === '') return '-';
        
        // Format currency fields
        if (key.includes('plafon') || key.includes('nominal') || key.includes('premium') || 
            key.includes('ric_') || key.includes('bf_') || key.includes('net_premi')) {
            if (typeof value === 'number') return formatRupiahAdaptive(value);
        }
        
        // Format date fields
        if (key.includes('tanggal') || key.includes('date') || key.includes('_date')) {
            if (typeof value === 'string' && value.length >= 10) {
                return value.slice(0, 10); // Show only date part
            }
        }
        
        // Format percentage fields
        if (key.includes('percentage') || key.includes('pct')) {
            if (typeof value === 'number') return `${value.toFixed(2)}%`;
        }
        
        // Format numeric fields
        if (key.includes('_no') && typeof value === 'number') {
            return value.toString();
        }
        
        return String(value);
    };

    // Submit bulk upload
    const handleConfirmSave = async () => {
        // Validate preview data exists
        if (!uploadPreviewData || uploadPreviewData.length === 0) {
            setErrorMessage("No preview data available. Please generate preview first.");
            toast.error("No preview data available.");
            return;
        }

        setUploading(true);
        setErrorMessage("");
        setSuccessMessage("");

        let uploaded = 0;
        const createdDebtorIds = [];

        try {
            // Extract batch and bordero IDs from preview data (all rows have the same batch_id and bordero_id)
            const batchId = uploadPreviewData[0].batch_id;
            const borderoId = uploadPreviewData[0].bordero_id;
            const contractId = uploadPreviewData[0].contract_id;

            // Calculate totals from normalized data
            const totalExposure = uploadPreviewData.reduce(
                (sum, row) => Number(sum) + (row.plafon || 0),
                0,
            );
            const totalPremium = uploadPreviewData.reduce(
                (sum, row) => Number(sum) + (row.nominal_premi || 0),
                0,
            );

            // Create or update batch
            let period = null;

            if (batchMode === "new") {
                await backend.create("Batch", {
                    batch_id: batchId,
                    batch_month: new Date().getMonth() + 1,
                    batch_year: new Date().getFullYear(),
                    contract_id: contractId,
                    total_records: uploadPreviewData.length,
                    total_exposure: totalExposure,
                    total_premium: totalPremium,
                    status: "Uploaded",
                });

                // Create Bordero
                const now = new Date();
                period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

                await backend.create("Bordero", {
                    bordero_id: borderoId,
                    contract_id: contractId,
                    batch_id: batchId,
                    period: period,
                    total_debtors: 0,
                    currency: "IDR",
                });
            }

            // Create debtors using atomic upload (handles versioning and archiving)
            const result = await backend.uploadDebtorsAtomic({
                uploadMode: batchMode,
                selectedDebtorForRevision: batchMode === 'revise' ? selectedBatch : null,
                debtors: uploadPreviewData,
            });

            const createdDebtors = result?.debtors || [];
            createdDebtorIds.push(...(createdDebtors.map((d) => d.id) || []));
            uploaded = createdDebtors.length;

            if (uploaded === 0) {
                setErrorMessage("No debtors were created. Please check your data and try again.");
                setUploading(false);
                return;
            }

            // Calculate new totals for Bordero
            let totalPlafon = 0;
            let totalNominalPremi = 0;
            let totalNetPremi = 0;
            let totalPremiumAmount = 0;
            let totalRicAmount = 0;
            let totalBfAmount = 0;
            
            for (let i = 0; i < uploadPreviewData.length; i++) {
                const r = uploadPreviewData[i];
                totalPlafon += (parseFloat(r.plafon) || 0);
                totalNominalPremi += (parseFloat(r.nominal_premi) || 0);
                totalNetPremi += (parseFloat(r.net_premi) || 0);
                totalPremiumAmount += (parseFloat(r.premium_amount) || 0);
                totalRicAmount += (parseFloat(r.ric_amount) || 0);
                totalBfAmount += (parseFloat(r.bf_amount) || 0);
            }

            // Update Bordero totals after debtor creation
            if (borderoId) {
                try {
                    await backend.update("Bordero", borderoId, {
                        total_debtors: uploaded,
                        total_plafon: totalPlafon,
                        total_nominal_premi: totalNominalPremi,
                        total_net_premi: totalNetPremi,
                        total_premium_amount: totalPremiumAmount,
                        total_ric_amount: totalRicAmount,
                        total_bf_amount: totalBfAmount,
                    });
                } catch (borderoError) {
                    console.error("Failed to update Bordero:", borderoError);
                }
            }

            // === REVISION MODE HANDLED BY BACKEND ===
            // uploadDebtorsAtomic on the backend handles:
            // - Archiving old REVISION debtors to DebtorRevise
            // - Deleting old debtors from Debtor table
            // - Creating versioned records with version_no incremented
            // - parent_debtor_id relationships

            // Create audit log for the upload
            try {
                await backend.create("AuditLog", {
                    action:
                        batchMode === "new" ? "BULK_UPLOAD" : "BULK_REVISION",
                    module: "DEBTOR",
                    entity_type: "Debtor",
                    entity_id: batchId,
                    old_value: "",
                    new_value: JSON.stringify({
                        count: uploadPreviewData.length,
                        upload_mode: batchMode,
                    }),
                    user_email: auditActor?.user_email || user?.email,
                    user_role: auditActor?.user_role || user?.role,
                    reason: `${batchMode === 'new' ? 'Uploaded' : 'Revised'} ${uploadPreviewData.length} debtors to batch ${batchId}`,
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            // Create notifications
            try {
                await backend.create("Notification", {
                    title: "Batch Upload Completed",
                    message: `${auditActor?.user_role} Successfully uploaded ${uploaded} debtors to batch ${batchId}`,
                    type: "INFO",
                    module: "DEBTOR",
                    reference_id: batchId,
                    target_role: "maker-brins-role",
                });
                await backend.create("Notification", {
                    title: "Batch Upload Completed",
                    message: `${auditActor?.user_role} Successfully uploaded ${uploaded} debtors to batch ${batchId}`,
                    type: "INFO",
                    module: "DEBTOR",
                    reference_id: batchId,
                    target_role: "checker-brins-role",
                });
                await backend.create("Notification", {
                    title: "Batch Upload Completed",
                    message: `${auditActor?.user_role} Successfully uploaded ${uploaded} debtors to batch ${batchId}`,
                    type: "INFO",
                    module: "DEBTOR",
                    reference_id: batchId,
                    target_role: "approver-brins-role",
                });
            } catch (notifError) {
                console.warn("Failed to create notification:", notifError);
            }

            // Send notification email for upload
            try {
                sendNotificationEmail({
                    targetGroup: "brins-checker",
                    objectType: "Record",
                    statusTo: "SUBMITTED",
                    recipientRole: "BRINS",
                    variables: {
                        batch_id: batchId || "",
                        user_name: auditActor?.user_email || user?.email || "System",
                        date: new Date().toLocaleDateString("id-ID"),
                        count: String(uploaded),
                    },
                    fallbackSubject: "Debtor Upload Completed – Batch {batch_id}",
                    fallbackBody:
                        "<p>{user_name} has uploaded {count} debtor(s) to batch {batch_id} on {date}. Awaiting review.</p>",
                }).catch((err) =>
                    console.error("Background email failed:", err),
                );
            } catch (emailError) {
                console.warn("Failed to send notification email:", emailError);
            }

            if (batchMode === "revise") {
                setSuccessMessage(
                    `Successfully uploaded ${uploaded} revised debtor(s) to batch ${batchId}. Old REVISION data has been moved to ReviseLog.`,
                );
                toast.success(
                    `Successfully uploaded ${uploaded} revised debtor(s).`,
                );
            } else {
                setSuccessMessage(
                    `Successfully uploaded ${uploaded} debtors to batch ${batchId}`,
                );
                toast.success(`Successfully uploaded ${uploaded} debtors.`);
            }

            // Close dialog and reset states
            setUploadDialogOpen(false);
            setUploadTabActive(1);
            setUploadPreviewData([]);
            setUploadFile(null);
            setSelectedContract("");
            setBatchMode("new");
            setSelectedBatch("");
            setErrorMessage("");

            // Reload data
            await loadBatches();
            await loadDebtors();
        } catch (error) {
            console.error("Upload error:", error);

            // Rollback: delete created debtors
            if (createdDebtorIds.length > 0) {
                for (const debtorId of createdDebtorIds.reverse()) {
                    try {
                        await backend.delete("Debtor", debtorId);
                    } catch (rollbackError) {
                        console.error(
                            `Rollback failed for Debtor ${debtorId}:`,
                            rollbackError,
                        );
                    }
                }
            }

            // Rollback: delete batch and bordero if in new mode
            if (batchMode === "new") {
                const borderoId =
                    uploadPreviewData.length > 0
                        ? uploadPreviewData[0].bordero_id
                        : null;
                const batchId =
                    uploadPreviewData.length > 0
                        ? uploadPreviewData[0].batch_id
                        : null;

                if (borderoId) {
                    try {
                        await backend.delete("Bordero", borderoId);
                    } catch (rollbackError) {
                        console.error(
                            `Rollback failed for Bordero ${borderoId}:`,
                            rollbackError,
                        );
                    }
                }

                if (batchId) {
                    try {
                        await backend.delete("Batch", batchId);
                    } catch (rollbackError) {
                        console.error(
                            `Rollback failed for Batch ${batchId}:`,
                            rollbackError,
                        );
                    }
                }
            }

            const uploadFailedMessage = `Upload failed: ${error.message}`;
            setErrorMessage(uploadFailedMessage);
            toast.error(uploadFailedMessage);
        }
        setUploading(false);
    };

    // Handle request revision for selected debtors
    const handleRequestRevision = async () => {
        if (selectedDebtors.length === 0) {
            setErrorMessage("Please select debtors to revise");
            return;
        }

        if (!revisionNote.trim()) {
            setErrorMessage("Please provide a revision note");
            return;
        }

        setUploading(true);
        setErrorMessage("");
        setSuccessMessage("");

        try {
            for (const debtorId of selectedDebtors) {
                const debtor = debtors.find((d) => d.id === debtorId);
                if (!debtor) continue;

                await backend.update("Debtor", debtor.id, {
                    status: "CONDITIONAL",
                    validation_remarks: revisionNote,
                });

                // Create audit log
                try {
                    await backend.create("AuditLog", {
                        action: "REQUEST_REVISION",
                        module: "DEBTOR",
                        entity_type: "Debtor",
                        entity_id: debtor.id,
                        old_value: JSON.stringify({ status: debtor.status }),
                        new_value: JSON.stringify({ status: "CONDITIONAL" }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason: revisionNote,
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
            }

            // Create notification
            try {
                await backend.create("Notification", {
                    title: "Revision Requested",
                    message: `Revision requested for ${selectedDebtors.length} debtors: ${revisionNote}`,
                    type: "WARNING",
                    module: "DEBTOR",
                    target_role: "ALL",
                });
            } catch (notifError) {
                console.warn("Failed to create notification:", notifError);
            }

            // Send notification email for revision request
            try {
                sendNotificationEmail({
                    targetGroup: 'brins-maker',
                    objectType: 'Record',
                    statusTo: 'CONDITIONAL',
                    recipientRole: 'BRINS',
                    variables: {
                        batch_id: debtors.find(d => selectedDebtors.includes(d.id))?.batch_id || '',
                        user_name: auditActor?.user_email || user?.email || 'System',
                        date: new Date().toLocaleDateString('id-ID'),
                        count: String(selectedDebtors.length),
                        reason: revisionNote,
                    },
                    fallbackSubject: 'Revision Requested – Batch {batch_id}',
                    fallbackBody: '<p>{user_name} has requested revision for {count} debtor(s) in batch {batch_id} on {date}.</p><p>Reason: {reason}</p>',
                }).catch(err => console.error("Background email failed:", err));
            } catch (emailError) {
                console.warn('Failed to send notification email:', emailError);
            }

            setSuccessMessage(
                `Revision requested for ${selectedDebtors.length} debtors`,
            );
            setRevisionDialogOpen(false);
            setRevisionNote("");
            setSelectedDebtors([]);
            await loadDebtors();
        } catch (error) {
            console.error("Failed to request revision:", error);
            setErrorMessage(`Failed to request revision: ${error.message}`);
        }
        setUploading(false);
    };

    // Calculate KPIs
    const kpis = {
        total,
        submitted: pageData.filter((d) => d.status === "SUBMITTED").length,
        checked_brins: pageData.filter((d) => d.status === "CHECKED_BRINS").length,
        approved_brins: pageData.filter((d) => d.status === "APPROVED_BRINS").length,
        approved: pageData.filter((d) => d.status === "APPROVED").length,
        revision: pageData.filter((d) => d.status === "REVISION").length,
    };

    // Table columns
    const columns = [
        {
            header: (
                <Checkbox
                    checked={
                        selectedDebtors.length === pageData.length &&
                        pageData.length > 0
                    }
                    onCheckedChange={(checked) => {
                        if (checked) {
                            setSelectedDebtors(
                                pageData.map((d) => d.id),
                            );
                        } else {
                            setSelectedDebtors([]);
                        }
                    }}
                />
            ),
            cell: (row) => (
                <Checkbox
                    checked={selectedDebtors.includes(row.id)}
                    onCheckedChange={(checked) => {
                        if (checked) {
                            setSelectedDebtors([...selectedDebtors, row.id]);
                        } else {
                            setSelectedDebtors(
                                selectedDebtors.filter((id) => id !== row.id),
                            );
                        }
                    }}
                />
            ),
            width: "50px",
        },
        {
            header: "Batch ID",
            accessorKey: "batch_id",
            cell: (row) => (
                <span className="font-mono text-xs">{row.batch_id}</span>
            ),
        },
        {
            header: "Nomor Peserta",
            accessorKey: "nomor_peserta",
            cell: (row) => (
                <div>
                    <div className="font-medium">{row.nomor_peserta}</div>
                    <div className="text-xs text-gray-500">
                        {row.nama_peserta}
                    </div>
                </div>
            ),
        },
        {
            header: "Loan Info",
            cell: (row) => (
                <div className="text-sm">
                    <div>{row.loan_type}</div>
                    <div className="text-xs text-gray-500">
                        {row.loan_type_desc}
                    </div>
                </div>
            ),
        },
        {
            header: "Plafon",
            accessorKey: "plafon",
            cell: (row) => (
                <div className="font-medium">
                    {formatRupiahAdaptive(row.plafon)}
                </div>
            ),
        },
        {
            header: "Net Premi",
            accessorKey: "net_premi",
            cell: (row) => (
                <div className="font-medium">
                    {formatRupiahAdaptive(row.net_premi)}
                </div>
            ),
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: (row) => <StatusBadge status={row.status} />,
        },
        {
            header: "action",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelectedDebtor(row);
                            setShowDetailDialog(true);
                        }}
                        title="View detail"
                    >
                        <Eye className="w-4 h-4" />
                    </Button>
                </div>
            ),
            width: "80px",
        },
    ];

    // Only include contracts that have been approved in the system
    const activeContracts = contracts.filter((c) => c.contract_status === "APPROVED");

    if (pageLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        // Header and Actions
        <div className="space-y-6">
            <PageHeader
                title="Submit Debtor"
                subtitle="Upload and manage debtor submissions for reinsurance coverage"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Submit Debtor" },
                ]}
                actions={
                    canShowActionButtons ? (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleRefresh}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleDownloadTemplate}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download Template
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setUploadDialogOpen(true)}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Debtors
                            </Button>
                        </div>
                    ) : 
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleRefresh}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                }
            />

            {/* Messages */}
            {successMessage && (
                <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                        {successMessage}
                    </AlertDescription>
                </Alert>
            )}

            {/* Gradient Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 justify-center items-center">
                <GradientStatCard
                    title="Total"
                    value={kpis.total}
                    subtitle="Total Debtors"
                    icon={Users}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title="Submitted"
                    value={kpis.submitted}
                    subtitle="Awaiting Check"
                    icon={FileText}
                    gradient="from-yellow-500 to-yellow-600"
                />
                <GradientStatCard
                    title="Checked"
                    value={kpis.checked_brins}
                    subtitle="Checked by BRINS"
                    icon={Check}
                    gradient="from-cyan-500 to-cyan-600"
                />
                <GradientStatCard
                    title="BRINS OK"
                    value={kpis.approved_brins}
                    subtitle="Approved by BRINS"
                    icon={ShieldCheck}
                    gradient="from-indigo-500 to-indigo-600"
                />
                <GradientStatCard
                    title="Approved"
                    value={kpis.approved}
                    subtitle="Fully Approved"
                    icon={CheckCircle2}
                    gradient="from-green-500 to-green-600"
                />
                <GradientStatCard
                    title="Revision"
                    value={kpis.revision}
                    subtitle="Needs Revision"
                    icon={AlertTriangle}
                    gradient="from-orange-500 to-orange-600"
                />
            </div>

            {/* Filters */}
            <FilterTab
                filters={filters}
                onFilterChange={setFilters}
                defaultFilters={defaultFilter}
                filterConfig={[
                    {
                        key: "contract",
                        label: "Contract",
                        options: [
                            { value: "all", label: "All Contracts" },
                            ...contracts.map((c) => ({
                                value: c.contract_id,
                                label: c.contract_id,
                            })),
                        ],
                    },
                    {
                        key: "batch",
                        label: "Batch ID",
                        placeholder: "Search Batch...",
                        type: "input",
                        inputType: "text",
                    },
                    {
                        key: "submitStatus",
                        label: "Underwriting Status",
                        options: [
                            { value: "all", label: "All Statuses" },
                            { value: "SUBMITTED", label: "Submitted" },
                            { value: "CHECKED_BRINS", label: "Checked (BRINS)" },
                            { value: "APPROVED_BRINS", label: "Approved (BRINS)" },
                            { value: "APPROVED", label: "Approved (Final)" },
                            { value: "REVISION", label: "Revision" },
                        ],
                    },
                    {
                        key: "name",
                        placeholder: "Search by name, nomor peserta, or batch",
                        label: "Search",
                        type: "input",
                    },
                ]}
            />

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
                {isCheckerBrins && selectedDebtors.length > 0 && (
                    <Button
                        variant="outline"
                        onClick={handleCheckerBrinsCheck}
                        disabled={uploading}
                    >
                        {uploading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4 mr-2" />
                        )}
                        Check ({selectedDebtors.length})
                    </Button>
                )}
                {isApproverBrins && selectedDebtors.length > 0 && (
                    <Button
                        variant="outline"
                        onClick={handleApproverBrinsApprove}
                        disabled={uploading}
                    >
                        {uploading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <ShieldCheck className="w-4 h-4 mr-2" />
                        )}
                        Approve ({selectedDebtors.length})
                    </Button>
                )}
            </div>

            {/* Data Table */}
            <div>
                <DataTable
                    columns={columns}
                    data={pageData}
                    isLoading={tableLoading}
                    emptyMessage="No debtors found. Upload your first batch to get started."
                    pagination={{ from, to, total, page, totalPages }}
                    onPageChange={(p) => setPage(p)}
                />
            </div>

            {/* Upload Dialog - Two Tabs */}
            <Dialog
                open={uploadDialogOpen}
                onOpenChange={(open) => {
                    setUploadDialogOpen(open);
                    if (!open) {
                        // Reset all upload dialog states
                        setErrorMessage("");
                        setUploadTabActive(1);
                        setUploadPreviewData([]);
                        setUploadFile(null);
                        setSelectedContract("");
                        setBatchMode("new");
                        setSelectedBatch("");
                    }
                }}
            >
                <DialogContent
                    className="max-w-4xl w-full"
                    style={{
                        maxHeight: "90vh",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}
                >
                    <DialogHeader className="shrink-0">
                        <DialogTitle>
                            {uploadTabActive === 1
                                ? "Upload Debtors"
                                : "Debtor Preview"}
                        </DialogTitle>
                        <DialogDescription>
                            {uploadTabActive === 1
                                ? "Upload CSV/XLS/XLSX file containing debtor information"
                                : "Periksa data sebelum disimpan ke database"}
                        </DialogDescription>

                        {/* Stepper */}
                        <div className="flex mt-3">
                            <div
                                className={`flex items-center gap-2 flex-1 pb-3 text-sm border-b-2 transition-all duration-300 ${
                                    uploadTabActive === 1
                                        ? "border-blue-600 text-blue-600 font-medium"
                                        : "border-green-600 text-green-600"
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                                        uploadTabActive === 1
                                            ? "bg-blue-600 text-white"
                                            : "bg-green-600 text-white"
                                    }`}
                                >
                                    {uploadTabActive === 1 ? "1" : "✓"}
                                </div>
                                Upload Debtors
                            </div>
                            <div
                                className={`flex items-center gap-2 flex-1 pb-3 text-sm border-b-2 transition-all duration-300 ${
                                    uploadTabActive === 2
                                        ? "border-blue-600 text-blue-600 font-medium"
                                        : "border-gray-200 text-gray-400"
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                                        uploadTabActive === 2
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 text-gray-500"
                                    }`}
                                >
                                    2
                                </div>
                                Debtor Preview
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="py-4 space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
                        {/* Tab 1: Upload */}
                        {uploadTabActive === 1 && (
                            <>
                                {errorMessage && (
                                    <Alert className="border-red-200 bg-red-50">
                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                        <AlertDescription className="text-red-800 space-y-2">
                                            <p className="font-medium">
                                                {uploadErrorView.summary}
                                            </p>
                                            {uploadErrorView.title && (
                                                <p className="text-sm">
                                                    {uploadErrorView.title}
                                                </p>
                                            )}
                                            {uploadErrorView.items.length > 0 && (
                                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                                    {uploadErrorView.items.map(
                                                        (item) => (
                                                            <li key={item}>
                                                                {item}
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div>
                                    <Label>Select Contract *</Label>
                                    <Select
                                        value={selectedContract}
                                        onValueChange={(val) => {
                                            setSelectedContract(val);
                                            // Reset batch when contract changes
                                            setSelectedBatch("");
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select contract" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {activeContracts.map((c) => (
                                                <SelectItem
                                                    key={c.contract_id}
                                                    value={c.contract_id}
                                                >
                                                    {c.contract_id} -
                                                    {c.contract_status}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Batch Mode *</Label>
                                    <Select
                                        value={batchMode}
                                        onValueChange={setBatchMode}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">
                                                New Batch
                                            </SelectItem>
                                            <SelectItem value="revise">
                                                Revise Existing Batch
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {batchMode === "revise" && (
                                    <div>
                                        <Label>
                                            Select Batch to Revise *
                                        </Label>
                                        <Select
                                            value={selectedBatch}
                                            onValueChange={setSelectedBatch}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select batch" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {batches
                                                    .filter((b) => {
                                                        if (!selectedContract)
                                                            return false;
                                                        if (
                                                            b.contract_id !==
                                                            selectedContract
                                                        )
                                                            return false;
                                                        // Check if this batch has debtors with REVISION status
                                                        const hasRevisionDebtors =
                                                            debtors.some(
                                                                (d) =>
                                                                    d.batch_id ===
                                                                        b.batch_id &&
                                                                    d.contract_id ===
                                                                        selectedContract &&
                                                                    d.status ===
                                                                        "REVISION",
                                                            );
                                                        return hasRevisionDebtors;
                                                    })
                                                    .map((b) => {
                                                        const revCount =
                                                            debtors.filter(
                                                                (d) =>
                                                                    d.batch_id ===
                                                                        b.batch_id &&
                                                                    d.contract_id ===
                                                                        selectedContract &&
                                                                    d.status ===
                                                                        "REVISION",
                                                            ).length;
                                                        return (
                                                            <SelectItem
                                                                key={
                                                                    b.batch_id
                                                                }
                                                                value={
                                                                    b.batch_id
                                                                }
                                                            >
                                                                {b.batch_id} —{" "}
                                                                {revCount}{" "}
                                                                debtor(s) need
                                                                revision
                                                            </SelectItem>
                                                        );
                                                    })}
                                            </SelectContent>
                                        </Select>
                                        {selectedContract &&
                                            batchMode === "revise" &&
                                            batches.filter(
                                                (b) =>
                                                    b.contract_id ===
                                                        selectedContract &&
                                                    debtors.some(
                                                        (d) =>
                                                            d.batch_id ===
                                                                b.batch_id &&
                                                            d.contract_id ===
                                                                selectedContract &&
                                                            d.status ===
                                                                "REVISION",
                                                    ),
                                            ).length === 0 && (
                                                <p className="text-sm text-red-600 mt-1">
                                                    No batches with REVISION
                                                    debtors found for this
                                                    contract.
                                                </p>
                                            )}
                                    </div>
                                )}

                                <div>
                                    <Label>Upload File *</Label>
                                    <Input
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            setUploadFile(file);
                                        }}
                                    />
                                    {uploadFile && (
                                        <p className="text-sm text-gray-600 mt-1">
                                            Selected: {uploadFile.name}
                                        </p>
                                    )}
                                </div>

                                <Alert>
                                    <FileSpreadsheet className="h-4 w-4" />
                                    <AlertDescription>
                                        Download the template first to see the
                                        required format. Make sure all required
                                        fields are filled.
                                    </AlertDescription>
                                </Alert>

                                {batchMode === "revise" && (
                                    <Alert className="border-orange-200 bg-orange-50">
                                        <AlertCircle className="h-4 w-4 text-orange-600" />
                                        <AlertDescription className="text-orange-800">
                                            <strong>Revise Mode:</strong> The
                                            upload file must only contain debtors
                                            that were marked for REVISION. Each
                                            debtor's{" "}
                                            <code className="font-mono text-xs bg-orange-100 px-1 rounded">
                                                nomor_peserta
                                            </code>{" "}
                                            must match a REVISION debtor in the
                                            selected batch. Old REVISION data
                                            will be moved to ReviseLog after
                                            upload.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </>
                        )}

                        {/* Tab 2: Preview */}
                        {uploadTabActive === 2 && (
                            <>
                                <div className="flex gap-3 flex-wrap">
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">
                                            Total Rows
                                        </p>
                                        <p className="text-xl font-medium">
                                            {uploadPreviewData.length}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">
                                            Mode
                                        </p>
                                        <p className="text-sm font-medium mt-1">
                                            {batchMode === "new"
                                                ? "New Batch"
                                                : "Revise"}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">
                                            Contract
                                        </p>
                                        <p className="text-sm font-medium mt-1">
                                            {selectedContract || "-"}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">
                                            File
                                        </p>
                                        <p className="text-sm font-medium mt-1">
                                            {uploadFile?.name || "-"}
                                        </p>
                                    </div>
                                </div>

                                <Alert className="bg-blue-50 border-blue-200">
                                    <AlertCircle className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-700">
                                        Below is a preview of the data that will
                                        be saved. Please review it before
                                        confirming.
                                    </AlertDescription>
                                </Alert>

                                {uploadPreviewLoading && (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                                        <span className="text-sm text-gray-600">
                                            Generating preview...
                                        </span>
                                    </div>
                                )}

                                {!uploadPreviewLoading && (
                                    <div
                                        style={{
                                            overflowX: "auto",
                                            overflowY: "auto",
                                            maxHeight: "500px",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "8px",
                                            width: "100%",
                                        }}
                                    >
                                        <table
                                            className="text-xs"
                                            style={{
                                                minWidth: "max-content",
                                                borderCollapse: "collapse",
                                            }}
                                        >
                                            <thead className="bg-gray-50 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b border-r border-gray-200 whitespace-nowrap bg-gray-100 min-w-fit">
                                                        #
                                                    </th>
                                                    {getPreviewColumnKeys().map(
                                                        (key) => (
                                                            <th
                                                                key={key}
                                                                className="px-4 py-2 text-left font-medium text-gray-700 border-b border-r border-gray-200 whitespace-nowrap bg-gray-100 min-w-fit"
                                                            >
                                                                {formatHeaderName(
                                                                    key,
                                                                )}
                                                            </th>
                                                        ),
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {uploadPreviewData.map(
                                                    (row, rowIndex) => (
                                                        <tr
                                                            key={rowIndex}
                                                            className={
                                                                rowIndex % 2 ===
                                                                0
                                                                    ? "bg-white"
                                                                    : "bg-gray-50"
                                                            }
                                                        >
                                                            <td className="px-4 py-2 border-r border-gray-200 text-gray-900 text-center font-medium min-w-fit">
                                                                {rowIndex + 1}
                                                            </td>
                                                            {getPreviewColumnKeys().map(
                                                                (key) => (
                                                                    <td
                                                                        key={`${rowIndex}-${key}`}
                                                                        className="px-4 py-2 border-r border-gray-200 text-gray-900 whitespace-nowrap min-w-fit"
                                                                        title={String(
                                                                            row[
                                                                                key
                                                                            ] ||
                                                                                "-"
                                                                        )}
                                                                    >
                                                                        {formatCellValue(
                                                                            key,
                                                                            row[
                                                                                key
                                                                            ],
                                                                        )}
                                                                    </td>
                                                                ),
                                                            )}
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {canShowActionButtons && (
                        <DialogFooter className="shrink-0 border-t pt-4">
                            {uploadTabActive === 1 && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setUploadDialogOpen(false)
                                        }
                                        disabled={uploadPreviewLoading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handlePreviewData}
                                        disabled={uploadPreviewLoading}
                                    >
                                        {uploadPreviewLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-4 h-4 mr-2" />
                                                Preview Data
                                            </>
                                        )}
                                    </Button>
                                </>
                            )}
                            {uploadTabActive === 2 && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setUploadTabActive(1);
                                            setErrorMessage("");
                                        }}
                                        disabled={uploading}
                                    >
                                        <ChevronLeft className="w-4 h-4 mr-2" />
                                        Back to Upload
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setUploadDialogOpen(false)
                                        }
                                        disabled={uploading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleConfirmSave}
                                        disabled={uploading}
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4 mr-2" />
                                                Confirm Upload
                                            </>
                                        )}
                                    </Button>
                                </>
                            )}
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Debtor Details</DialogTitle>
                        <DialogDescription>
                            {selectedDebtor?.nama_peserta || selectedDebtor?.debtor_name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">
                                    Nomor Peserta:
                                </span>
                                <p className="font-medium">
                                    {selectedDebtor?.nomor_peserta}
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-500">Batch ID:</span>
                                <p className="font-medium">
                                    {selectedDebtor?.batch_id}
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-500">Plafon:</span>
                                <p className="font-medium">
                                    {formatRupiahAdaptive(
                                        selectedDebtor?.plafon,
                                    )}
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-500">
                                    Net Premi:
                                </span>
                                <p className="font-medium">
                                    {formatRupiahAdaptive(
                                        selectedDebtor?.net_premi,
                                    )}
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-500">Status:</span>
                                <StatusBadge status={selectedDebtor?.status} />
                            </div>
                            {selectedDebtor?.validation_remarks && (
                                <div className="col-span-2 p-3 bg-orange-50 border border-orange-200 rounded">
                                    <p className="text-sm font-medium text-orange-700">
                                        Validation Remarks:
                                    </p>
                                    <p className="text-sm text-orange-600">
                                        {selectedDebtor.validation_remarks}
                                    </p>
                                </div>
                            )}
                            {selectedDebtor?.version_no && (
                                <div>
                                    <span className="text-gray-500">
                                        Version No:
                                    </span>
                                    <p className="font-medium">
                                        {selectedDebtor.version_no}
                                    </p>
                                </div>
                            )}
                        </div>
                        {/* Revision Diffs Section */}
                        {(selectedDebtor?.version_no || 0) > 1 && revisionDiffs && revisionDiffs.length > 0 && (
                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <History className="w-5 h-5 text-blue-600" />
                                    <h3 className="font-semibold text-blue-900">Revision Changes</h3>
                                </div>
                                <div className="space-y-2">
                                    {revisionDiffs.slice(0, 15).map((diff, idx) => (
                                        <div key={idx} className="flex items-start gap-3 text-sm">
                                            <span className="font-mono text-xs bg-white px-2 py-1 rounded text-gray-700 flex-shrink-0 min-w-32">
                                                {diff.key}
                                            </span>
                                            <div className="flex-1">
                                                <p className="text-red-600 line-through text-xs">Old: {diff.old}</p>
                                                <p className="text-green-600 text-xs">New: {diff.new}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {revisionDiffs.length > 15 && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            ...and {revisionDiffs.length - 15} more changes
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowDetailDialog(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Revision Dialog */}
            <Dialog
                open={revisionDialogOpen}
                onOpenChange={setRevisionDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Revision</DialogTitle>
                        <DialogDescription>
                            Request revision for {selectedDebtors.length}{" "}
                            selected debtor(s)
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Revision Note *</Label>
                            <Textarea
                                placeholder="Explain what needs to be revised..."
                                value={revisionNote}
                                onChange={(e) =>
                                    setRevisionNote(e.target.value)
                                }
                                rows={4}
                            />
                        </div>
                    </div>

                    {canShowActionButtons && (
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setRevisionDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleRequestRevision}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Request Revision
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Action Note</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label>Note from TUGURE:</Label>
                        <div className="p-4 bg-gray-50 rounded-lg border">
                            <p className="text-sm text-gray-700">
                                {actionNote}
                            </p>
                        </div>
                    </div>

                    {canShowActionButtons && (
                        <DialogFooter>
                            <Button onClick={() => setNoteDialogOpen(false)}>
                                Close
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
