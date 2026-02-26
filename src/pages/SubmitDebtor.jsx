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
} from "lucide-react";
import { toast } from "sonner";
import {
    createAuditLog,
    sendTemplatedEmail,
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
    ric_325: "ric_amount",
    ric_32_5: "ric_amount",
    bf_25: "bf_amount",
    bf_2_5: "bf_amount",
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

export default function SubmitDebtor() {
    const [user, setUser] = useState(null);
    const [auditActor, setAuditActor] = useState(null);
    const [userRoles, setUserRoles] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [totalDebtors, setTotalDebtors] = useState(0);
    const [loading, setLoading] = useState(true);

    // Form state
    const [selectedContract, setSelectedContract] = useState("");
    const [batchMode, setBatchMode] = useState("new"); // 'new' or 'revise'
    const [selectedBatch, setSelectedBatch] = useState("");
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Dialog state
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [selectedDebtors, setSelectedDebtors] = useState([]);
    const [revisionNote, setRevisionNote] = useState("");
    const [actionNote, setActionNote] = useState("");

    // Message state
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const [filters, setFilters] = useState(defaultFilter);
    const [page, setPage] = useState(1);
    const isFirstPageEffect = useRef(true);
    const canShowActionButtons = userRoles.some((role) => {
        const normalizedRole = String(role || "").trim().toLowerCase();
        return (
            normalizedRole === "maker-brins-role" ||
            normalizedRole === "checker-brins-role"
        );
    });

    const isCheckerBrins = userRoles.some(
        (role) => String(role || "").trim().toLowerCase() === "checker-brins-role",
    );
    const isApproverBrins = userRoles.some(
        (role) => String(role || "").trim().toLowerCase() === "approver-brins-role",
    );

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
        setLoading(true);
        setSuccessMessage("");
        setErrorMessage("");

        try {
            await Promise.all([loadContracts(), loadBatches()]);
        } catch (error) {
            console.error("Failed to load data:", error);
            setErrorMessage("Failed to load data. Please refresh the page.");
        } finally {
            setLoading(false);
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
        setLoading(true);
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
            setLoading(false);
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
        const sampleData = [
            "1001,PRG-001,LA-001,P-001,KPR,Kredit Pemilikan Rumah,CIF-001,New,Full,2025-01-01,2030-12-31,500000000,4750000,1.0,0.1,0.05,3875000,U001,Unit Jakarta,Branch Sudirman,DKI Jakarta,PT Maju Jaya,Jl. Sudirman No.1 Jakarta,CA-001,2025-01-15 10:00:00,2025-01-16 14:00:00,1,Approved,0,1,POL-001",
            "1002,PRG-001,LA-002,P-002,KPR,Kredit Pemilikan Rumah,CIF-002,New,Full,2025-01-01,2030-12-31,300000000,2850000,1.0,0.1,0.05,2325000,U001,Unit Jakarta,Branch Sudirman,DKI Jakarta,CV Berkah Abadi,Jl. Thamrin No.2 Jakarta,CA-002,2025-01-15 11:00:00,2025-01-16 15:00:00,1,Approved,0,1,POL-002",
            "1003,PRG-001,LA-003,P-003,KPR,Kredit Pemilikan Rumah,CIF-003,New,Full,2025-01-01,2030-12-31,450000000,4275000,1.0,0.1,0.05,3487500,U001,Unit Jakarta,Branch Sudirman,DKI Jakarta,PT Cahaya Terang,Jl. Gatot Subroto No.3,CA-003,2025-01-15 12:00:00,2025-01-16 16:00:00,1,Good,0,1,POL-003",
            "1004,PRG-001,LA-004,P-004,KPR,Kredit Pemilikan Rumah,CIF-004,New,Full,2025-01-01,2030-12-31,350000000,3325000,1.0,0.1,0.05,2712500,U001,Unit Jakarta,Branch Sudirman,DKI Jakarta,UD Sumber Rezeki,Jl. Rasuna Said No.4,CA-004,2025-01-15 13:00:00,2025-01-16 17:00:00,1,Verified,0,1,POL-004",
            "1005,PRG-001,LA-005,P-005,KPR,Kredit Pemilikan Rumah,CIF-005,New,Full,2025-01-01,2030-12-31,400000000,3800000,1.0,0.1,0.05,3100000,U001,Unit Jakarta,Branch Sudirman,DKI Jakarta,CV Mitra Sejati,Jl. HR Rasuna No.5,CA-005,2025-01-15 14:00:00,2025-01-16 18:00:00,1,Complete,0,1,POL-005",
        ];

        const headers = [
            "cover_id",
            "program_id",
            "nomor_rekening_pinjaman",
            "nomor_peserta",
            "loan_type",
            "loan_type_desc",
            "cif_rekening_pinjaman",
            "jenis_pengajuan_desc",
            "jenis_covering_desc",
            "tanggal_mulai_covering",
            "tanggal_akhir_covering",
            "plafon",
            "nominal_premi",
            "premi_percentage",
            "ric_percentage",
            "bf_percentage",
            "net_premi",
            "unit_code",
            "unit_desc",
            "branch_desc",
            "region_desc",
            "nama_peserta",
            "alamat_usaha",
            "nomor_perjanjian_kredit",
            "tanggal_terima",
            "tanggal_validasi",
            "status_aktif",
            "remark_premi",
            "flag_restruktur",
            "kolektabilitas",
            "policy_no",
        ];

        const csvContent = headers.join(",") + "\n" + sampleData.join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "debtor_template.csv";
        a.click();
        toast.success("Template downloaded");
    };

    // Submit bulk upload
    const handleBulkUpload = async () => {
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

        // === REVISION VALIDATION ===
        // When revising, validate that the selected contract+batch has REVISION debtors
        if (batchMode === "revise") {
            const revisionDebtorsInBatch = debtors.filter(
                (d) =>
                    d.batch_id === selectedBatch &&
                    d.contract_id === selectedContract &&
                    d.status === "REVISION",
            );

            if (revisionDebtorsInBatch.length === 0) {
                const revisionMessage =
                    `No debtors with status REVISION found in batch ${selectedBatch} for contract ${selectedContract}. ` +
                    `Please ensure the contract and batch match the debtor(s) that were marked for revision.`;
                setErrorMessage(revisionMessage);
                toast.error(revisionMessage);
                return;
            }
        }

        setUploading(true);
        setErrorMessage("");
        setSuccessMessage("");

        let uploaded = 0;
        const createdDebtorIds = [];
        let batchId = null;
        let borderoId = null;

        try {
            const rows = await parseUploadRows(uploadFile);

            if (rows.parseErrors?.length > 0) {
                const firstParseError = rows.parseErrors[0];
                const parseMessage = `Invalid CSV format${firstParseError?.row ? ` on row ${firstParseError.row}` : ""}: ${firstParseError?.message || "Unable to parse the uploaded file."}`;
                setErrorMessage(parseMessage);
                toast.error(parseMessage);
                setUploading(false);
                return;
            }

            let normalizedRows = Array.isArray(rows.rows) ? rows.rows : [];

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
                setUploading(false);
                return;
            }

            if (!normalizedRows || normalizedRows.length === 0) {
                setErrorMessage("File is empty or invalid format");
                toast.error("File is empty or invalid format");
                setUploading(false);
                return;
            }

            // === REVISION MODE: Validate nomor_peserta matches REVISION debtors ===
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
                    const nomorPeserta = toNullableString(normalizedRows[i].nomor_peserta);
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
                    setUploading(false);
                    return;
                }
            }

            // Generate batch ID
            if (batchMode === "revise") {
                batchId = selectedBatch;
            } else {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, "0");
                const randomNum = Math.floor(Math.random() * 900000) + 100000;
                batchId = `BATCH-${year}-${month}-${randomNum}`;
            }

            // Calculate batch totals
            const totalExposure = normalizedRows.reduce(
                (sum, row) => Number(sum) + (toNumber(row.plafon) || 0),
                0,
            );
            const totalPremium = normalizedRows.reduce(
                (sum, row) => Number(sum) + (toNumber(row.nominal_premi) || 0),
                0,
            );

            // Create or update batch
            let period = null;

            if (batchMode === "new") {
                await backend.create("Batch", {
                    batch_id: batchId,
                    batch_month: new Date().getMonth() + 1,
                    batch_year: new Date().getFullYear(),
                    contract_id: selectedContract,
                    total_records: normalizedRows.length,
                    total_exposure: totalExposure,
                    total_premium: totalPremium,
                    status: "Uploaded",
                });

                // Create Bordero first so debtors can reference it
                const now = new Date();
                period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                borderoId = `BRD-${batchId.replace("BATCH-", "")}`;

                await backend.create("Bordero", {
                    bordero_id: borderoId,
                    contract_id: selectedContract,
                    batch_id: batchId,
                    period: period,
                    total_debtors: 0,
                    total_exposure: 0,
                    total_premium: 0,
                    currency: "IDR",
                    status: "GENERATED",
                });
            } else {
                // Revision mode: find existing Bordero for this batch+contract
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
                    setUploading(false);
                    return;
                }

                borderoId = match.bordero_id;
                period = match.period || null;
            }

            // Create debtors
            for (let i = 0; i < normalizedRows.length; i++) {
                try {
                    const row = normalizedRows[i];

                    const nomorPeserta = toNullableString(row.nomor_peserta);
                    const namaPeserta = toNullableString(row.nama_peserta);

                    if (!nomorPeserta || !namaPeserta) {
                        throw new Error(
                            `Row ${i + 2}: nomor_peserta and nama_peserta are required`,
                        );
                    }

                    const payload = {
                        cover_id: toNullableString(row.cover_id),
                        program_id: toNullableString(row.program_id),
                        bordero_id: borderoId,
                        nomor_rekening_pinjaman: toNullableString(
                            row.nomor_rekening_pinjaman,
                        ),
                        nomor_peserta: nomorPeserta,
                        loan_type: toNullableString(row.loan_type),
                        loan_type_desc: toNullableString(row.loan_type_desc),
                        cif_rekening_pinjaman: toNullableString(
                            row.cif_rekening_pinjaman,
                        ),
                        jenis_pengajuan_desc: toNullableString(
                            row.jenis_pengajuan_desc,
                        ),
                        jenis_covering_desc: toNullableString(
                            row.jenis_covering_desc,
                        ),
                        tanggal_mulai_covering: toIsoDate(
                            row.tanggal_mulai_covering,
                        ),
                        tanggal_akhir_covering: toIsoDate(
                            row.tanggal_akhir_covering,
                        ),
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
                        nomor_perjanjian_kredit: toNullableString(
                            row.nomor_perjanjian_kredit,
                        ),
                        tanggal_terima: toIsoDate(row.tanggal_terima),
                        tanggal_validasi: toIsoDate(row.tanggal_validasi),
                        teller_premium_date: toIsoDate(row.teller_premium_date),
                        status_aktif: toInteger(row.status_aktif),
                        remark_premi: toNullableString(row.remark_premi),
                        flag_restruk: toInteger(
                            row.flag_restruk ?? row.flag_restruktur,
                        ),
                        kolektabilitas: toInteger(row.kolektabilitas),
                        policy_no: toNullableString(row.policy_no),
                        contract_id: selectedContract,
                        batch_id: batchId,
                        version_no: 1,
                        status: "SUBMITTED",
                        is_locked: false,
                    };

                    const createdDebtor = await backend.create("Debtor", payload);
                    if (createdDebtor?.id) {
                        createdDebtorIds.push(createdDebtor.id);
                    }
                    uploaded++;
                } catch (rowError) {
                    const rowMessage = rowError?.message || "Unknown upload error";
                    if (/^Row\s+\d+:/i.test(rowMessage)) {
                        throw new Error(rowMessage);
                    }
                    throw new Error(`Row ${i + 2}: ${rowMessage}`);
                }
            }

            // Update Bordero totals after debtor creation
            if (borderoId) {
                try {
                    await backend.update("Bordero", borderoId, {
                        total_debtors: uploaded,
                        total_exposure: totalExposure,
                        total_premium: totalPremium,
                    });
                } catch (borderoError) {
                    console.error("Failed to update Bordero:", borderoError);
                }
            }

            // Create audit log
            try {
                await backend.create("AuditLog", {
                    action:
                        batchMode === "new" ? "BULK_UPLOAD" : "BULK_REVISION",
                    module: "DEBTOR",
                    entity_type: "Debtor",
                    entity_id: batchId,
                    old_value: "",
                    new_value: JSON.stringify({ count: normalizedRows.length }),
                    user_email: auditActor?.user_email || user?.email,
                    user_role: auditActor?.user_role || user?.role,
                    reason: `Uploaded ${normalizedRows.length} debtors to batch ${batchId}`,
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            // === REVISION MODE: Move old REVISION debtors to ReviseLog and delete from Debtor ===
            if (batchMode === "revise" && uploaded > 0) {
                const revisionDebtorsInBatch = debtors.filter(
                    (d) =>
                        d.batch_id === selectedBatch &&
                        d.contract_id === selectedContract &&
                        d.status === "REVISION",
                );

                // Get the nomor_peserta of newly uploaded debtors
                const uploadedNomorPeserta = new Set(
                    normalizedRows
                        .map((r) => toNullableString(r.nomor_peserta))
                        .filter(Boolean),
                );

                for (const oldDebtor of revisionDebtorsInBatch) {
                    // Only move if the CSV had a matching nomor_peserta
                    if (!uploadedNomorPeserta.has(oldDebtor.nomor_peserta))
                        continue;

                    try {
                        // 1. Create ReviseLog entry (save old data)
                        await backend.create("ReviseLog", {
                            debtor_id: oldDebtor.id,
                            batch_id: oldDebtor.batch_id,
                            nomor_peserta: oldDebtor.nomor_peserta,
                            nama_peserta: oldDebtor.nama_peserta,
                            alamat_usaha: oldDebtor.alamat_usaha || null,
                            nomor_perjanjian_kredit:
                                oldDebtor.nomor_perjanjian_kredit || null,
                            plafon: parseFloat(oldDebtor.plafon) || null,
                            nominal_premi:
                                parseFloat(oldDebtor.nominal_premi) || null,
                            contract_id: oldDebtor.contract_id || null,
                            status: oldDebtor.status,
                            revision_reason:
                                oldDebtor.revision_reason ||
                                oldDebtor.validation_remarks ||
                                null,
                            created_by: user?.email || null,
                        });

                        // 2. Delete old REVISION debtor from Debtor table
                        await backend.update("Debtor", oldDebtor.id, {
                            status: "ARCHIVED_REVISION",
                        });

                        // Try to delete, fall back to status update if delete not supported
                        try {
                            await backend.delete("Debtor", oldDebtor.id);
                        } catch (deleteErr) {
                            console.warn(
                                `Delete failed for debtor ${oldDebtor.id}:`,
                                deleteErr,
                            );
                        }
                    } catch (reviseError) {
                        console.error(
                            `Failed to move debtor ${oldDebtor.id} to ReviseLog:`,
                            reviseError,
                        );
                    }
                }

                // Create audit log for revision move
                try {
                    await backend.create("AuditLog", {
                        action: "REVISION_DEBTORS_ARCHIVED",
                        module: "DEBTOR",
                        entity_type: "ReviseLog",
                        entity_id: batchId,
                        old_value: JSON.stringify({
                            revision_count: revisionDebtorsInBatch.length,
                        }),
                        new_value: JSON.stringify({
                            moved_to_revise_log: revisionDebtorsInBatch.length,
                            new_submitted: uploaded,
                        }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason: `Moved ${revisionDebtorsInBatch.length} REVISION debtors to ReviseLog and replaced with ${uploaded} new SUBMITTED debtors`,
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
            }

            // Create notification
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

            if (batchMode === "revise") {
                setSuccessMessage(
                    `Successfully uploaded ${uploaded} revised debtor(s) to batch ${batchId}. Old REVISION data has been moved to ReviseLog.`,
                );
                toast.success(`Successfully uploaded ${uploaded} revised debtor(s).`);
            } else {
                setSuccessMessage(
                    `Successfully uploaded ${uploaded} debtors to batch ${batchId}`,
                );
                toast.success(`Successfully uploaded ${uploaded} debtors.`);
            }

            setUploadDialogOpen(false);
            setUploadFile(null);
            setSelectedContract("");
            setBatchMode("new");
            setSelectedBatch("");

            // Reload data
            await loadBatches();
            await loadDebtors();
        } catch (error) {
            console.error("Upload error:", error);

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

            if (batchMode === "new") {
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
    ];

    // Only include contracts that have been approved in the system
    const activeContracts = contracts.filter((c) => c.contract_status === "APPROVED");

    if (loading) {
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
                    ) : null
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
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 justify-center items-center">
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
                    isLoading={loading}
                    emptyMessage="No debtors found. Upload your first batch to get started."
                    pagination={{ from, to, total, page, totalPages }}
                    onPageChange={(p) => setPage(p)}
                />
            </div>

            {/* Upload Dialog */}
            <Dialog
                open={uploadDialogOpen}
                onOpenChange={(open) => {
                    setUploadDialogOpen(open);
                    if (!open) {
                        setErrorMessage("");
                    }
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Upload Debtors</DialogTitle>
                        <DialogDescription>
                            Upload a CSV/XLS/XLSX file containing debtor information
                        </DialogDescription>
                    </DialogHeader>

                    {errorMessage && (
                        <Alert className="border-red-200 bg-red-50">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800 space-y-2">
                                <p className="font-medium">{uploadErrorView.summary}</p>
                                {uploadErrorView.title && (
                                    <p className="text-sm">{uploadErrorView.title}</p>
                                )}
                                {uploadErrorView.items.length > 0 && (
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        {uploadErrorView.items.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-4">
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
                                            {c.contract_id} - {c.contract_status}
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
                                <Label>Select Batch to Revise *</Label>
                                <Select
                                    value={selectedBatch}
                                    onValueChange={setSelectedBatch}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select batch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* Only show batches for the selected contract that have REVISION debtors */}
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
                                                const revCount = debtors.filter(
                                                    (d) =>
                                                        d.batch_id ===
                                                            b.batch_id &&
                                                        d.contract_id ===
                                                            selectedContract &&
                                                        d.status === "REVISION",
                                                ).length;
                                                return (
                                                    <SelectItem
                                                        key={b.batch_id}
                                                        value={b.batch_id}
                                                    >
                                                        {b.batch_id} —{" "}
                                                        {revCount} debtor(s)
                                                        need revision
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
                                                    d.batch_id === b.batch_id &&
                                                    d.contract_id ===
                                                        selectedContract &&
                                                    d.status === "REVISION",
                                            ),
                                    ).length === 0 && (
                                        <p className="text-sm text-red-600 mt-1">
                                            No batches with REVISION debtors
                                            found for this contract.
                                        </p>
                                    )}
                            </div>
                        )}

                        <div>
                            <Label>Upload File *</Label>
                            <Input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={(e) =>
                                    setUploadFile(e.target.files?.[0])
                                }
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
                                Download the template first to see the required
                                format. Make sure all required fields are
                                filled.
                            </AlertDescription>
                        </Alert>

                        {batchMode === "revise" && (
                            <Alert className="border-orange-200 bg-orange-50">
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                                <AlertDescription className="text-orange-800">
                                    <strong>Revise Mode:</strong> The upload
                                    file must only contain debtors that were
                                    marked for REVISION. Each debtor's{" "}
                                    <code className="font-mono text-xs bg-orange-100 px-1 rounded">
                                        nomor_peserta
                                    </code>{" "}
                                    must match a REVISION debtor in the selected
                                    batch. Old REVISION data will be moved to
                                    ReviseLog after upload.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {canShowActionButtons && (
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setUploadDialogOpen(false)}
                                disabled={uploading}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleBulkUpload} disabled={uploading}>
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    )}
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
