import React, { useState, useEffect } from "react";
import PageHeader from "@/components/common/PageHeader";
import Papa from "papaparse";
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
    XCircle,
    AlertCircle,
    RefreshCw,
    FileText,
    Users,
    Pen,
} from "lucide-react";
import { toast } from "sonner";
import {
    createAuditLog,
    sendTemplatedEmail,
} from "@/components/utils/emailTemplateHelper";
import { formatRupiahAdaptive } from "@/utils/currency";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import { filter } from "lodash";

export default function SubmitDebtor() {
    const [user, setUser] = useState(null);
    const [contracts, setContracts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [debtors, setDebtors] = useState([]);
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

    const [filters, setFilters] = useState({
        contract: "all",
        batch: "",
        status: "all",
        name: "",
    });

    useEffect(() => {
        loadUser();
        loadInitialData();
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

    const loadInitialData = async () => {
        setLoading(true);
        setSuccessMessage("");
        setErrorMessage("");

        try {
            await Promise.all([loadContracts(), loadBatches(), loadDebtors()]);
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
            setContracts(
                Array.isArray(data)
                    ? data.filter((c) => c.effective_status === "Active")
                    : [],
            );
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

    const loadDebtors = async () => {
        try {
            const data = await backend.list("Debtor");
            setDebtors(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading debtors:", error);
            setDebtors([]);
        }
    };

    const handleRefresh = () => {
        setSuccessMessage("");
        setErrorMessage("");
        loadInitialData();
    };

    // Download template
    const handleDownloadTemplate = () => {
        const sampleData = [
            "1001,PRG-001,LA-001,P-001,KPR,Kredit Pemilikan Rumah,CIF-001,New,Full,2025-01-01,2030-12-31,500000000,4750000,1.0,0.1,0.05,3875000,U001,Unit Jakarta,Branch Sudirman,DKI Jakarta,PT Maju Jaya,Jl. Sudirman No.1 Jakarta,CA-001,2025-01-15 10:00:00,2025-01-16 14:00:00,1,Approved,0,1",
            "1002,PRG-001,LA-002,P-002,KPR,Kredit Pemilikan Rumah,CIF-002,New,Full,2025-01-01,2030-12-31,300000000,2850000,1.0,0.1,0.05,2325000,U001,Unit Jakarta,Branch Sudirman,DKI Jakarta,CV Berkah Abadi,Jl. Thamrin No.2 Jakarta,CA-002,2025-01-15 11:00:00,2025-01-16 15:00:00,1,Approved,0,1",
            "1003,PRG-001,LA-003,P-003,KPR,Kredit Pemilikan Rumah,CIF-003,New,Full,2025-01-01,2030-12-31,450000000,4275000,1.0,0.1,0.05,3487500,U001,Unit Jakarta,Branch Sudirman,DKI Jakarta,PT Cahaya Terang,Jl. Gatot Subroto No.3,CA-003,2025-01-15 12:00:00,2025-01-16 16:00:00,1,Good,0,1",
            "1004,PRG-001,LA-004,P-004,KPR,Kredit Pemilikan Rumah,CIF-004,New,Full,2025-01-01,2030-12-31,350000000,3325000,1.0,0.1,0.05,2712500,U001,Unit Jakarta,Branch Sudirman,DKI Jakarta,UD Sumber Rezeki,Jl. Rasuna Said No.4,CA-004,2025-01-15 13:00:00,2025-01-16 17:00:00,1,Verified,0,1",
            "1005,PRG-001,LA-005,P-005,KPR,Kredit Pemilikan Rumah,CIF-005,New,Full,2025-01-01,2030-12-31,400000000,3800000,1.0,0.1,0.05,3100000,U001,Unit Jakarta,Branch Sudirman,DKI Jakarta,CV Mitra Sejati,Jl. HR Rasuna No.5,CA-005,2025-01-15 14:00:00,2025-01-16 18:00:00,1,Complete,0,1",
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
            return;
        }

        if (batchMode === "revise" && !selectedBatch) {
            setErrorMessage("Please select a batch to revise");
            return;
        }

        if (!uploadFile) {
            setErrorMessage("Please select a file to upload");
            return;
        }

        setUploading(true);
        setErrorMessage("");
        setSuccessMessage("");

        let uploaded = 0;
        let errors = [];

        try {
            const text = await uploadFile.text();

            // Use PapaParse for proper CSV parsing
            const parseResult = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) => header.trim(),
                transform: (value) => value.trim(),
            });

            if (parseResult.errors.length > 0) {
                console.warn("CSV parsing warnings:", parseResult.errors);
            }

            const rows = parseResult.data;

            if (!rows || rows.length === 0) {
                setErrorMessage("File is empty or invalid format");
                setUploading(false);
                return;
            }

            // Generate batch ID
            let batchId;
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
            const totalExposure = rows.reduce(
                (sum, row) => sum + (parseFloat(row.plafon) || 0),
                0,
            );
            const totalPremium = rows.reduce(
                (sum, row) => sum + (parseFloat(row.nominal_premi) || 0),
                0,
            );

            // Create or update batch
            if (batchMode === "new") {
                await backend.create("Batch", {
                    batch_id: batchId,
                    batch_month: new Date().getMonth() + 1,
                    batch_year: new Date().getFullYear(),
                    contract_id: selectedContract,
                    total_records: rows.length,
                    total_exposure: totalExposure,
                    total_premium: totalPremium,
                    status: "Uploaded",
                });
            }

            // Create debtors
            for (let i = 0; i < rows.length; i++) {
                try {
                    const row = rows[i];

                    // Parse dates
                    const parseDate = (dateStr) => {
                        if (!dateStr || !dateStr.trim()) return null;
                        const date = new Date(dateStr.trim());
                        return isNaN(date.getTime())
                            ? null
                            : date.toISOString();
                    };

                    const payload = {
                        cover_id: parseInt(row.cover_id) || 0,
                        program_id: row.program_id?.trim() || "",
                        nomor_rekening_pinjaman:
                            row.nomor_rekening_pinjaman?.trim() || "",
                        nomor_peserta: row.nomor_peserta?.trim() || "",
                        loan_type: row.loan_type?.trim() || "",
                        loan_type_desc: row.loan_type_desc?.trim() || "",
                        cif_rekening_pinjaman:
                            row.cif_rekening_pinjaman?.trim() || "",
                        jenis_pengajuan_desc:
                            row.jenis_pengajuan_desc?.trim() || "",
                        jenis_covering_desc:
                            row.jenis_covering_desc?.trim() || "",
                        tanggal_mulai_covering: parseDate(
                            row.tanggal_mulai_covering,
                        ),
                        tanggal_akhir_covering: parseDate(
                            row.tanggal_akhir_covering,
                        ),
                        plafon: parseFloat(row.plafon) || 0,
                        nominal_premi: parseFloat(row.nominal_premi) || 0,
                        premi_percentage: parseFloat(row.premi_percentage) || 0,
                        ric_percentage: parseFloat(row.ric_percentage) || 0,
                        bf_percentage: parseFloat(row.bf_percentage) || 0,
                        net_premi: parseFloat(row.net_premi) || 0,
                        unit_code: row.unit_code?.trim() || "",
                        unit_desc: row.unit_desc?.trim() || "",
                        branch_desc: row.branch_desc?.trim() || "",
                        region_desc: row.region_desc?.trim() || "",
                        nama_peserta: row.nama_peserta?.trim() || "",
                        alamat_usaha: row.alamat_usaha?.trim() || "",
                        nomor_perjanjian_kredit:
                            row.nomor_perjanjian_kredit?.trim() || "",
                        tanggal_terima: parseDate(row.tanggal_terima),
                        tanggal_validasi: parseDate(row.tanggal_validasi),
                        status_aktif: parseInt(row.status_aktif) || 1,
                        remark_premi: row.remark_premi?.trim() || "",
                        flag_restruktur: parseInt(row.flag_restruktur) || 0,
                        kolektabilitas: parseInt(row.kolektabilitas) || 1,
                        contract_id: selectedContract,
                        batch_id: batchId,
                        version_no: 1,
                        status: "SUBMITTED",
                        is_locked: false,
                    };

                    await backend.create("Debtor", payload);
                    uploaded++;
                } catch (rowError) {
                    errors.push(`Row ${i + 2}: ${rowError.message}`);
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
                    new_value: JSON.stringify({ count: rows.length }),
                    user_email: user?.email,
                    user_role: user?.role,
                    reason: `Uploaded ${rows.length} debtors to batch ${batchId}`,
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            // Create notification
            try {
                await backend.create("Notification", {
                    title: "Batch Upload Completed",
                    message: `Successfully uploaded ${uploaded} debtors to batch ${batchId}`,
                    type: "INFO",
                    module: "DEBTOR",
                    reference_id: batchId,
                    target_role: "TUGURE",
                });
            } catch (notifError) {
                console.warn("Failed to create notification:", notifError);
            }

            if (errors.length > 0) {
                setErrorMessage(
                    `Uploaded ${uploaded} debtors. ${errors.length} errors:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? "\n..." : ""}`,
                );
            } else {
                setSuccessMessage(
                    `Successfully uploaded ${uploaded} debtors to batch ${batchId}`,
                );
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
            setErrorMessage(`Upload failed: ${error.message}`);
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
                        user_email: user?.email,
                        user_role: user?.role,
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
        total: debtors.length,
        submitted: debtors.filter((d) => d.status === "SUBMITTED").length,
        approved: debtors.filter((d) => d.status === "APPROVED").length,
        rejected: debtors.filter((d) => d.status === "REJECTED").length,
        conditional: debtors.filter((d) => d.status === "CONDITIONAL").length,
    };

    // Filter debtors
    const filteredDebtors = debtors.filter((debtor) => {
        const contractMatch =
            filters.contract === "all" || debtor.contract_id === filters.contract;
        const batchMatch =
            filters.batch === "all" || !filters.batch || debtor.batch_id === filters.batch;
        const statusMatch =
            filters.status === "all" || debtor.status === filters.status;
        const searchMatch =
            !filters.name ||
            debtor.nama_peserta
                ?.toLowerCase()
                .includes(filters.name.toLowerCase()) ||
            debtor.nomor_peserta
                ?.toLowerCase()
                .includes(filters.name.toLowerCase()) ||
            debtor.batch_id?.toLowerCase().includes(filters.name.toLowerCase());

        return contractMatch && batchMatch && statusMatch && searchMatch;
    });

    // Table columns
    const columns = [
        {
            header: (
                <Checkbox
                    checked={
                        selectedDebtors.length === filteredDebtors.length &&
                        filteredDebtors.length > 0
                    }
                    onCheckedChange={(checked) => {
                        if (checked) {
                            setSelectedDebtors(
                                filteredDebtors.map((d) => d.id),
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
            header: "Submitted",
            accessorKey: "createdAt",
            cell: (row) => (
                <div className="text-sm text-gray-600">
                    {row.createdAt
                        ? new Date(row.createdAt).toLocaleDateString("id-ID")
                        : "-"}
                </div>
            ),
        },
        {
            header: "Note",
            cell: (row) =>
                row.validation_remarks && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            setActionNote(row.validation_remarks);
                            setNoteDialogOpen(true);
                        }}
                    >
                        <FileText className="w-4 h-4" />
                    </Button>
                ),
            width: "80px",
        },
    ];

    const activeContracts = contracts.filter(
        (c) => c.effective_status === "Active",
    );

    // Update userBatches to depend on filters.contract
    const userBatches = batches.filter(
        (b) => filters.contract === "all" || b.contract_id === filters.contract,
    );

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
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            onClick={handleRefresh}
                        >
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

            {errorMessage && (
                <Alert className="border-red-200 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                        {errorMessage}
                    </AlertDescription>
                </Alert>
            )}

            {/* Gradient Card */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <GradientStatCard
                    title="Debtors"
                    value={kpis.total}
                    // subtitle="Total Debtors"
                    // icon={Users}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title="Submitted Debtors"
                    value={kpis.submitted}
                    // subtitle="Total Debtors"
                    // icon={Users}
                    gradient="from-yellow-500 to-yellow-600"
                />
                <GradientStatCard
                    title="Approved Debtors"
                    value={kpis.approved}
                    // subtitle="Total Debtors"
                    // icon={Users}
                    gradient="from-green-500 to-green-600"
                />
                <GradientStatCard
                    title="Rejected Debtors"
                    value={kpis.rejected}
                    // subtitle="Total Debtors"
                    // icon={Users}
                    gradient="from-red-500 to-red-600"
                />
                <GradientStatCard
                    title="Conditional Debtors"
                    value={kpis.conditional}
                    // subtitle="Total Debtors"
                    // icon={Users}
                    gradient="from-orange-500 to-orange-600"
                />
            </div>

            {/* Filters */}
            <FilterTab
                filters={filters}
                onFilterChange={setFilters}
                defaultFilters={{
                    contract: "all",
                    batch: "",
                    status: "all",
                    name: "",
                }}
                filterConfig={[
                    {
                        key: "contract",
                        placeholder: "Contract",
                        options: [
                            { value: "all", label: "All Contracts"},
                            ...contracts.map((c) => ({
                                value: c.contract_id,
                                label: c.contract_id
                            })),
                        ],
                    },
                    {
                        key: "batch",
                        placeholder: "Batch",
                        options: [
                            { value: "all", label: "All Batches"},
                            ...userBatches.map((b) => ({
                                value: b.batch_id,
                                label: `${b.batch_id} - ${b.status}`
                            })),
                        ],
                    },
                    {
                        key: "status",
                        placeholder: "Status",
                        options: [
                            { value: "all", label: "All Status"},
                            { value: "SUBMITTED", label: "Submitted"},
                            { value: "APPROVED", label: "Approved"},
                            { value: "REJECTED", label: "Rejected"},
                            { value: "CONDITIONAL", label: "Conditional"},
                        ]
                    },
                    {
                        key: "name",
                        placeholder: "Search",
                        type: "input",
                        // inputType: 
                    }
                ]}

            />

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
                {selectedDebtors.length >= 0 && (
                    <>
                        <Button
                            variant="outline"
                            onClick={() => 
                                setRevisionDialogOpen(true)}
                        >
                        <Pen className="w-4 h-4 mr-2" />
                            Revision {selectedDebtors.length > 0 ? `(${selectedDebtors.length})` : ""}
                        </Button>
                        {/* <Button>
                            variant="outline"
                            onClick={}
                        </Button> */}
                        
                        {/* <Button
                            variant="outline"
                            onClick={() => setSelectedDebtors([])}
                        >
                            Clear Selection
                        </Button> */}
                    </>
                )}
            </div>

            {/* Data Table */}
            <div>
                <DataTable
                    columns={columns}
                    data={filteredDebtors}
                    isLoading={loading}
                    emptyMessage="No debtors found. Upload your first batch to get started."
                />
            </div>

            {/* Upload Dialog */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Upload Debtors</DialogTitle>
                        <DialogDescription>
                            Upload a CSV file containing debtor information
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Select Contract *</Label>
                            <Select
                                value={selectedContract}
                                onValueChange={setSelectedContract}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select contract" />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeContracts.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.contract_id} - {c.policy_no}
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
                                        {userBatches.map((b) => (
                                            <SelectItem
                                                key={b.id}
                                                value={b.batch_id}
                                            >
                                                {b.batch_id} - {b.status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                    </div>

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

                    <DialogFooter>
                        <Button onClick={() => setNoteDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
