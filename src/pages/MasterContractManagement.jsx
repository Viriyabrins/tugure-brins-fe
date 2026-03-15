import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    FileText,
    Upload,
    RefreshCw,
    CheckCircle2,
    Clock,
    Download,
    History,
    AlertCircle,
    Pen,
    Check,
    Eye,
    ShieldCheck,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import { formatRupiahAdaptive } from "@/utils/currency";
import { sendNotificationEmail } from "@/components/utils/emailTemplateHelper";
import FilterTab from "@/components/common/FilterTab";
import { Checkbox } from "@/components/ui/checkbox";

const defaultFilter = {
    status: "all",
    contractId: "",
    productType: "all",
    creditType: "all",
    startDate: "",
    endDate: "",
};

const normalizeRole = (role = "") => String(role).trim().toLowerCase();
const ALL_ROLE_NAMES = [
    "maker-brins-role",
    "checker-brins-role",
    "approver-brins-role",
    "checker-tugure-role",
    "approver-tugure-role",
];
const TUGURE_ACTION_ROLES = ["checker-tugure-role", "approver-tugure-role"];
const BRINS_UPLOAD_ROLES = ["maker-brins-role", "checker-brins-role"];
const hasTugureActionRole = (roles = []) =>
    (Array.isArray(roles) ? roles : [])
        .map(normalizeRole)
        .some((role) => TUGURE_ACTION_ROLES.includes(role));
const hasBrinsUploadRole = (roles = []) =>
    (Array.isArray(roles) ? roles : [])
        .map(normalizeRole)
        .some((role) => BRINS_UPLOAD_ROLES.includes(role));
const normalizeStatus = (status = "") => String(status).trim().toUpperCase();

const extractBaseContractNo = (cn = "") => {
    if (!cn) return "";
    const m = String(cn).match(/^(.*?)(?:_V\d+_.*)?$/i);
    return m ? m[1] : String(cn);
};

