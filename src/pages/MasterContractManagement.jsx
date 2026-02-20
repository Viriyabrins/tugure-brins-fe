import React, { useState, useEffect } from "react";
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
    XCircle,
    Pen,
    Check,
    Eye,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import { formatRupiahAdaptive } from "@/utils/currency";
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

export default function MasterContractManagement() {
    const [user, setUser] = useState(null);
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

    const isTugure = user?.role === "TUGURE" || user?.role === "admin";
    // Single-approval workflow: approvals happen only from Tugure side

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

    const loadUser = async () => {
        try {
            const demoUserStr = localStorage.getItem("demo_user");
            if (demoUserStr) {
                setUser(JSON.parse(demoUserStr));
            }
        } catch (error) {
            console.error("Failed to load user:", error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await backend.list("MasterContract");
            setContracts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to load contracts:", error);
            setContracts([]);
        }
        setLoading(false);
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

    const handleUploadExcel = async () => {
        if (!uploadFile) return;

        if (uploadMode === "revise" && !selectedContractForRevision) {
            setErrorMessage("Please select a contract to revise");
            return;
        }

        setProcessing(true);
        setErrorMessage("");
        setSuccessMessage("");

        let uploaded = 0;
        const errors = [];

        try {
            const rows = await parseUploadFile(uploadFile);
            if (!rows || rows.length === 0) {
                setErrorMessage("File is empty or invalid format");
                setProcessing(false);
                return;
            }

            const allContracts = await backend.list("MasterContract");
            const existingById = new Map();
            for (const c of allContracts) {
                if (!c?.contract_id) continue;
                const arr = existingById.get(c.contract_id) || [];
                arr.push(c);
                existingById.set(c.contract_id, arr);
            }

            let reviseBaseVersion = 0;
            let reviseParentId = null;

            if (uploadMode === "revise") {
                const existing =
                    existingById.get(selectedContractForRevision) || [];
                if (existing.length > 0) {
                    reviseBaseVersion = Math.max(
                        ...existing.map((c) => c.version || 1),
                    );
                    const latest = existing.find(
                        (c) => (c.version || 1) === reviseBaseVersion,
                    );
                    reviseParentId = latest?.contract_id || null;
                }
            }

            for (let i = 0; i < rows.length; i++) {
                try {
                    const row = rows[i];
                    const derivedId = buildContractId(row, i + 1);
                    const contractId =
                        uploadMode === "revise"
                            ? selectedContractForRevision
                            : derivedId;

                    if (uploadMode === "new") {
                        const exists = existingById.has(contractId);
                        if (exists) {
                            errors.push(
                                `Row ${i + 2}: contract_id ${contractId} already exists`,
                            );
                            continue;
                        }
                    }

                    const version =
                        uploadMode === "revise"
                            ? reviseBaseVersion + uploaded + 1
                            : 1;

                    const payload = {
                        contract_id: contractId,

                        underwriter_name: toNullableString(
                            row.underwriter_name,
                        ),
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

                        endorsement_type: toNullableString(
                            row.endorsement_type,
                        ),
                        endorsement_reason: toNullableString(
                            row.endorsement_reason,
                        ),
                        endorsement_reason_detail: toNullableString(
                            row.endorsement_reason_detail,
                        ),

                        kind_of_business: toNullableString(
                            row.kind_of_business,
                        ),
                        offer_date: toISODate(row.offer_date),
                        contract_no: toNullableString(row.contract_no),
                        binder_no_tugure: toNullableString(
                            row.binder_no_tugure,
                        ),
                        contract_no_from: toNullableString(
                            row.contract_no_from,
                        ),
                        binder_no_from: toNullableString(row.binder_no_from),
                        type_of_contract: toNullableString(
                            row.type_of_contract,
                        ),

                        credit_type: toNullableString(row.credit_type),
                        debtor_principal: toNullableString(
                            row.debtor_principal,
                        ),
                        product_type: toNullableString(row.product_type),
                        product_name: toNullableString(row.product_name),

                        contract_start_date: toISODate(row.contract_start_date),
                        contract_end_date: toISODate(row.contract_end_date),
                        effective_date: toISODate(row.effective_date),
                        stnc_date: toISODate(row.stnc_date),

                        outward_retrocession:
                            toNullableString(row.outward_retrocession) ||
                            "Tidak",
                        automatic_cession:
                            toNullableString(row.automatic_cession) || "Tidak",
                        retro_program: toNullableString(row.retro_program),

                        reinsurance_commission_pct: toNumber(
                            row.reinsurance_commission_pct,
                        ),
                        profit_commission_pct: toNumber(
                            row.profit_commission_pct,
                        ),
                        brokerage_fee_pct: toNumber(row.brokerage_fee_pct),

                        reporting_participant_days: toInteger(
                            row.reporting_participant_days,
                        ),
                        reporting_claim_days: toInteger(
                            row.reporting_claim_days,
                        ),
                        claim_reporting_type: toNullableString(
                            row.claim_reporting_type,
                        ),
                        payment_scenario: toNullableString(
                            row.payment_scenario,
                        ),
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
                        loss_ratio_basis: toNullableString(
                            row.loss_ratio_basis,
                        ),

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
                        version,
                        parent_contract_id:
                            uploadMode === "revise" ? reviseParentId : null,
                    };

                    await backend.create("MasterContract", payload);
                    uploaded++;
                } catch (rowError) {
                    errors.push(`Row ${i + 2}: ${rowError.message}`);
                }
            }

            if (errors.length > 0) {
                setErrorMessage(
                    `Uploaded ${uploaded} contracts. ${errors.length} errors:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? "\n..." : ""}`,
                );
            } else {
                setSuccessMessage(
                    `Successfully uploaded ${uploaded} contract${uploaded > 1 ? "s" : ""}`,
                );
            }

            setShowUploadDialog(false);
            setUploadFile(null);
            setUploadMode("new");
            setSelectedContractForRevision("");
            loadData();
        } catch (error) {
            console.error("Upload error:", error);
            setErrorMessage(`Upload failed: ${error.message}`);
        }

        setProcessing(false);
    };

    const handleApproval = async () => {
        if (!selectedContract || !approvalAction) return;

        setProcessing(true);
        try {
            const updates = {};

            // Update contract_status instead of effective_status
            if (approvalAction === "APPROVED") {
                updates.contract_status = "APPROVED";
                updates.first_approved_by = user?.email;
                updates.first_approved_date = new Date().toISOString();
                if (approvalRemarks) updates.remark = approvalRemarks;
            } else if (approvalAction === "REVISION") {
                updates.contract_status = "REVISION";
                updates.revision_reason = approvalRemarks;
            }

            const contractId =
                selectedContract.contract_id || selectedContract.id;
            await backend.update("MasterContract", contractId, updates);

            try {
                await backend.create("AuditLog", {
                    action: `CONTRACT_${approvalAction}`,
                    module: "CONFIG",
                    entity_type: "MasterContract",
                    entity_id: contractId,
                    old_value: JSON.stringify({
                        status: selectedContract.contract_status,
                    }),
                    new_value: JSON.stringify({
                        status: updates.contract_status,
                    }),
                    user_email: user?.email,
                    user_role: user?.role,
                    reason: approvalRemarks,
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            try {
                await backend.create("Notification", {
                    title:
                        approvalAction === "REVISION"
                            ? "Contract Needs Revision"
                            : "Contract Approved",
                    message:
                        approvalAction === "REVISION"
                            ? `Master Contract ${contractId} sent for revision: ${approvalRemarks || "-"}`
                            : `Master Contract ${contractId} marked as APPROVED`,
                    type: approvalAction === "REVISION" ? "WARNING" : "INFO",
                    module: "CONFIG",
                    reference_id: contractId,
                    target_role: "ALL",
                });
            } catch (notifError) {
                console.warn("Failed to create notification:", notifError);
            }

            if (approvalAction === "REVISION") {
                setSuccessMessage("Contract sent for revision successfully");
            } else {
                setSuccessMessage("Contract status updated to APPROVED");
            }

            setShowApprovalDialog(false);
            setSelectedContract(null);
            setApprovalAction("");
            setApprovalRemarks("");
            loadData();
        } catch (error) {
            console.error("Approval error:", error);
            setErrorMessage(`Failed to process approval: ${error.message}`);
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

    const activeContracts = contracts.filter(
        (c) => c.effective_status === "Active",
    );
    const uniqueContractIds = [...new Set(contracts.map((c) => c.contract_id))];

    const stats = {
        total: contracts.length,
        active: activeContracts.length,
        // Single-approval workflow: contracts needing action are Draft/Revision
        pending: contracts.filter((c) =>
            ["Draft", "Revision"].includes(c.effective_status),
        ).length,
        draft: contracts.filter((c) => c.effective_status === "Draft").length,
    };

    const filteredContracts = Array.isArray(contracts)
        ? contracts.filter((c) => {
              if (
                  filters.status !== "all" &&
                  c.effective_status !== filters.status
              )
                  return false;
              if (
                  filters.contractId &&
                  !c.contract_id.includes(filters.contractId)
              )
                  return false;
              if (
                  filters.productType !== "all" &&
                  c.product_type !== filters.productType
              )
                  return false;
              if (
                  filters.creditType !== "all" &&
                  c.credit_type !== filters.creditType
              )
                  return false;
              if (
                  filters.startDate &&
                  c.contract_start_date < filters.startDate
              )
                  return false;
              if (filters.endDate && c.contract_end_date > filters.endDate)
                  return false;
              return true;
          })
        : [];

    const columns = [
        { header: "contract_no", accessorKey: "contract_no" },
        { header: "underwriter_name", accessorKey: "underwriter_name" },
        {
            header: "contract_status",
            accessorKey: "contract_status",
            cell: (row) => {
                const status = (row.contract_status || "Unknown").toString();
                const styles = {
                    APPROVED: "bg-emerald-400 text-white",
                    REVISION: "bg-yellow-400 text-black",
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
        { header: "source_name", accessorKey: "source_name" },
        { header: "ceding_name", accessorKey: "ceding_name" },
        { header: "type_of_contract", accessorKey: "type_of_contract" },
        {
            header: "action",
            cell: (row) => {
                const status = (row.contract_status || "").toString();
                const showButtons =
                    isTugure && (status === "Draft" || status === "Active");

                return (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setSelectedContract(row);
                                setShowDetailDialog(true);
                            }}
                            title="Lihat detail"
                        >
                            <Eye className="w-4 h-4" />
                        </Button>

                        {showButtons && (
                            <>
                                <Button
                                    size="sm"
                                    className="bg-emerald-400 hover:bg-emerald-500 text-white"
                                    onClick={() => {
                                        setSelectedContract(row);
                                        setApprovalAction("APPROVED");
                                        setShowApprovalDialog(true);
                                    }}
                                >
                                    APPROVED
                                </Button>

                                <Button
                                    size="sm"
                                    className="bg-yellow-400 hover:bg-yellow-500 text-black"
                                    onClick={() => {
                                        setSelectedContract(row);
                                        setApprovalAction("REVISION");
                                        setShowApprovalDialog(true);
                                    }}
                                >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    REVISION
                                </Button>
                            </>
                        )}
                    </div>
                );
            },
            width: "260px",
        },
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
                        <Button variant="outline" onClick={loadData}>
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
                            onClick={() => setShowUploadDialog(true)}
                            variant="outline"
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Excel
                        </Button>
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
                        label: "All Status",
                        options: [
                            { value: "all", label: "All Status" },
                            { value: "Draft", label: "Draft" },
                            { value: "Revision", label: "Revision" },
                            { value: "Active", label: "Active" },
                            { value: "Inactive", label: "Inactive" },
                            { value: "Archived", label: "Archived" },
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

            {/* Bulk Actions */}
            <div className="flex flex-wrap gap-2">
                {/* <>
            <Button
                // className="bg-green-500 hover:bg-green-600"
                variant = "outline"
                onClick={() => {
                    setApprovalAction("bulk_approve");
                    setShowApprovalDialog(true);
                }}
            >
                <Check className="w-4 h-4 mr-2" />
                Approve {selectedContract.length > 0 ? `(${selectedContract.length})` : ""}
            </Button>
          </> */}
            </div>

            {/* Main Table with Version Column */}
            <DataTable
                columns={columns}
                data={filteredContracts}
                isLoading={loading}
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
                    <DialogFooter>
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
                                            user_email: user?.email,
                                            user_role: user?.role,
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
                                    loadData();
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
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Master Contracts</DialogTitle>
                        <DialogDescription>
                            Upload or revise contracts via Excel/CSV
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
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
                                        {uniqueContractIds.map((cid) => {
                                            const latest = contracts
                                                .filter(
                                                    (c) =>
                                                        c.contract_id === cid,
                                                )
                                                .sort(
                                                    (a, b) =>
                                                        (b.version || 1) -
                                                        (a.version || 1),
                                                )[0];
                                            return (
                                                <SelectItem
                                                    key={cid}
                                                    value={cid}
                                                >
                                                    {cid} - v
                                                    {latest.version || 1} (
                                                    {latest.effective_status})
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                {selectedContractForRevision && (
                                    <Alert className="mt-2 bg-blue-50 border-blue-200">
                                        <AlertCircle className="h-4 w-4 text-blue-600" />
                                        <AlertDescription className="text-blue-700">
                                            Will create new version and archive
                                            previous
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
                                Excel or CSV format
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowUploadDialog(false);
                                setUploadMode("new");
                                setSelectedContractForRevision("");
                                setUploadFile(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUploadExcel}
                            disabled={
                                processing ||
                                !uploadFile ||
                                (uploadMode === "revise" &&
                                    !selectedContractForRevision)
                            }
                        >
                            {processing ? "Uploading..." : "Upload"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approval Dialog */}
            <Dialog
                open={showApprovalDialog}
                onOpenChange={setShowApprovalDialog}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {approvalAction === "REVISION"
                                ? "Send for Revision"
                                : "Approve"}{" "}
                            Contract
                        </DialogTitle>
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
                            onClick={() => setShowApprovalDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleApproval} disabled={processing}>
                            Confirm
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
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>Master Contract Detail</DialogTitle>
                        <DialogDescription>
                            {selectedContract?.contract_no ||
                                selectedContract?.contract_id ||
                                "-"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {selectedContract &&
                            Object.entries(selectedContract).map(
                                ([key, val]) => (
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
                                ),
                            )}
                    </div>

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
