import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
    FileText,
    CheckCircle2,
    Clock,
    Eye,
    Download,
    Filter,
    RefreshCw,
    Check,
    X,
    AlertCircle,
    Loader2,
    ArrowRight,
    DollarSign,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";
import { backend } from "@/api/backendClient";
import { formatRupiahAdaptive } from "@/utils/currency";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";

export default function BorderoManagement() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState("debtors");
    const [debtors, setDebtors] = useState([]);
    const [batches, setBatches] = useState([]);
    const [borderos, setBorderos] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [claims, setClaims] = useState([]);
    const [subrogations, setSubrogations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [actionType, setActionType] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [filters, setFilters] = useState({
        contract: "all",
        batch: "",
        submitStatus: "all",
        reconStatus: "all",
        claimStatus: "all",
        subrogationStatus: "all",
        startDate: "",
        endDate: "",
    });

    const { bypassAuth } = useAuth();
    const useBackendApi = import.meta.env.VITE_USE_BACKEND_API === "true";

    useEffect(() => {
        if (bypassAuth && !useBackendApi) {
            setLoading(false);
            return;
        }
        if (!bypassAuth) {
            loadUser();
        }
        loadData();
    }, []);

    const loadUser = () => {
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
            // Ambil semua data dari backend
            const [
                debtorData,
                borderoData,
                contractData,
                claimData,
                subrogationData,
            ] = await Promise.all([
                backend.list("Debtor"),
                backend.list("Bordero"),
                backend.list("Contract"),
                backend.list("Claim"),
                backend.list("Subrogation"),
            ]);

            // Pastikan data adalah array
            const safeDebtorData = Array.isArray(debtorData) ? debtorData : [];
            const safeBorderoData = Array.isArray(borderoData)
                ? borderoData
                : [];
            const safeContractData = Array.isArray(contractData)
                ? contractData
                : [];
            const safeClaimData = Array.isArray(claimData) ? claimData : [];
            const safeSubrogationData = Array.isArray(subrogationData)
                ? subrogationData
                : [];

            // Hitung total untuk setiap bordero dari debtors
            const borderoDataWithCalculatedTotals = safeBorderoData.map(
                (bordero) => {
                    // Filter debtors yang terkait dengan bordero ini
                    const relatedDebtors = safeDebtorData.filter(
                        (debtor) =>
                            debtor.contract_id === bordero.contract_id &&
                            debtor.batch_id === bordero.batch_id &&
                            debtor.status === "APPROVED",
                    );

                    // Hitung totals
                    const totalDebtors = relatedDebtors.length;
                    const totalExposure = relatedDebtors.reduce(
                        (sum, debtor) => sum + (parseFloat(debtor.plafon) || 0),
                        0,
                    );
                    const totalPremium = relatedDebtors.reduce(
                        (sum, debtor) =>
                            sum + (parseFloat(debtor.net_premi) || 0),
                        0,
                    );

                    return {
                        ...bordero,
                        total_debtors: totalDebtors,
                        total_exposure: totalExposure,
                        total_premium: totalPremium,
                    };
                },
            );

            setDebtors(safeDebtorData);
            setBorderos(borderoDataWithCalculatedTotals);
            setContracts(safeContractData);
            setClaims(safeClaimData);
            setSubrogations(safeSubrogationData);

            console.log("Loaded data:", {
                debtors: safeDebtorData.length,
                borderos: borderoDataWithCalculatedTotals.length,
                claims: safeClaimData.length,
                subrogations: safeSubrogationData.length,
            });
        } catch (error) {
            console.error("Failed to load data:", error);
            // Set default empty arrays
            setDebtors([]);
            setBorderos([]);
            setContracts([]);
            setClaims([]);
            setSubrogations([]);
        }
        setLoading(false);
    };

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
    };

    const handleExportExcel = () => {
        let data = [];
        let headers = [];
        let sourceData = [];
        if (activeTab === "debtors") {
            sourceData =
                selectedItems.length > 0
                    ? filteredDebtors.filter((d) =>
                          selectedItems.includes(d.id),
                      )
                    : filteredDebtors;
            headers = [
                "Debtor",
                "Batch",
                "Plafond",
                "Net Premi",
                "Status",
            ];
            data = sourceData.map((d) => [
                d.nama_peserta,
                d.batch_id,
                d.plafon,
                d.net_premi,
                d.status,
            ]);
        } else if (activeTab === "borderos") {
            sourceData =
                selectedItems.length > 0
                    ? borderos.filter((b) =>
                          selectedItems.includes(b.id),
                      )
                    : borderos;
            headers = [
                "Bordero ID",
                "Period",
                "Total Debtors",
                "Total Exposure",
                "Total Premium",
                "Status",
            ];
            data = sourceData.map((b) => [
                b.bordero_id,
                b.period,
                b.total_debtors,
                b.total_exposure,
                b.total_premium,
                b.status,
            ]);
        } else if (activeTab === "claims") {
            sourceData = filteredClaims;
            headers = [
                "Claim No",
                "Debtor",
                "DOL",
                "Claim Amount",
                "Status",
            ];
            data = sourceData.map((c) => [
                c.claim_no,
                c.nama_tertanggung,
                c.dol,
                c.nilai_klaim,
                c.claim_status,
            ]);
        } else if (activeTab === "subrogation") {
            sourceData = filteredSubrogations;
            headers = [
                "Subrogation ID",
                "Claim ID",
                "Recovery Amount",
                "Recovery Date",
                "Status",
            ];
            data = sourceData.map((s) => [
                s.subrogation_id,
                s.claim_id,
                s.recovery_amount,
                s.recovery_date,
                s.status,
            ]);
        }
        const csv = [
            headers.join(","),
            ...data.map((row) => row.join(",")),
        ].join("\n");
        const blob = new Blob([csv], {
            type: "text/csv",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bordero-${activeTab}-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    }

    const clearFilters = () => {
        setFilters({
            contract: "all",
            batch: "",
            submitStatus: "all",
            reconStatus: "all",
            claimStatus: "all",
            subrogationStatus: "all",
            startDate: "",
            endDate: "",
        });
    };

    const openDetailDialog = (item) => {
        setSelectedItem(item);
        setShowDetailDialog(true);
    };

    const getNextBorderoStatus = (currentStatus) => {
        const workflow = ["GENERATED", "UNDER_REVIEW", "FINAL"];
        const idx = workflow.indexOf(currentStatus);
        return idx >= 0 && idx < workflow.length - 1 ? workflow[idx + 1] : null;
    };

    const handleBorderoAction = async () => {
        if (!selectedItem) return;

        setProcessing(true);
        try {
            const nextStatus = getNextBorderoStatus(selectedItem.status);
            if (!nextStatus) {
                setProcessing(false);
                return;
            }

            const updateData = {
                status: nextStatus,
                [nextStatus === "UNDER_REVIEW"
                    ? "reviewed_by"
                    : "finalized_by"]: user?.email,
                [nextStatus === "UNDER_REVIEW"
                    ? "reviewed_date"
                    : "finalized_date"]: new Date().toISOString().split("T")[0],
            };

            // Update bordero di database melalui backend
            await backend.update("Bordero", selectedItem.id, updateData);

            setSuccessMessage(
                `Bordero ${selectedItem.bordero_id} moved to ${nextStatus}`,
            );
            setShowActionDialog(false);
            setSelectedItem(null);

            // Reload data untuk update UI
            loadData();
        } catch (error) {
            console.error("Bordero action error:", error);
        }
        setProcessing(false);
    };

    // Filter per tab based on workflow status
    const getTabDebtors = () => {
        let filtered = debtors.filter((d) => {
            if (filters.contract !== "all" && d.contract_id !== filters.contract) return false;
            if (filters.batch && !d.batch_id?.includes(filters.batch)) return false;
            // Filter global berdasarkan submitStatus jika ada
            if (filters.submitStatus !== "all" && d.status !== filters.submitStatus) return false;
            if (filters.startDate && d.created_date < filters.startDate) return false;
            if (filters.endDate && d.created_date > filters.endDate) return false;
            return true;
        });

        // Apply tab-specific filters
        if (activeTab === "debtors") {
            // Allow all statuses if filtered, otherwise default behavior (or just return filtered)
            // The user requested "filtering based on submit status", so we return the filtered list directly.
            return filtered;
        } else if (activeTab === "exposure") {
            // Exposure usually implies Approved, but if user filters, we should probably respect it?
            // For now, let's keep Exposure strictly Approved as it implies risk calculation on valid policies.
            // But if the user filters by "SUBMITTED", this tab might end up empty, which is correct.
            return filtered.filter((d) => d.status === "APPROVED");
        } else if (activeTab === "borderos") {
            // Handled separately
            return filtered;
        }
        return filtered;
    };

    const filteredDebtors = getTabDebtors();

    // Use filteredDebtors for KPIs to ensure they match the table and filter selection
    const kpiDebtors = filteredDebtors;

    const filteredClaims = claims.filter((c) => {
        if (
            filters.claimStatus !== "all" &&
            c.claim_status !== filters.claimStatus
        )
            return false;
        if (filters.startDate && c.created_date < filters.startDate)
            return false;
        if (filters.endDate && c.created_date > filters.endDate) return false;
        return true;
    });

    const filteredSubrogations = subrogations.filter((s) => {
        if (
            filters.subrogationStatus !== "all" &&
            s.status !== filters.subrogationStatus
        )
            return false;
        if (filters.startDate && s.created_date < filters.startDate)
            return false;
        if (filters.endDate && s.created_date > filters.endDate) return false;
        return true;
    });

    const toggleItemSelection = (itemId) => {
        if (selectedItems.includes(itemId)) {
            setSelectedItems(selectedItems.filter((id) => id !== itemId));
        } else {
            setSelectedItems([...selectedItems, itemId]);
        }
    };

    const debtorColumns = [
        {
            header: (
                <Checkbox
                    checked={
                        selectedItems.length === filteredDebtors.length &&
                        filteredDebtors.length > 0
                    }
                    onCheckedChange={(checked) => {
                        if (checked) {
                            setSelectedItems(filteredDebtors.map((d) => d.id));
                        } else {
                            setSelectedItems([]);
                        }
                    }}
                />
            ),
            cell: (row) => (
                <Checkbox
                    checked={selectedItems.includes(row.id)}
                    onCheckedChange={() => toggleItemSelection(row.id)}
                />
            ),
            width: "40px",
        },
        {
            header: "Debtor",
            cell: (row) => (
                <div>
                    <p className="font-medium">{row.nama_peserta}</p>
                    <p className="text-sm text-gray-500">{row.nomor_peserta}</p>
                </div>
            ),
        },
        {
            header: "Batch",
            accessorKey: "batch_id",
            cell: (row) => (
                <span className="font-mono text-sm">{row.batch_id}</span>
            ),
        },
        { header: "Plafond", cell: (row) => formatRupiahAdaptive(row.plafon) },
        {
            header: "Net Premi",
            cell: (row) => formatRupiahAdaptive(row.net_premi),
        },
        {
            header: "Status",
            cell: (row) => <StatusBadge status={row.status} />,
        },
        {
            header: "Actions",
            cell: (row) => (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDetailDialog(row)}
                >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                </Button>
            ),
        },
    ];

    const borderoColumns = [
        {
            header: (
                <Checkbox
                    checked={
                        selectedItems.length === borderos.length &&
                        borderos.length > 0
                    }
                    onCheckedChange={(checked) => {
                        if (checked) {
                            setSelectedItems(borderos.map((b) => b.id));
                        } else {
                            setSelectedItems([]);
                        }
                    }}
                />
            ),
            cell: (row) => (
                <Checkbox
                    checked={selectedItems.includes(row.id)}
                    onCheckedChange={() => toggleItemSelection(row.id)}
                />
            ),
            width: "40px",
        },
        { header: "Bordero ID", accessorKey: "bordero_id" },
        { header: "Period", accessorKey: "period" },
        { header: "Total Debtors", accessorKey: "total_debtors" },
        {
            header: "Total Exposure",
            cell: (row) =>
                `Rp ${(row.total_exposure || 0).toLocaleString("id-ID")}`,
        },
        {
            header: "Total Premium",
            cell: (row) =>
                `Rp ${(row.total_premium || 0).toLocaleString("id-ID")}`,
        },
        {
            header: "Status",
            cell: (row) => <StatusBadge status={row.status} />,
        },
        {
            header: "Actions",
            cell: (row) => (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetailDialog(row)}
                    >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                    </Button>
                    {row.status !== "FINAL" &&
                        getNextBorderoStatus(row.status) && (
                            <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => {
                                    setSelectedItem(row);
                                    setActionType(
                                        getNextBorderoStatus(row.status),
                                    );
                                    setShowActionDialog(true);
                                }}
                            >
                                <ArrowRight className="w-4 h-4 mr-1" />
                                {getNextBorderoStatus(row.status)}
                            </Button>
                        )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Bordero Management"
                subtitle="View debtors, exposure, bordero, claims, and process status"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Bordero Management" },
                ]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={loadData}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                        <Button
                            // className="bg-green-600 hover:bg-green-700 text-white"
                            variant="outline"
                            onClick={handleExportExcel}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export Excel
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

            {/* Bordero Action Dialog */}
            <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move Bordero to {actionType}</DialogTitle>
                        <DialogDescription>
                            Update bordero {selectedItem?.bordero_id} status
                            from {selectedItem?.status} to {actionType}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Period:</span>
                                <span className="font-medium">
                                    {selectedItem?.period}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">
                                    Total Debtors:
                                </span>
                                <span className="font-medium">
                                    {selectedItem?.total_debtors}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">
                                    Total Premium:
                                </span>
                                <span className="font-medium">
                                    {formatRupiahAdaptive(
                                        selectedItem?.total_premium,
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowActionDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleBorderoAction}
                            disabled={processing}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <ArrowRight className="w-4 h-4 mr-2" />
                                    Confirm
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Gradient Card */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <GradientStatCard
                    title="Total Debtors"
                    value={kpiDebtors.length}
                    subtitle={`${debtors.length} total • ${debtors.filter(
                        (d) => d.status === "SUBMITTED",
                    ).length} pending`}
                    icon={FileText}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title="Borderos"
                    value={borderos.length}
                    subtitle={`${borderos.filter(
                        (b) => b.status === "FINAL",
                    ).length} finalized`}
                    icon={FileText}
                    gradient="from-purple-500 to-purple-600"
                />
                <GradientStatCard
                    title="Total Premi"
                    value={formatRupiahAdaptive(kpiDebtors.reduce((sum, debtor) => {
                        const netPremi = parseFloat(debtor.net_premi) || 0;
                        return sum + netPremi;
                    }, 0))}
                    subtitle="IDR"
                    icon={DollarSign}
                    gradient="from-green-500 to-green-600"
                />
                <GradientStatCard
                    title="Total Claims"
                    value={claims.length}
                    subtitle="All statuses"
                    icon={AlertCircle}
                    gradient="from-orange-500 to-orange-600"
                />
                <GradientStatCard
                    title="Subrogrations"
                    value={subrogations.length}
                    subtitle="Recovery cases"
                    icon={RefreshCw}
                    gradient="from-teal-500 to-teal-600"
                />
            </div>

            {/* Filters */}
            <FilterTab
                filters = {filters}
                onFilterChange={setFilters}
                defaultFilters={{
                    contract: "all",
                    batch: "",
                    submitStatus: "all",
                    reconStatus: "all",
                    claimStatus: "all",
                    subrogationStatus: "all",
                    startDate: "",
                    endDate: "",
                }}
                filterConfig={[
                    {
                        key: "batch",
                        placeholder: "Batch ID",
                        type: "input",
                        inputType: "text"
                    },
                    {
                        key: "startDate",
                        placeholder: "Start Date",
                        type: "date",
                    },
                    {
                        key: "endDate",
                        placeholder: "End Date",
                        type: "date",
                    },
                    {
                        key:"submitStatus",
                        placeholder: "Submit Status",
                        options: [
                            { value: "all", label: "All"},
                            { value: "DRAFT", label: "Draft"},
                            { value: "SUBMITTED", label: "Submitted"},
                            { value: "APPROVED", label: "Approved"},
                            { value: "REJECTED", label: "Rejected"},
                        ]
                    },
                    {
                        key: "reconStatus",
                        placeholder: "All Status",
                        options: [
                            { value: "all", label: "All"},
                            { value: "IN_PROGRESS", label: "In Progress"},
                            { value: "EXCEPTION", label: "Exception"},
                            { value: "CLOSED", label: "Closed"}
                        ]
                    }
                ]}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="debtors">
                        <FileText className="w-4 h-4 mr-2" />
                        Debtors ({filteredDebtors.length})
                    </TabsTrigger>
                    <TabsTrigger value="exposure">
                        <FileText className="w-4 h-4 mr-2" />
                        Exposure Data
                    </TabsTrigger>
                    <TabsTrigger value="borderos">
                        <FileText className="w-4 h-4 mr-2" />
                        Borderos ({borderos.length})
                    </TabsTrigger>
                    <TabsTrigger value="claims">
                        <FileText className="w-4 h-4 mr-2" />
                        Claims ({filteredClaims.length})
                    </TabsTrigger>
                    <TabsTrigger value="subrogation">
                        <FileText className="w-4 h-4 mr-2" />
                        Subrogation ({filteredSubrogations.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="debtors" className="mt-4">
                    <DataTable
                        columns={debtorColumns}
                        data={filteredDebtors}
                        isLoading={loading}
                        emptyMessage="No debtors found"
                    />
                </TabsContent>

                <TabsContent value="exposure" className="mt-4">
                    <DataTable
                        columns={[
                            {
                                header: "Debtor",
                                cell: (row) => row.nama_peserta,
                            },
                            {
                                header: "Plafond",
                                cell: (row) => formatRupiahAdaptive(row.plafon),
                            },
                            {
                                header: "Net Premi",
                                cell: (row) =>
                                    formatRupiahAdaptive(row.net_premi),
                            },
                            {
                                header: "Status",
                                cell: (row) => (
                                    <StatusBadge status={row.status} />
                                ),
                            },
                        ]}
                        data={filteredDebtors.filter(
                            (d) => d.status === "APPROVED",
                        )}
                        isLoading={loading}
                        emptyMessage="No exposure data"
                    />
                </TabsContent>

                <TabsContent value="borderos" className="mt-4">
                    {borderos.length === 0 ? (
                        <Alert className="bg-blue-50 border-blue-200">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                                No borderos yet. Borderos are auto-generated
                                when a Batch reaches "Approved" status in Batch
                                Processing.
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    <DataTable
                        columns={borderoColumns}
                        data={borderos}
                        isLoading={loading}
                        emptyMessage="No borderos generated yet"
                    />
                </TabsContent>

                <TabsContent value="claims" className="mt-4">
                    <DataTable
                        columns={[
                            { header: "Claim No", accessorKey: "claim_no" },
                            {
                                header: "Debtor",
                                cell: (row) => row.nama_tertanggung,
                            },
                            { header: "Policy No", accessorKey: "policy_no" },
                            { header: "DOL", accessorKey: "dol" },
                            {
                                header: "Claim Amount",
                                cell: (row) =>
                                    `IDR ${(row.nilai_klaim || 0).toLocaleString()}`,
                            },
                            {
                                header: "Status",
                                cell: (row) => (
                                    <StatusBadge status={row.claim_status} />
                                ),
                            },
                            {
                                header: "Actions",
                                cell: () => (
                                    <Button variant="outline" size="sm">
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                ),
                            },
                        ]}
                        data={filteredClaims}
                        isLoading={loading}
                        emptyMessage="No claims found"
                    />
                </TabsContent>

                <TabsContent value="subrogation" className="mt-4">
                    <DataTable
                        columns={[
                            {
                                header: "Subrogation ID",
                                accessorKey: "subrogation_id",
                            },
                            { header: "Claim ID", accessorKey: "claim_id" },
                            { header: "Debtor ID", accessorKey: "debtor_id" },
                            {
                                header: "Recovery Amount",
                                cell: (row) =>
                                    `IDR ${(row.recovery_amount || 0).toLocaleString()}`,
                            },
                            {
                                header: "Recovery Date",
                                accessorKey: "recovery_date",
                            },
                            {
                                header: "Status",
                                cell: (row) => (
                                    <StatusBadge status={row.status} />
                                ),
                            },
                            {
                                header: "Actions",
                                cell: () => (
                                    <Button variant="outline" size="sm">
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                ),
                            },
                        ]}
                        data={filteredSubrogations}
                        isLoading={loading}
                        emptyMessage="No subrogation records found"
                    />
                </TabsContent>
            </Tabs>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {activeTab === "debtors" && "Debtor Detail"}
                            {activeTab === "borderos" && "Bordero Detail"}
                            {activeTab === "claims" && "Claim Detail"}
                            {activeTab === "subrogations" &&
                                "Subrogation Detail"}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedItem && (
                        <div className="space-y-4">
                            {activeTab === "debtors" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-gray-500">
                                            Nama Peserta
                                        </Label>
                                        <p className="font-medium">
                                            {selectedItem.nama_peserta}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Batch ID
                                        </Label>
                                        <p className="font-medium">
                                            {selectedItem.batch_id}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Plafond
                                        </Label>
                                        <p className="font-medium">
                                            {formatRupiahAdaptive(
                                                selectedItem.plafon,
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Nominal Premi
                                        </Label>
                                        <p className="font-medium">
                                            {formatRupiahAdaptive(
                                                selectedItem.nominal_premi,
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Net Premi
                                        </Label>
                                        <p className="font-medium">
                                            {formatRupiahAdaptive(
                                                selectedItem.net_premi,
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Status
                                        </Label>
                                        <StatusBadge
                                            status={selectedItem.status}
                                        />
                                    </div>
                                </div>
                            )}
                            {activeTab === "borderos" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-gray-500">
                                            Bordero ID
                                        </Label>
                                        <p className="font-medium">
                                            {selectedItem.bordero_id}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Period
                                        </Label>
                                        <p className="font-medium">
                                            {selectedItem.period}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Total Debtors
                                        </Label>
                                        <p className="font-medium">
                                            {selectedItem.total_debtors}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Total Exposure
                                        </Label>
                                        <p className="font-medium">
                                            IDR{" "}
                                            {(
                                                selectedItem.total_exposure || 0
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Total Premium
                                        </Label>
                                        <p className="font-medium">
                                            IDR{" "}
                                            {(
                                                selectedItem.total_premium || 0
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Status
                                        </Label>
                                        <StatusBadge
                                            status={selectedItem.status}
                                        />
                                    </div>
                                </div>
                            )}
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