export default function MasterContractManagement() {
    const [user, setUser] = useState(null);
    const [tokenRoles, setTokenRoles] = useState([]);
    const [auditActor, setAuditActor] = useState(null);
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [showVersionDialog, setShowVersionDialog] = useState(false);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [uploadMode, setUploadMode] = useState("new"); // 'new' or 'revise'
    const [selectedContractForRevision, setSelectedContractForRevision] =
        useState("");
    const [actionType, setActionType] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [filters, setFilters] = useState(defaultFilter);
    const [selectedContract, setSelectedContract] = useState(null);
    const [selectedContractIds, setSelectedContractIds] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [approvalAction, setApprovalAction] = useState("");
    const [approvalRemarks, setApprovalRemarks] = useState("");
    const [uploadFile, setUploadFile] = useState(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [revisionDiffs, setRevisionDiffs] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [statsContracts, setStatsContracts] = useState([]); // full list for stat cards only
    const [uploadPreviewData, setUploadPreviewData] = useState([]);
    const [uploadTabActive, setUploadTabActive] = useState(1); // 1 = upload, 2 = preview
    const [previewValidationError, setPreviewValidationError] =
        useState("");
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canManageUploadTemplate = hasBrinsUploadRole(tokenRoles);

    // Per-role booleans for multi-step approval
    const normalizedRoles = (Array.isArray(tokenRoles) ? tokenRoles : []).map(
        normalizeRole,
    );
    const isCheckerBrins = normalizedRoles.includes("checker-brins-role");
    const isApproverBrins = normalizedRoles.includes("approver-brins-role");
    const isCheckerTugure = normalizedRoles.includes("checker-tugure-role");
    const isApproverTugure = normalizedRoles.includes("approver-tugure-role");

    const isFirstPageEffect = useRef(true);

    useEffect(() => {
        loadUser();
        loadStats();
        loadData(1, filters);
    }, []);

    // Reset page when filters change
    useEffect(() => {
        setSelectedContractIds([]);
        if (page !== 1) {
            setPage(1);
            return;
        }
        loadData(1, filters);
    }, [
        filters.status,
        filters.contractId,
        filters.productType,
        filters.creditType,
        filters.startDate,
        filters.endDate,
    ]);

    // Reload when page changes
    useEffect(() => {
        if (isFirstPageEffect.current) {
            isFirstPageEffect.current = false;
            return;
        }
        setSelectedContractIds([]);
        loadData(page, filters);
    }, [page]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages]);

    // When opening detail dialog for a revisioned contract (version >= 2),
    // fetch the latest archived ContractRevise entry and compute field diffs.
    useEffect(() => {
        let mounted = true;
        const fetchPrevRevision = async () => {
            if (!showDetailDialog || !selectedContract) {
                if (mounted) setRevisionDiffs([]);
                return;
            }
            const ver = Number(selectedContract.version) || 0;
            if (ver < 2) {
                if (mounted) setRevisionDiffs([]);
                return;
            }

            const base = extractBaseContractNo(
                selectedContract.contract_no || selectedContract.contract_no_from || ''
            );

            try {
                const res = await backend.listPaginated('ContractRevise', {
                    page: 1,
                    limit: 1,
                    q: JSON.stringify({ contractId: base }),
                });
                const prev = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;
                if (!prev) {
                    if (mounted) setRevisionDiffs([]);
                    return;
                }

                const diffs = [];
                const keys = Object.keys(selectedContract || {}).filter((k) => k !== 'id');
                for (const k of keys) {
                    const oldVal = prev[k];
                    const newVal = selectedContract[k];
                    const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal);
                    const newStr = newVal === null || newVal === undefined ? '' : String(newVal);
                    if (oldStr !== newStr) {
                        diffs.push({ key: k, old: oldStr || '-', new: newStr || '-' });
                    }
                }
                if (mounted) setRevisionDiffs(diffs);
            } catch (e) {
                console.error('Failed to load previous revision:', e);
                if (mounted) setRevisionDiffs([]);
            }
        };
        fetchPrevRevision();
        return () => {
            mounted = false;
        };
    }, [showDetailDialog, selectedContract]);

    const loadUser = async () => {
        try {
            const { default: keycloakService } =
                await import("@/services/keycloakService");
            const userInfo = keycloakService.getCurrentUserInfo();
            if (userInfo) {
                const roles = keycloakService.getRoles();
                const actor = keycloakService.getAuditActor();
                setAuditActor(actor);
                setTokenRoles(Array.isArray(roles) ? roles : []);
                const role =
                    actor?.user_role ||
                    (Array.isArray(roles) && roles.length > 0
                        ? normalizeRole(roles[0])
                        : "user");
                setUser({
                    id: userInfo.id,
                    email: userInfo.email,
                    full_name: userInfo.name,
                    role,
                });
            }
        } catch (error) {
            console.error("Failed to load user:", error);
        }
    };

    const loadData = async (pageToLoad = page, activeFilters = filters) => {
        setLoading(true);
        try {
            const query = { page: pageToLoad, limit: pageSize };
            if (activeFilters) {
                query.q = JSON.stringify(activeFilters);
            }
            const isRevisionFilter =
                normalizeStatus(activeFilters?.status || "") === "REVISION";
            const entityName = isRevisionFilter
                ? "ContractRevise"
                : "MasterContract";
            const result = await backend.listPaginated(entityName, query);
            setContracts(Array.isArray(result.data) ? result.data : []);
            setTotal(Number(result.pagination?.total) || 0);
        } catch (error) {
            console.error("Failed to load contracts:", error);
            setContracts([]);
            setTotal(0);
        }
        setLoading(false);
    };

    /** Load full list once for stat cards only (Total / Active / Pending / Draft). */
    const loadStats = async () => {
        try {
            const result = await backend.listPaginated("MasterContract", {
                page: 1,
                limit: 0,
            });
            setStatsContracts(Array.isArray(result.data) ? result.data : []);
        } catch (error) {
            console.error("Failed to load stats:", error);
            setStatsContracts([]);
        }
    };

    const handleDownloadTemplate = () => {
        const csv = [
            [
                "contract_id",
                "policy_no",
                "program_id",
                "product_type",
                "credit_type",
                "loan_type",
                "loan_type_desc",
                "coverage_start_date",
                "coverage_end_date",
                "max_tenor_month",
                "max_plafond",
                "share_tugure_percentage",
                "premium_rate",
                "ric_rate",
                "bf_rate",
                "allowed_kolektabilitas",
                "allowed_region",
                "currency",
                "remark",
            ].join(","),
            [
                "MC-001",
                "POL-2025-001",
                "PRG-001",
                "Treaty",
                "Individual",
                "KPR",
                "Kredit Pemilikan Rumah",
                "2025-01-01",
                "2030-12-31",
                "240",
                "1000000000",
                "75",
                "1.0",
                "0.1",
                "0.05",
                "1,2,3",
                "DKI Jakarta,Jawa Barat",
                "IDR",
                "Housing credit treaty",
            ].join(","),
            [
                "MC-002",
                "POL-2025-002",
                "PRG-002",
                "Treaty",
                "Corporate",
                "KMK",
                "Kredit Modal Kerja",
                "2025-02-01",
                "2026-02-01",
                "12",
                "1500000000",
                "80",
                "1.0",
                "0.15",
                "0.08",
                "1,2",
                "Jawa Timur,Jawa Tengah",
                "IDR",
                "Working capital treaty",
            ].join(","),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "master_contract_template.csv";
        a.click();
    };

    const toNullableString = (value) => {
        if (value === undefined || value === null) return null;
        const s = String(value).trim();
        return s === "" ? null : s;
    };

    const toBoolean = (value, fallback = false) => {
        if (
            value === undefined ||
            value === null ||
            String(value).trim() === ""
        )
            return fallback;
        if (typeof value === "boolean") return value;

        const v = String(value).trim().toLowerCase();
        if (["true", "1", "yes", "y", "ya"].includes(v)) return true;
        if (["false", "0", "no", "n", "tidak"].includes(v)) return false;
        return fallback;
    };

    const toNumber = (value) => {
        if (value === undefined || value === null) return null;
        if (typeof value === "number")
            return Number.isFinite(value) ? value : null;

        let s = String(value).trim();
        if (!s) return null;

        // Support 27,5 and 1.234.567,89
        s = s.replace(/\s/g, "");
        if (s.includes(",") && s.includes(".")) {
            s = s.replace(/\./g, "").replace(",", ".");
        } else if (s.includes(",")) {
            s = s.replace(",", ".");
        }

        const n = Number(s);
        return Number.isNaN(n) ? null : n;
    };

    const toInteger = (value) => {
        const n = toNumber(value);
        return n === null ? null : Math.trunc(n);
    };

    const toISODate = (value) => {
        if (
            value === undefined ||
            value === null ||
            String(value).trim?.() === ""
        )
            return null;

        // Excel serial date (if any)
        if (typeof value === "number") {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const ms = value * 24 * 60 * 60 * 1000;
            const d = new Date(excelEpoch.getTime() + ms);
            return Number.isNaN(d.getTime()) ? null : d.toISOString();
        }

        const d = new Date(String(value).trim());
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };

    const parseUploadFile = async (file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "csv") {
            const text = await file.text();
            const result = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (h) => h.trim(),
                transform: (v) => (typeof v === "string" ? v.trim() : v),
            });
            return result.data || [];
        }

        if (ext === "xlsx" || ext === "xls") {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            // defval: '' => kolom kosong tetap ada
            return XLSX.utils.sheet_to_json(sheet, {
                defval: "",
                raw: false,
            });
        }

        throw new Error(
            "Unsupported file type. Please upload .csv, .xlsx, or .xls",
        );
    };

    const buildContractId = (row, index) => {
        const explicitId = toNullableString(row.contract_id);
        if (explicitId) return explicitId;

        const contractNo = toNullableString(row.contract_no);
        if (contractNo) {
            return contractNo
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 60);
        }

        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        return `MC-${stamp}-${String(index).padStart(3, "0")}`;
    };

    const readableError = (
        error,
        fallback = "Terjadi kesalahan saat memproses data",
    ) => {
        const msg = String(error?.message || "").trim();
        if (!msg) return fallback;

        if (msg.includes("Unique constraint failed")) {
            return "Data duplikat terdeteksi. Pastikan contract_id belum pernah digunakan.";
        }

        if (msg.includes("contract_id")) {
            return msg;
        }

        if (msg.includes("Upload dibatalkan")) {
            return msg;
        }

        if (msg.includes("baris ke-") || msg.includes("Baris ke-")) {
            return msg;
        }

        return msg;
    };

    // Fungsi ini dipanggil saat tombol "Preview Data" diklik
    const handlePreviewExcel = async () => {
        if (!uploadFile) return;
        if (uploadMode === "revise" && !selectedContractForRevision) {
            setErrorMessage("Please select a contract to revise");
            return;
        }
        setProcessing(true);
        setErrorMessage("");
        try {
            const rows = await parseUploadFile(uploadFile);
            if (!rows || rows.length === 0) {
                setErrorMessage("File kosong atau format tidak valid.");
                setProcessing(false);
                return;
            }
            const contractsPayload = rows.map((row, i) => {
                const derivedId = buildContractId(row, i + 1);
                const contractId = uploadMode === "revise" ? null : derivedId;

                return {
                    contract_id: contractId,

                    underwriter_name: toNullableString(row.underwriter_name),
                    input_date: toISODate(row.input_date),
                    input_status: toNullableString(row.input_status),
                    contract_status:
                        toNullableString(row.contract_status) || "Draft",

                    source_type: toNullableString(row.source_type),
                    source_name: toNullableString(row.source_name),
                    ceding_name: toNullableString(row.ceding_name),
                    ceding_same_as_source: toBoolean(
                        row.ceding_same_as_source,
                        false,
                    ),
                    bank_obligee: toNullableString(row.bank_obligee),

                    endorsement_type: toNullableString(row.endorsement_type),
                    endorsement_reason: toNullableString(
                        row.endorsement_reason,
                    ),
                    endorsement_reason_detail: toNullableString(
                        row.endorsement_reason_detail,
                    ),

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

                    outward_retrocession:
                        toNullableString(row.outward_retrocession) || "Tidak",
                    automatic_cession:
                        toNullableString(row.automatic_cession) || "Tidak",
                    retro_program: toNullableString(row.retro_program),

                    reinsurance_commission_pct: toNumber(
                        row.reinsurance_commission_pct,
                    ),
                    profit_commission_pct: toNumber(row.profit_commission_pct),
                    brokerage_fee_pct: toNumber(row.brokerage_fee_pct),

                    reporting_participant_days: toInteger(
                        row.reporting_participant_days,
                    ),
                    reporting_claim_days: toInteger(row.reporting_claim_days),
                    claim_reporting_type: toNullableString(
                        row.claim_reporting_type,
                    ),
                    payment_scenario: toNullableString(row.payment_scenario),
                    installment_frequency: toNullableString(
                        row.installment_frequency,
                    ),

                    stop_loss_value: toNumber(row.stop_loss_value),
                    stop_loss_basis: toNullableString(row.stop_loss_basis),
                    cut_loss_value: toNumber(row.cut_loss_value),
                    cut_loss_basis: toNullableString(row.cut_loss_basis),
                    cut_off_value: toNumber(row.cut_off_value),
                    cut_off_basis: toNullableString(row.cut_off_basis),

                    loss_ratio_value: toNumber(row.loss_ratio_value),
                    loss_ratio_basis: toNullableString(row.loss_ratio_basis),

                    evaluation_period_value: toInteger(
                        row.evaluation_period_value,
                    ),
                    evaluation_period_unit: toNullableString(
                        row.evaluation_period_unit,
                    ),

                    max_tenor_value: toInteger(row.max_tenor_value),
                    max_tenor_unit: toNullableString(row.max_tenor_unit),
                    max_sum_insured: toNumber(row.max_sum_insured),

                    perils_covers: toNullableString(row.perils_covers),
                    limit_coverage_type: toNullableString(
                        row.limit_coverage_type,
                    ),
                    kolektibilitas_max: toNullableString(
                        row.kolektibilitas_max,
                    ),
                    kolektibilitas_limit_amount: toNumber(
                        row.kolektibilitas_limit_amount,
                    ),

                    currency: "IDR",
                    version: uploadMode === "revise" ? null : 1,
                    parent_contract_id: null,
                };
            });

            setUploadPreviewData(contractsPayload);
            setUploadTabActive(2); // pindah ke tab preview
        } catch (error) {
            setErrorMessage(readableError(error));
        }
        setProcessing(false);
    };

    const handleConfirmSave = async () => {
        setProcessing(true);
        setErrorMessage("");
        setSuccessMessage("");
        try {
            // If we're in revise mode, perform final validation before saving.
            if (uploadMode === "revise") {
                if (!selectedContractForRevision) {
                    setErrorMessage("Silakan pilih kontrak yang akan direvisi.");
                    setProcessing(false);
                    return;
                }

                const selected = revisionContracts.find(
                    (c) => (c.contract_id || c.id) === selectedContractForRevision,
                );
                if (!selected) {
                    setErrorMessage("Kontrak yang dipilih tidak ditemukan.");
                    setProcessing(false);
                    return;
                }

                const expectedNoRaw = toNullableString(selected.contract_no) || "";
                const expectedBase = extractBaseContractNo(expectedNoRaw) || "";
                if (!expectedBase) {
                    setErrorMessage(
                        "Kontrak terpilih tidak memiliki Contract No yang valid.",
                    );
                    setProcessing(false);
                    return;
                }

                const mismatch = (uploadPreviewData || []).find((r) => {
                    const rNo = toNullableString(r.contract_no) || "";
                    return extractBaseContractNo(rNo).trim().toUpperCase() !== expectedBase.trim().toUpperCase();
                });

                if (mismatch) {
                    setErrorMessage(
                        `Contract No pada file (${extractBaseContractNo(mismatch.contract_no) || "-"}) tidak sesuai dengan kontrak yang dipilih untuk direvisi (${expectedBase}). Periksa kembali file atau pilihan kontrak.`,
                    );
                    setProcessing(false);
                    return;
                }
            }
            const result = await backend.uploadMasterContractsAtomic({
                uploadMode,
                selectedContractForRevision:
                    uploadMode === "revise"
                        ? selectedContractForRevision
                        : null,
                contracts: uploadPreviewData,
            });

            const uploaded = Number(result?.createdCount || 0);
            setSuccessMessage(
                `Berhasil upload ${uploaded} contract${
                    uploaded > 1 ? "s" : ""
                }.`,
            );

            // Send notification email for upload
            try {
                sendNotificationEmail({
                    targetGroup: "brins-checker",
                    objectType: "Contract",
                    statusTo: "Draft/Active",
                    recipientRole: "BRINS",
                    variables: {
                        user_name:
                            auditActor?.user_email || user?.email || "System",
                        date: new Date().toLocaleDateString("id-ID"),
                        count: String(uploaded),
                    },
                    fallbackSubject: "Contracts Uploaded",
                    fallbackBody:
                        "<p>{user_name} has uploaded {count} contract(s) on {date}. Awaiting review.</p>",
                }).catch((err) =>
                    console.error("Background email failed:", err),
                );
            } catch (emailError) {
                console.warn("Failed to send notification email:", emailError);
            }

            setShowUploadDialog(false);
            setUploadFile(null);
            setUploadMode("new");
            setSelectedContractForRevision("");
            loadData(page, filters);
            loadStats();
        } catch (error) {
            setErrorMessage(
                readableError(
                    error,
                    "Upload gagal. Periksa data dan coba lagi.",
                ),
            );
        }
        setProcessing(false);
    };

    // === CHECKER BRINS: Draft/Active → CHECKED_BRINS ===
    const handleCheckerBrinsCheck = async () => {
        if (selectedContractIds.length === 0) {
            toast.error("Please select contracts to check");
            return;
        }
        setProcessing(true);
        setErrorMessage("");
        setSuccessMessage("");
        try {
            let processedCount = 0;
            for (const contractId of selectedContractIds) {
                const contract = contracts.find(
                    (c) => (c.contract_id || c.id) === contractId,
                );
                if (!contract) continue;
                const status = (contract.contract_status || "").toString();
                if (status !== "Draft" && status !== "Active") continue;

                await backend.update(
                    "MasterContract",
                    contract.contract_id || contract.id,
                    {
                        contract_status: "CHECKED_BRINS",
                    },
                );
                processedCount++;

                try {
                    await backend.create("AuditLog", {
                        action: "CONTRACT_CHECKED_BRINS",
                        module: "CONFIG",
                        entity_type: "MasterContract",
                        entity_id: contract.contract_id || contract.id,
                        old_value: JSON.stringify({ status }),
                        new_value: JSON.stringify({ status: "CHECKED_BRINS" }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason: `Checker BRINS checked contract ${contract.contract_no || contract.contract_id}`,
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
            }

            if (processedCount === 0) {
                toast.warning(
                    "No contracts with Draft/Active status were found in your selection.",
                );
                setSelectedContractIds([]);
                setProcessing(false);
                return;
            }

            const brinsRoles = [
                "maker-brins-role",
                "checker-brins-role",
                "approver-brins-role",
            ];
            for (const role of brinsRoles) {
                try {
                    await backend.create("Notification", {
                        title: "Contracts Checked by BRINS Checker",
                        message: `${auditActor?.user_email || user?.email} checked ${processedCount} contract(s). Awaiting BRINS Approver approval.`,
                        type: "INFO",
                        module: "CONFIG",
                        target_role: role,
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            }

            // Send notification email for status transition
            try {
                sendNotificationEmail({
                    targetGroup: "brins-approver",
                    objectType: "Contract",
                    statusTo: "CHECKED_BRINS",
                    recipientRole: "BRINS",
                    variables: {
                        user_name:
                            auditActor?.user_email || user?.email || "System",
                        date: new Date().toLocaleDateString("id-ID"),
                        count: String(processedCount),
                    },
                    fallbackSubject: "Contracts Checked",
                    fallbackBody:
                        "<p>{user_name} has checked {count} contract(s) on {date}. Awaiting Approver BRINS approval.</p>",
                }).catch((err) =>
                    console.error("Background email failed:", err),
                );
            } catch (emailError) {
                console.warn("Failed to send notification email:", emailError);
            }

            setSuccessMessage(
                `${processedCount} contract(s) checked successfully.`,
            );
            toast.success(`${processedCount} contract(s) checked.`);
            setSelectedContractIds([]);
            loadData(page, filters);
            loadStats();
        } catch (error) {
            console.error("Check failed:", error);
            setErrorMessage(`Check failed: ${error.message}`);
        }
        setProcessing(false);
    };

    // === APPROVER BRINS: CHECKED_BRINS → APPROVED_BRINS ===
    const handleApproverBrinsApprove = async () => {
        if (selectedContractIds.length === 0) {
            toast.error("Please select contracts to approve");
            return;
        }
        setProcessing(true);
        setErrorMessage("");
        setSuccessMessage("");
        try {
            let processedCount = 0;
            for (const contractId of selectedContractIds) {
                const contract = contracts.find(
                    (c) => (c.contract_id || c.id) === contractId,
                );
                if (!contract || contract.contract_status !== "CHECKED_BRINS")
                    continue;

                await backend.update(
                    "MasterContract",
                    contract.contract_id || contract.id,
                    {
                        contract_status: "APPROVED_BRINS",
                    },
                );
                processedCount++;

                try {
                    await backend.create("AuditLog", {
                        action: "CONTRACT_APPROVED_BRINS",
                        module: "CONFIG",
                        entity_type: "MasterContract",
                        entity_id: contract.contract_id || contract.id,
                        old_value: JSON.stringify({ status: "CHECKED_BRINS" }),
                        new_value: JSON.stringify({ status: "APPROVED_BRINS" }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason: `Approver BRINS approved contract ${contract.contract_no || contract.contract_id}`,
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
            }

            if (processedCount === 0) {
                toast.warning(
                    "No contracts with CHECKED_BRINS status were found in your selection.",
                );
                setSelectedContractIds([]);
                setProcessing(false);
                return;
            }

            const allRoles = [
                "maker-brins-role",
                "checker-brins-role",
                "approver-brins-role",
                "checker-tugure-role",
                "approver-tugure-role",
            ];
            for (const role of allRoles) {
                try {
                    await backend.create("Notification", {
                        title: "Contracts Approved by BRINS",
                        message: `${auditActor?.user_email || user?.email} approved ${processedCount} contract(s). Now available for Tugure review.`,
                        type: "INFO",
                        module: "CONFIG",
                        target_role: role,
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            }

            // Send notification email for status transition
            try {
                sendNotificationEmail({
                    targetGroup: "tugure-checker",
                    objectType: "Contract",
                    statusTo: "APPROVED_BRINS",
                    recipientRole: "TUGURE",
                    variables: {
                        user_name:
                            auditActor?.user_email || user?.email || "System",
                        date: new Date().toLocaleDateString("id-ID"),
                        count: String(processedCount),
                    },
                    fallbackSubject: "Contracts Approved by BRINS",
                    fallbackBody:
                        "<p>{user_name} has approved {count} contract(s) on {date}. Now available for Tugure review.</p>",
                }).catch((err) =>
                    console.error("Background email failed:", err),
                );
            } catch (emailError) {
                console.warn("Failed to send notification email:", emailError);
            }

            setSuccessMessage(
                `${processedCount} contract(s) approved by BRINS. Now available for Tugure review.`,
            );
            toast.success(`${processedCount} contract(s) approved by BRINS.`);
            setSelectedContractIds([]);
            loadData(page, filters);
            loadStats();
        } catch (error) {
            console.error("Approve failed:", error);
            setErrorMessage(`Approve failed: ${error.message}`);
        }
        setProcessing(false);
    };

    // === CHECKER TUGURE: APPROVED_BRINS → CHECKED_TUGURE ===
    const handleCheckerTugureCheck = async () => {
        if (selectedContractIds.length === 0) {
            toast.error("Please select contracts to check");
            return;
        }
        setProcessing(true);
        setErrorMessage("");
        setSuccessMessage("");
        try {
            let processedCount = 0;
            for (const contractId of selectedContractIds) {
                const contract = contracts.find(
                    (c) => (c.contract_id || c.id) === contractId,
                );
                if (!contract || contract.contract_status !== "APPROVED_BRINS")
                    continue;

                await backend.update(
                    "MasterContract",
                    contract.contract_id || contract.id,
                    {
                        contract_status: "CHECKED_TUGURE",
                    },
                );
                processedCount++;

                try {
                    await backend.create("AuditLog", {
                        action: "CONTRACT_CHECKED_TUGURE",
                        module: "CONFIG",
                        entity_type: "MasterContract",
                        entity_id: contract.contract_id || contract.id,
                        old_value: JSON.stringify({ status: "APPROVED_BRINS" }),
                        new_value: JSON.stringify({ status: "CHECKED_TUGURE" }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason: `Checker Tugure checked contract ${contract.contract_no || contract.contract_id}`,
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
            }

            if (processedCount === 0) {
                toast.warning(
                    "No contracts with APPROVED_BRINS status were found in your selection.",
                );
                setSelectedContractIds([]);
                setProcessing(false);
                return;
            }

            for (const role of ALL_ROLE_NAMES) {
                try {
                    await backend.create("Notification", {
                        title: "Contracts Checked by Tugure",
                        message: `${auditActor?.user_email || user?.email} checked ${processedCount} contract(s). Awaiting Tugure Approver final decision.`,
                        type: "INFO",
                        module: "CONFIG",
                        target_role: role,
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            }

            // Send notification email for status transition
            try {
                sendNotificationEmail({
                    targetGroup: "tugure-approver",
                    objectType: "Contract",
                    statusTo: "CHECKED_TUGURE",
                    recipientRole: "TUGURE",
                    variables: {
                        user_name:
                            auditActor?.user_email || user?.email || "System",
                        date: new Date().toLocaleDateString("id-ID"),
                        count: String(processedCount),
                    },
                    fallbackSubject: "Contracts Checked by Tugure",
                    fallbackBody:
                        "<p>{user_name} has checked {count} contract(s) on {date}. Awaiting Tugure Approver final decision.</p>",
                }).catch((err) =>
                    console.error("Background email failed:", err),
                );
            } catch (emailError) {
                console.warn("Failed to send notification email:", emailError);
            }

            setSuccessMessage(
                `${processedCount} contract(s) checked by Tugure. Awaiting final approval.`,
            );
            toast.success(`${processedCount} contract(s) checked by Tugure.`);
            setSelectedContractIds([]);
            loadData(page, filters);
            loadStats();
        } catch (error) {
            console.error("Check failed:", error);
            setErrorMessage(`Check failed: ${error.message}`);
        }
        setProcessing(false);
    };

    // === APPROVER TUGURE: CHECKED_TUGURE → APPROVED or REVISION ===
    const handleApproverTugureAction = async () => {
        if (selectedContractIds.length === 0) {
            toast.error("Please select contracts");
            return;
        }
        if (!approvalAction) return;

        setProcessing(true);
        setErrorMessage("");
        setSuccessMessage("");
        try {
            const newStatus =
                approvalAction === "REVISION" ? "REVISION" : "APPROVED";
            let processedCount = 0;
            for (const contractId of selectedContractIds) {
                const contract = contracts.find(
                    (c) => (c.contract_id || c.id) === contractId,
                );
                if (!contract || contract.contract_status !== "CHECKED_TUGURE")
                    continue;

                const updateData = { contract_status: newStatus };
                if (newStatus === "APPROVED") {
                    updateData.first_approved_by =
                        auditActor?.user_email || user?.email;
                    updateData.first_approved_date = new Date().toISOString();
                }
                if (newStatus === "REVISION" && approvalRemarks) {
                    updateData.revision_reason = approvalRemarks;
                }

                await backend.update(
                    "MasterContract",
                    contract.contract_id || contract.id,
                    updateData,
                );
                processedCount++;

                try {
                    await backend.create("AuditLog", {
                        action: `CONTRACT_${newStatus}`,
                        module: "CONFIG",
                        entity_type: "MasterContract",
                        entity_id: contract.contract_id || contract.id,
                        old_value: JSON.stringify({ status: "CHECKED_TUGURE" }),
                        new_value: JSON.stringify({
                            status: newStatus,
                            remarks: approvalRemarks,
                        }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason:
                            approvalRemarks ||
                            `Approver Tugure ${newStatus.toLowerCase()} contract`,
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
            }

            if (processedCount === 0) {
                toast.warning(
                    "No contracts with CHECKED_TUGURE status were found in your selection.",
                );
                setSelectedContractIds([]);
                setProcessing(false);
                return;
            }

            for (const role of ALL_ROLE_NAMES) {
                try {
                    await backend.create("Notification", {
                        title:
                            newStatus === "APPROVED"
                                ? "Contracts Approved (Final)"
                                : "Contracts Marked for Revision",
                        message: `${auditActor?.user_email || user?.email} ${newStatus === "APPROVED" ? "approved" : "marked for revision"} ${processedCount} contract(s).`,
                        type: newStatus === "REVISION" ? "WARNING" : "INFO",
                        module: "CONFIG",
                        target_role: role,
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            }

            // Send notification email for status transition
            try {
                sendNotificationEmail({
                    targetGroup:
                        newStatus === "REVISION"
                            ? "brins-maker"
                            : "tugure-approver", // If approved, maybe no-one needs it or we send to a generic group
                    objectType: "Contract",
                    statusTo: newStatus,
                    recipientRole: newStatus === "REVISION" ? "BRINS" : "ALL",
                    variables: {
                        user_name:
                            auditActor?.user_email || user?.email || "System",
                        date: new Date().toLocaleDateString("id-ID"),
                        count: String(processedCount),
                        reason: approvalRemarks || "No remarks",
                    },
                    fallbackSubject:
                        newStatus === "APPROVED"
                            ? "Contracts Approved (Final)"
                            : "Contracts Marked for Revision",
                    fallbackBody: `<p>{user_name} ${newStatus === "APPROVED" ? "approved" : "marked for revision"} {count} contract(s) on {date}.</p><p>Remarks: {reason}</p>`,
                }).catch((err) =>
                    console.error("Background email failed:", err),
                );
            } catch (emailError) {
                console.warn("Failed to send notification email:", emailError);
            }

            setSuccessMessage(
                `${processedCount} contract(s) ${newStatus === "APPROVED" ? "approved" : "sent for revision"}.`,
            );
            toast.success(
                `${processedCount} contract(s) ${newStatus === "APPROVED" ? "approved" : "sent for revision"}.`,
            );
            setSelectedContractIds([]);
            setShowApprovalDialog(false);
            setApprovalAction("");
            setApprovalRemarks("");
            loadData(page, filters);
            loadStats();
        } catch (error) {
            console.error("Action failed:", error);
            setErrorMessage(`Action failed: ${error.message}`);
        }
        setProcessing(false);
    };

    const getVersionHistory = (contractId) => {
        return contracts
            .filter(
                (c) =>
                    c.contract_id === contractId ||
                    c.parent_contract_id === contractId,
            )
            .sort((a, b) => (b.version || 1) - (a.version || 1));
    };

    const activeContracts = statsContracts.filter(
        (c) => c.effective_status === "Active",
    );
    const revisionContracts = Array.isArray(statsContracts)
        ? statsContracts
              .filter(
                  (c) =>
                      normalizeStatus(
                          c.contract_status || c.effective_status,
                      ) === "REVISION",
              )
              .sort((a, b) => {
                  const left = new Date(
                      b.input_date || b.updated_at || 0,
                  ).getTime();
                  const right = new Date(
                      a.input_date || a.updated_at || 0,
                  ).getTime();
                  return left - right;
              })
        : [];

    // Validate preview when in Revise mode: ensure contract_no in uploaded file
    // matches the contract_no of the selected contract to revise.
    useEffect(() => {
        if (uploadMode !== "revise" || uploadTabActive !== 2) {
            setPreviewValidationError("");
            return;
        }

        if (!selectedContractForRevision) {
            setPreviewValidationError("Silakan pilih kontrak yang akan direvisi.");
            return;
        }

        const selected = revisionContracts.find(
            (c) => (c.contract_id || c.id) === selectedContractForRevision,
        );
        if (!selected) {
            setPreviewValidationError("Kontrak yang dipilih tidak ditemukan.");
            return;
        }

        const expectedNoRaw = toNullableString(selected.contract_no) || "";
        const expectedBase = extractBaseContractNo(expectedNoRaw) || "";
        if (!expectedBase) {
            setPreviewValidationError(
                "Kontrak terpilih tidak memiliki Contract No yang valid.",
            );
            return;
        }

        const mismatch = (uploadPreviewData || []).find((r) => {
            const rNo = toNullableString(r.contract_no) || "";
            return extractBaseContractNo(rNo).trim().toUpperCase() !== expectedBase.trim().toUpperCase();
        });

        if (mismatch) {
            setPreviewValidationError(
                `Contract No pada file (${extractBaseContractNo(mismatch.contract_no) || "-"}) tidak sesuai dengan kontrak yang dipilih untuk direvisi (${expectedBase}). Periksa kembali file atau pilihan kontrak.`,
            );
        } else {
            setPreviewValidationError("");
        }
    }, [uploadPreviewData, selectedContractForRevision, uploadMode, uploadTabActive, revisionContracts]);

    const stats = {
        total: statsContracts.length,
        active: activeContracts.length,
        // Single-approval workflow: contracts needing action are Draft/Revision
        pending: statsContracts.filter((c) =>
            ["Draft", "Revision"].includes(c.effective_status),
        ).length,
        draft: statsContracts.filter((c) => c.effective_status === "Draft")
            .length,
    };

    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);

    // Contracts are loaded via server-side pagination with filters
    const filteredContracts = contracts;

    const columns = [
        {
            header: (
                <Checkbox
                    checked={
                        filteredContracts.length > 0 &&
                        selectedContractIds.length === filteredContracts.length
                    }
                    onCheckedChange={(checked) => {
                        if (checked) {
                            setSelectedContractIds(
                                filteredContracts.map(
                                    (c) => c.contract_id || c.id,
                                ),
                            );
                        } else {
                            setSelectedContractIds([]);
                        }
                    }}
                />
            ),
            cell: (row) => (
                <Checkbox
                    checked={selectedContractIds.includes(
                        row.contract_id || row.id,
                    )}
                    onCheckedChange={(checked) => {
                        const cId = row.contract_id || row.id;
                        if (checked) {
                            setSelectedContractIds((prev) => [...prev, cId]);
                        } else {
                            setSelectedContractIds((prev) =>
                                prev.filter((id) => id !== cId),
                            );
                        }
                    }}
                />
            ),
            width: "50px",
        },
        {
            header: "Contract No",
            accessorKey: "contract_no",
            cell: (row) => {
                const v = row.contract_no || row.contract_no_from || row.contract_id || '';
                return extractBaseContractNo(v) || '-';
            },
        },
        { header: "Underwriter Name", accessorKey: "underwriter_name" },
        {
            header: "Contract Status",
            accessorKey: "contract_status",
            cell: (row) => {
                const status = (row.contract_status || "Unknown").toString();
                const styles = {
                    CHECKED_BRINS: "bg-yellow-200 text-orange-500",
                    APPROVED_BRINS: "bg-emerald-400 text-white",
                    CHECKED_TUGURE: "bg-violet-100 text-violet-800",
                    REVISION: "bg-red-500 text-white",
                    Active: "bg-blue-100 text-blue-800",
                    Draft: "bg-gray-100 text-gray-800",
                    Unknown: "bg-gray-200 text-gray-700",
                };
                const cls = styles[status] || styles.Unknown;
                return (
                    <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${cls}`}
                        title={status}
                    >
                        {status}
                    </span>
                );
            },
        },
        { header: "Source Name", accessorKey: "source_name" },
        { header: "Ceding Name", accessorKey: "ceding_name" },
        { header: "Type of Contract", accessorKey: "type_of_contract" },
        {
            header: "action",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelectedContract(row);
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

    const previewColumnKeys = [
        "contract_id",
        "underwriter_name",
        "input_date",
        "input_status",
        "contract_status",
        "source_type",
        "source_name",
        "ceding_name",
        "ceding_same_as_source",
        "endorsement_type",
        "endorsement_reason",
        "endorsement_reason_detail",
        "kind_of_business",
        "offer_date",
        "contract_no",
        "binder_no_tugure",
        "contract_no_from",
        "binder_no_from",
        "type_of_contract",
        "bank_obligee",
        "credit_type",
        "debtor_principal",
        "product_type",
        "product_name",
        "contract_start_date",
        "contract_end_date",
        "effective_date",
        "stnc_date",
        "outward_retrocession",
        "automatic_cession",
        "retro_program",
        "reinsurance_commission_pct",
        "profit_commission_pct",
        "brokerage_fee_pct",
        "reporting_participant_days",
        "reporting_claim_days",
        "claim_reporting_type",
        "payment_scenario",
        "installment_frequency",
        "stop_loss_value",
        "stop_loss_basis",
        "cut_loss_value",
        "cut_loss_basis",
        "cut_off_value",
        "cut_off_basis",
        "loss_ratio_value",
        "loss_ratio_basis",
        "evaluation_period_value",
        "evaluation_period_unit",
        "max_tenor_value",
        "max_tenor_unit",
        "max_sum_insured",
        "perils_covers",
        "limit_coverage_type",
        "kolektibilitas_max",
        "kolektibilitas_limit_amount",
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Master Contract Management"
                subtitle="Manage reinsurance master contracts with approval workflow"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Master Contract Management" },
                ]}
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                loadData(page, filters);
                                loadStats();
                            }}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                        {canManageUploadTemplate && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleDownloadTemplate}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Template
                                </Button>
                                <Button
                                    onClick={() => setShowUploadDialog(true)}
                                    variant="outline"
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload Excel
                                </Button>
                            </>
                        )}
                    </div>
                }
            />

            {successMessage && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        {successMessage}
                    </AlertDescription>
                </Alert>
            )}

            {errorMessage && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="whitespace-pre-wrap">
                        {errorMessage}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard
                    title="Total Contracts"
                    value={stats.total}
                    subtitle="All versions"
                    icon={FileText}
                    gradient="from-blue-500 to-blue-600"
                    subtitleColor="text-blue-100"
                />
                <GradientStatCard
                    title="Active Contracts"
                    value={stats.active}
                    subtitle={`${stats.active > 0 ? ((stats.active / stats.total) * 100).toFixed(0) : 0}% of total`}
                    icon={CheckCircle2}
                    gradient="from-green-500 to-green-600"
                    subtitleColor="text-green-100"
                />
                <GradientStatCard
                    title="Needs Action"
                    value={stats.pending}
                    subtitle="Requires action"
                    icon={Clock}
                    gradient="from-orange-500 to-orange-600"
                    subtitleColor="text-orange-100"
                />
                <GradientStatCard
                    title="Draft Status"
                    value={stats.draft}
                    subtitle="Not yet submitted"
                    icon={FileText}
                    gradient="from-gray-500 to-gray-600"
                    subtitleColor="text-gray-100"
                />
            </div>

            {/* Filters */}
            <FilterTab
                filters={filters}
                onFilterChange={setFilters}
                defaultFilters={defaultFilter}
                filterConfig={[
                    {
                        key: "contractId",
                        placeholder: "Search contract...",
                        label: "Contract ID",
                        type: "input",
                        inputType: "text",
                    },
                    {
                        key: "productType",
                        label: "Product Type",
                        options: [
                            { value: "all", label: "All Product Type" },
                            { value: "Treaty", label: "Treaty" },
                            { value: "Facultative", label: "Facultative" },
                            { value: "Retro", label: "Retro" },
                        ],
                    },
                    {
                        key: "creditType",
                        label: "Credit Type",
                        options: [
                            { value: "all", label: "All Credit Type" },
                            { value: "Individual", label: "Individual" },
                            { value: "Corporate", label: "Corporate" },
                        ],
                    },
                    {
                        key: "status",
                        label: "Filter By Status",
                        options: [
                            { value: "all", label: "All Status" },
                            { value: "REVISION", label: "Revision" },
                            { value: "Active", label: "Active" },
                            { value: "Inactive", label: "Inactive" },
                            { value: "Archived", label: "Archived" },
                            {
                                value: "APPROVED_BRINS",
                                label: "Approved by BRINS",
                            },
                            {
                                value: "CHECKED_BRINS",
                                label: "Checked by BRINS",
                            },
                        ],
                    },
                    {
                        key: "startDate",
                        placeholder: "Start Date",
                        label: "Start Date",
                        type: "date",
                    },
                    {
                        key: "endDate",
                        placeholder: "End Date",
                        label: "End Date",
                        type: "date",
                    },
                ]}
            />

            {/* Role-based Bulk Actions */}
            <div className="flex flex-wrap gap-2">
                {isCheckerBrins && (
                    <Button
                        variant="outline"
                        onClick={handleCheckerBrinsCheck}
                        disabled={
                            processing || selectedContractIds.length === 0
                        }
                    >
                        <Check className="w-4 h-4 mr-2" />
                        Check{" "}
                        {selectedContractIds.length > 0
                            ? `(${selectedContractIds.length})`
                            : ""}
                    </Button>
                )}
                {isApproverBrins && (
                    <Button
                        variant="outline"
                        onClick={handleApproverBrinsApprove}
                        disabled={
                            processing || selectedContractIds.length === 0
                        }
                    >
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Approve{" "}
                        {selectedContractIds.length > 0
                            ? `(${selectedContractIds.length})`
                            : ""}
                    </Button>
                )}
                {isCheckerTugure && (
                    <Button
                        variant="outline"
                        onClick={handleCheckerTugureCheck}
                        disabled={
                            processing || selectedContractIds.length === 0
                        }
                    >
                        <Check className="w-4 h-4 mr-2" />
                        Check{" "}
                        {selectedContractIds.length > 0
                            ? `(${selectedContractIds.length})`
                            : ""}
                    </Button>
                )}
                {isApproverTugure && (
                    <>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setApprovalAction("APPROVED");
                                setShowApprovalDialog(true);
                            }}
                            disabled={
                                processing || selectedContractIds.length === 0
                            }
                        >
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Approve{" "}
                            {selectedContractIds.length > 0
                                ? `(${selectedContractIds.length})`
                                : ""}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setApprovalAction("REVISION");
                                setShowApprovalDialog(true);
                            }}
                            disabled={
                                processing || selectedContractIds.length === 0
                            }
                        >
                            <Pen className="w-4 h-4 mr-2" />
                            Revision{" "}
                            {selectedContractIds.length > 0
                                ? `(${selectedContractIds.length})`
                                : ""}
                        </Button>
                    </>
                )}
            </div>

            {/* Main Table with Version Column */}
            <DataTable
                columns={columns}
                data={filteredContracts}
                isLoading={loading}
                onRowClick={undefined}
                pagination={{ from, to, total, page, totalPages }}
                onPageChange={(newPage) => setPage(newPage)}
                emptyMessage="No master contracts found"
            />

            {/* Contract Action Dialog (Close/Invalidate) */}
            <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionType === "close"
                                ? "Close Contract"
                                : "Invalidate Contract"}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedContract?.contract_id} -{" "}
                            {selectedContract?.policy_number}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <Alert
                            variant={
                                actionType === "close"
                                    ? "default"
                                    : "destructive"
                            }
                        >
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                {actionType === "close"
                                    ? "This contract will be marked as Inactive. No new batches can reference it."
                                    : "This contract will be permanently invalidated and cannot be used."}
                            </AlertDescription>
                        </Alert>
                        <div>
                            <label className="text-sm font-medium">
                                Remarks *
                            </label>
                            <Textarea
                                value={approvalRemarks}
                                onChange={(e) =>
                                    setApprovalRemarks(e.target.value)
                                }
                                placeholder="Enter reason for this action..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter className="shrink-0 border-t pt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowActionDialog(false);
                                setApprovalRemarks("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!approvalRemarks) return;
                                setProcessing(true);
                                try {
                                    const newStatus =
                                        actionType === "close"
                                            ? "Inactive"
                                            : "Archived";
                                    // MasterContract uses contract_id as primary key
                                    const contractId =
                                        selectedContract.contract_id ||
                                        selectedContract.id;
                                    await backend.update(
                                        "MasterContract",
                                        contractId,
                                        {
                                            effective_status: newStatus,
                                            remark: approvalRemarks,
                                        },
                                    );

                                    // Create audit log if AuditLog entity exists
                                    try {
                                        await backend.create("AuditLog", {
                                            action: `CONTRACT_${actionType.toUpperCase()}`,
                                            module: "CONFIG",
                                            entity_type: "MasterContract",
                                            entity_id: contractId,
                                            old_value: JSON.stringify({
                                                status: selectedContract.effective_status,
                                            }),
                                            new_value: JSON.stringify({
                                                status: newStatus,
                                            }),
                                            user_email:
                                                auditActor?.user_email ||
                                                user?.email,
                                            user_role:
                                                auditActor?.user_role ||
                                                user?.role,
                                            reason: approvalRemarks,
                                        });
                                    } catch (auditError) {
                                        console.warn(
                                            "Failed to create audit log:",
                                            auditError,
                                        );
                                    }

                                    setSuccessMessage(
                                        `Contract ${actionType}d successfully`,
                                    );
                                    setShowActionDialog(false);
                                    setApprovalRemarks("");
                                    loadData(page, filters);
                                    loadStats();
                                } catch (error) {
                                    console.error("Action error:", error);
                                    setErrorMessage(
                                        `Failed to process action: ${error.message}`,
                                    );
                                }
                                setProcessing(false);
                            }}
                            disabled={processing || !approvalRemarks}
                            variant={
                                actionType === "close"
                                    ? "default"
                                    : "destructive"
                            }
                        >
                            {processing ? "Processing..." : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Upload Dialog */}
            <Dialog
                open={showUploadDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowUploadDialog(false);
                        setUploadMode("new");
                        setSelectedContractForRevision("");
                        setUploadFile(null);
                        setUploadPreviewData([]);
                        setUploadTabActive(1);
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
                                ? "Upload Master Contracts"
                                : "Master Contract Preview"}
                        </DialogTitle>
                        <DialogDescription>
                            {uploadTabActive === 1
                                ? "Upload atau revisi kontrak via Excel/CSV"
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
                                Upload Master Contracts
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
                                Master Contract Preview
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="py-4 space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
                        {/* Tab 1: Upload */}
                        {uploadTabActive === 1 && (
                            <>
                                <div>
                                    <label className="text-sm font-medium">
                                        Upload Mode
                                    </label>
                                    <Select
                                        value={uploadMode}
                                        onValueChange={setUploadMode}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">
                                                Create New Contracts
                                            </SelectItem>
                                            <SelectItem value="revise">
                                                Revise Existing Contract
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {uploadMode === "revise" && (
                                    <div>
                                        <label className="text-sm font-medium">
                                            Select Contract to Revise
                                        </label>
                                        <Select
                                            value={selectedContractForRevision}
                                            onValueChange={
                                                setSelectedContractForRevision
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select contract" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {revisionContracts.length ===
                                                0 ? (
                                                    <SelectItem
                                                        value="__no_revision__"
                                                        disabled
                                                    >
                                                        Tidak ada kontrak
                                                        berstatus REVISION
                                                    </SelectItem>
                                                ) : (
                                                    revisionContracts.map(
                                                        (contract) => {
                                                            const contractId =
                                                                contract.contract_id ||
                                                                "-";
                                                            return (
                                                                <SelectItem
                                                                    key={
                                                                        contractId
                                                                    }
                                                                    value={
                                                                        contractId
                                                                    }
                                                                >
                                                                    {contract.contract_no ||
                                                                        "-"}{" "}
                                                                    (
                                                                    {contractId}
                                                                    )
                                                                </SelectItem>
                                                            );
                                                        },
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {selectedContractForRevision && (
                                            <Alert className="mt-2 bg-blue-50 border-blue-200">
                                                <AlertCircle className="h-4 w-4 text-blue-600" />
                                                <AlertDescription className="text-blue-700">
                                                    Will create a new version and
                                                    archive the previous one
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <label className="text-sm font-medium">
                                        Upload File
                                    </label>
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        onChange={(e) =>
                                            setUploadFile(e.target.files[0])
                                        }
                                        className="w-full mt-1 text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Excel atau CSV format
                                    </p>
                                </div>
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
                                            {uploadMode === "new"
                                                ? "New Contracts"
                                                : "Revise"}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">
                                            File
                                        </p>
                                        <p className="text-sm font-medium mt-1">
                                            {uploadFile?.name}
                                        </p>
                                    </div>
                                </div>
                                {previewValidationError ? (
                                    <Alert className="bg-red-50 border-red-200">
                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                        <AlertDescription className="text-red-700">
                                            {previewValidationError}
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Alert className="bg-blue-50 border-blue-200">
                                        <AlertCircle className="h-4 w-4 text-blue-600" />
                                        <AlertDescription className="text-blue-700">
                                            Below is a preview of the data that will
                                            be saved. Please review it before
                                            confirming.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <div
                                    style={{
                                        overflowX: "auto",
                                        overflowY: "auto",
                                        maxHeight: "340px",
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
                                                {[
                                                    { key: "#", label: "#" },
                                                    {
                                                        key: "contract_id",
                                                        label: "Contract ID",
                                                    },
                                                    {
                                                        key: "underwriter_name",
                                                        label: "Underwriter Name",
                                                    },
                                                    {
                                                        key: "input_date",
                                                        label: "Input Date",
                                                    },
                                                    {
                                                        key: "input_status",
                                                        label: "Input Status",
                                                    },
                                                    {
                                                        key: "contract_status",
                                                        label: "Contract Status",
                                                    },
                                                    {
                                                        key: "source_type",
                                                        label: "Source Type",
                                                    },
                                                    {
                                                        key: "source_name",
                                                        label: "Source Name",
                                                    },
                                                    {
                                                        key: "ceding_name",
                                                        label: "Ceding Name",
                                                    },
                                                    {
                                                        key: "ceding_same_as_source",
                                                        label: "Ceding = Source",
                                                    },
                                                    {
                                                        key: "bank_obligee",
                                                        label: "Bank Obligee",
                                                    },
                                                    {
                                                        key: "endorsement_type",
                                                        label: "Endorsement Type",
                                                    },
                                                    {
                                                        key: "endorsement_reason",
                                                        label: "Endorsement Reason",
                                                    },
                                                    {
                                                        key: "endorsement_reason_detail",
                                                        label: "Endorsement Detail",
                                                    },
                                                    {
                                                        key: "kind_of_business",
                                                        label: "Kind of Business",
                                                    },
                                                    {
                                                        key: "offer_date",
                                                        label: "Offer Date",
                                                    },
                                                    {
                                                        key: "contract_no",
                                                        label: "Contract No",
                                                    },
                                                    {
                                                        key: "binder_no_tugure",
                                                        label: "Binder No Tugure",
                                                    },
                                                    {
                                                        key: "contract_no_from",
                                                        label: "Contract No From",
                                                    },
                                                    {
                                                        key: "binder_no_from",
                                                        label: "Binder No From",
                                                    },
                                                    {
                                                        key: "type_of_contract",
                                                        label: "Type of Contract",
                                                    },
                                                    {
                                                        key: "credit_type",
                                                        label: "Credit Type",
                                                    },
                                                    {
                                                        key: "debtor_principal",
                                                        label: "Debtor Principal",
                                                    },
                                                    {
                                                        key: "product_type",
                                                        label: "Product Type",
                                                    },
                                                    {
                                                        key: "product_name",
                                                        label: "Product Name",
                                                    },
                                                    {
                                                        key: "contract_start_date",
                                                        label: "Start Date",
                                                    },
                                                    {
                                                        key: "contract_end_date",
                                                        label: "End Date",
                                                    },
                                                    {
                                                        key: "effective_date",
                                                        label: "Effective Date",
                                                    },
                                                    {
                                                        key: "stnc_date",
                                                        label: "STNC Date",
                                                    },
                                                    {
                                                        key: "outward_retrocession",
                                                        label: "Outward Retrocession",
                                                    },
                                                    {
                                                        key: "automatic_cession",
                                                        label: "Automatic Cession",
                                                    },
                                                    {
                                                        key: "retro_program",
                                                        label: "Retro Program",
                                                    },
                                                    {
                                                        key: "reinsurance_commission_pct",
                                                        label: "RI Commission %",
                                                    },
                                                    {
                                                        key: "profit_commission_pct",
                                                        label: "Profit Commission %",
                                                    },
                                                    {
                                                        key: "brokerage_fee_pct",
                                                        label: "Brokerage Fee %",
                                                    },
                                                    {
                                                        key: "reporting_participant_days",
                                                        label: "Report Participant Days",
                                                    },
                                                    {
                                                        key: "reporting_claim_days",
                                                        label: "Report Claim Days",
                                                    },
                                                    {
                                                        key: "claim_reporting_type",
                                                        label: "Claim Reporting Type",
                                                    },
                                                    {
                                                        key: "payment_scenario",
                                                        label: "Payment Scenario",
                                                    },
                                                    {
                                                        key: "installment_frequency",
                                                        label: "Installment Freq.",
                                                    },
                                                    {
                                                        key: "stop_loss_value",
                                                        label: "Stop Loss Value",
                                                    },
                                                    {
                                                        key: "stop_loss_basis",
                                                        label: "Stop Loss Basis",
                                                    },
                                                    {
                                                        key: "cut_loss_value",
                                                        label: "Cut Loss Value",
                                                    },
                                                    {
                                                        key: "cut_loss_basis",
                                                        label: "Cut Loss Basis",
                                                    },
                                                    {
                                                        key: "cut_off_value",
                                                        label: "Cut Off Value",
                                                    },
                                                    {
                                                        key: "cut_off_basis",
                                                        label: "Cut Off Basis",
                                                    },
                                                    {
                                                        key: "loss_ratio_value",
                                                        label: "Loss Ratio Value",
                                                    },
                                                    {
                                                        key: "loss_ratio_basis",
                                                        label: "Loss Ratio Basis",
                                                    },
                                                    {
                                                        key: "evaluation_period_value",
                                                        label: "Eval. Period Value",
                                                    },
                                                    {
                                                        key: "evaluation_period_unit",
                                                        label: "Eval. Period Unit",
                                                    },
                                                    {
                                                        key: "max_tenor_value",
                                                        label: "Max Tenor Value",
                                                    },
                                                    {
                                                        key: "max_tenor_unit",
                                                        label: "Max Tenor Unit",
                                                    },
                                                    {
                                                        key: "max_sum_insured",
                                                        label: "Max Sum Insured",
                                                    },
                                                    {
                                                        key: "perils_covers",
                                                        label: "Perils Covers",
                                                    },
                                                    {
                                                        key: "limit_coverage_type",
                                                        label: "Limit Coverage Type",
                                                    },
                                                    {
                                                        key: "kolektibilitas_max",
                                                        label: "Kolektibilitas Max",
                                                    },
                                                    {
                                                        key: "kolektibilitas_limit_amount",
                                                        label: "Kolektibilitas Limit",
                                                    },
                                                ].map(({ key, label }) => (
                                                    <th
                                                        key={key}
                                                        className="text-left p-2 font-medium text-gray-500 border-b whitespace-nowrap"
                                                        style={{
                                                            minWidth:
                                                                key === "#"
                                                                    ? "36px"
                                                                    : "130px",
                                                        }}
                                                    >
                                                        {label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uploadPreviewData.map((row, i) => (
                                                <tr
                                                    key={i}
                                                    className="hover:bg-gray-50 border-b border-gray-100"
                                                >
                                                    <td className="p-2 text-gray-400 whitespace-nowrap">
                                                        {i + 1}
                                                    </td>
                                                    <td className="p-2 font-mono whitespace-nowrap">
                                                        {row.contract_id ?? "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.underwriter_name ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.input_date
                                                            ? String(
                                                                  row.input_date,
                                                              ).slice(0, 10)
                                                            : "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.input_status ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs">
                                                            {row.contract_status ??
                                                                "Draft"}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.source_type ?? "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.source_name ?? "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.ceding_name ?? "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.ceding_same_as_source ===
                                                        true
                                                            ? "Ya"
                                                            : row.ceding_same_as_source ===
                                                                false
                                                              ? "Tidak"
                                                              : "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.bank_obligee ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.endorsement_type ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.endorsement_reason ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.endorsement_reason_detail ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.kind_of_business ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.offer_date
                                                            ? String(
                                                                  row.offer_date,
                                                              ).slice(0, 10)
                                                            : "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.contract_no ?? "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.binder_no_tugure ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.contract_no_from ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.binder_no_from ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.type_of_contract ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.credit_type ?? "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.debtor_principal ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.product_type ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.product_name ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.contract_start_date
                                                            ? String(
                                                                  row.contract_start_date,
                                                              ).slice(0, 10)
                                                            : "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.contract_end_date
                                                            ? String(
                                                                  row.contract_end_date,
                                                              ).slice(0, 10)
                                                            : "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.effective_date
                                                            ? String(
                                                                  row.effective_date,
                                                              ).slice(0, 10)
                                                            : "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.stnc_date
                                                            ? String(
                                                                  row.stnc_date,
                                                              ).slice(0, 10)
                                                            : "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.outward_retrocession ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.automatic_cession ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.retro_program ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.reinsurance_commission_pct ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.profit_commission_pct ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.brokerage_fee_pct ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.reporting_participant_days ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.reporting_claim_days ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.claim_reporting_type ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.payment_scenario ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.installment_frequency ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.stop_loss_value ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.stop_loss_basis ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.cut_loss_value ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.cut_loss_basis ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.cut_off_value ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.cut_off_basis ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.loss_ratio_value ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.loss_ratio_basis ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.evaluation_period_value ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.evaluation_period_unit ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.max_tenor_value ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.max_tenor_unit ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.max_sum_insured ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.perils_covers ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.limit_coverage_type ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.kolektibilitas_max ??
                                                            "-"}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {row.kolektibilitas_limit_amount ??
                                                            "-"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowUploadDialog(false);
                                setUploadMode("new");
                                setSelectedContractForRevision("");
                                setUploadFile(null);
                                setUploadPreviewData([]);
                                setUploadTabActive(1);
                            }}
                        >
                            Cancel
                        </Button>
                        {uploadTabActive === 2 && (
                            <Button
                                variant="outline"
                                onClick={() => setUploadTabActive(1)}
                            >
                                ← Back
                            </Button>
                        )}
                        {uploadTabActive === 1 && (
                            <Button
                                onClick={handlePreviewExcel}
                                disabled={
                                    processing ||
                                    !uploadFile ||
                                    (uploadMode === "revise" &&
                                        !selectedContractForRevision)
                                }
                            >
                                {processing ? "Memproses..." : "Preview Data →"}
                            </Button>
                        )}
                        {uploadTabActive === 2 && (
                            <div
                                className={`inline-block ${
                                    processing ||
                                    (uploadMode === "revise" &&
                                        !!previewValidationError)
                                        ? "hover:cursor-not-allowed"
                                        : ""
                                }`}
                            >
                                <Button
                                    onClick={handleConfirmSave}
                                    disabled={
                                        processing ||
                                        (uploadMode === "revise" &&
                                            !!previewValidationError)
                                    }
                                    className={`bg-green-600 text-white ${
                                        processing ||
                                        (uploadMode === "revise" &&
                                            !!previewValidationError)
                                            ? "opacity-60"
                                            : "hover:bg-green-700"
                                    }`}
                                >
                                    {processing
                                        ? uploadMode === "revise"
                                            ? "Revising..."
                                            : "Uploading..."
                                        : uploadMode === "revise"
                                        ? "Revise"
                                        : "Upload"}
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approval Dialog (Approver Tugure: Approve/Revision) */}
            <Dialog
                open={showApprovalDialog}
                onOpenChange={setShowApprovalDialog}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {approvalAction === "REVISION"
                                ? "Send for Revision"
                                : "Approve (Final)"}{" "}
                            — {selectedContractIds.length} contract(s)
                        </DialogTitle>
                        <DialogDescription>
                            {approvalAction === "REVISION"
                                ? "Selected contracts will be sent back for revision."
                                : "Selected contracts will be approved (final)."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium">Remarks</label>
                        <Textarea
                            value={approvalRemarks}
                            onChange={(e) => setApprovalRemarks(e.target.value)}
                            placeholder="Enter approval/revision remarks..."
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowApprovalDialog(false);
                                setApprovalAction("");
                                setApprovalRemarks("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApproverTugureAction}
                            disabled={
                                processing ||
                                (approvalAction === "REVISION" &&
                                    !approvalRemarks)
                            }
                        >
                            {processing ? "Processing..." : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Version History Dialog */}
            <Dialog
                open={showVersionDialog}
                onOpenChange={setShowVersionDialog}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Contract Version History</DialogTitle>
                        <DialogDescription>
                            {selectedContract?.contract_id}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {selectedContract && (
                            <div className="space-y-4">
                                {getVersionHistory(
                                    selectedContract.contract_id,
                                ).map((version, idx) => (
                                    <Card key={idx}>
                                        <CardContent className="pt-4">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Badge>
                                                            Version{" "}
                                                            {version.version ||
                                                                1}
                                                        </Badge>
                                                        <StatusBadge
                                                            status={
                                                                version.effective_status
                                                            }
                                                        />
                                                    </div>
                                                    <div className="text-sm space-y-1">
                                                        <p>
                                                            <strong>
                                                                Policy:
                                                            </strong>{" "}
                                                            {version.policy_no}
                                                        </p>
                                                        <p>
                                                            <strong>
                                                                Coverage:
                                                            </strong>{" "}
                                                            {
                                                                version.coverage_start_date
                                                            }{" "}
                                                            to{" "}
                                                            {
                                                                version.coverage_end_date
                                                            }
                                                        </p>
                                                        <p>
                                                            <strong>
                                                                Max Plafond:
                                                            </strong>{" "}
                                                            IDR{" "}
                                                            {(
                                                                (version.max_plafond ||
                                                                    0) / 1000000
                                                            ).toFixed(1)}
                                                            M
                                                        </p>
                                                        <p>
                                                            <strong>
                                                                Share TUGURE:
                                                            </strong>{" "}
                                                            {
                                                                version.share_tugure_percentage
                                                            }
                                                            %
                                                        </p>
                                                        {version.remark && (
                                                            <p>
                                                                <strong>
                                                                    Remarks:
                                                                </strong>{" "}
                                                                {version.remark}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowVersionDialog(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent
                    className="max-w-4xl w-full"
                    style={{
                        maxHeight: "90vh",
                        display: "flex",
                        flexDirection: "column",
                        overflowY: "auto",
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Master Contract Detail</DialogTitle>
                        <DialogDescription>
                            {selectedContract?.contract_no ||
                                selectedContract?.contract_no_from ||
                                selectedContract?.contract_id ||
                                "-"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {selectedContract &&
                            Object.entries(selectedContract)
                                .filter(([key]) => key !== "id")
                                .map(([key, val]) => (
                                    <div
                                        key={key}
                                        className="border rounded p-2"
                                    >
                                        <div className="font-medium text-gray-600">
                                            {key}
                                        </div>
                                        <div className="break-words">
                                            {val === null ||
                                            val === undefined ||
                                            val === ""
                                                ? "-"
                                                : String(val)}
                                        </div>
                                    </div>
                                ))}
                    </div>

                    {revisionDiffs && revisionDiffs.length > 0 && (
                        <div className="mt-4 w-full">
                            <div className="font-semibold mb-2">Revision Differences</div>
                            <div className="grid grid-cols-1 gap-2">
                                {revisionDiffs.map((d) => (
                                    <div key={d.key} className="p-2 border rounded flex justify-between">
                                        <div className="w-1/3 font-medium text-sm">{d.key}</div>
                                        <div className="w-2/3 text-sm">
                                            <div className="text-yellow-600 font-normal">Old: {d.old}</div>
                                            <div className="text-green-600 font-medium text-base">New: {d.new}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDetailDialog(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
