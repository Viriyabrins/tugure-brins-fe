import React, { useState, useEffect, useRef } from "react";
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
import { useKeycloakAuth } from "@/lib/KeycloakContext";
import { backend } from "@/api/backendClient";
import { formatRupiahAdaptive } from "@/utils/currency";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";

const defaultFilter = {
    contract: "all",
    batch: "",
    branch_desc: "",
    region_desc: "",
    submitStatus: "all",
    reconStatus: "all",
    claimStatus: "all",
    subrogationStatus: "all",
    startDate: "",
    endDate: "",
    period: ""
}

export default function BorderoManagement() {
    const { user } = useKeycloakAuth();
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
    const [filters, setFilters] = useState(defaultFilter);

    // Pagination state
    const pageSize = 10;

    // Debtor pagination
    const [debtorPage, setDebtorPage] = useState(1);
    const [totalDebtors, setTotalDebtors] = useState(0);
    const isFirstDebtorPageEffect = useRef(true);

    // Bordero pagination
    const [borderoPage, setBorderoPage] = useState(1);
    const [totalBorderos, setTotalBorderos] = useState(0);
    const isFirstBorderoPageEffect = useRef(true);

    // Claim pagination
    const [claimPage, setClaimPage] = useState(1);
    const [totalClaims, setTotalClaims] = useState(0);
    const isFirstClaimPageEffect = useRef(true);

    // Contract pagination
    const [contractPage, setContractPage] = useState(1);
    const [totalContracts, setTotalContracts] = useState(0);
    const isFirstContractPageEffect = useRef(true);

    useEffect(() => {
        loadDebtors(1, filters);
        loadBorderos(1, filters);
        loadClaims(1, filters);
        loadContracts(1);
        loadSubrogations();
    }, []);

    // --- Load functions with server-side pagination ---

    const loadDebtors = async (pageToLoad = debtorPage, activeFilters = filters) => {
        setLoading(true);
        try {
            const query = { page: pageToLoad, limit: pageSize };
            if (activeFilters) query.q = JSON.stringify(activeFilters);
            const result = await backend.listPaginated("Debtor", query);
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

    const loadBorderos = async (pageToLoad = borderoPage, activeFilters = filters) => {
        try {
            const query = { page: pageToLoad, limit: pageSize };
            if (activeFilters?.period) query.q = JSON.stringify({ period: activeFilters.period });
            const result = await backend.listPaginated("Bordero", query);
            setBorderos(Array.isArray(result.data) ? result.data : []);
            setTotalBorderos(Number(result.pagination?.total) || 0);
        } catch (error) {
            console.error("Error loading borderos:", error);
            setBorderos([]);
            setTotalBorderos(0);
        }
    };

    const loadClaims = async (pageToLoad = claimPage, activeFilters = filters) => {
        try {
            const query = { page: pageToLoad, limit: pageSize };
            if (activeFilters) query.q = JSON.stringify({ claimStatus: activeFilters.claimStatus, startDate: activeFilters.startDate, endDate: activeFilters.endDate });
            const result = await backend.listPaginated("Claim", query);
            setClaims(Array.isArray(result.data) ? result.data : []);
            setTotalClaims(Number(result.pagination?.total) || 0);
        } catch (error) {
            console.error("Error loading claims:", error);
            setClaims([]);
            setTotalClaims(0);
        }
    };

    const loadContracts = async (pageToLoad = contractPage) => {
        try {
            const query = { page: pageToLoad, limit: pageSize };
            const result = await backend.listPaginated("Contract", query);
            setContracts(Array.isArray(result.data) ? result.data : []);
            setTotalContracts(Number(result.pagination?.total) || 0);
        } catch (error) {
            console.error("Error loading contracts:", error);
            setContracts([]);
            setTotalContracts(0);
        }
    };

    const loadSubrogations = async () => {
        try {
            const data = await backend.list("Subrogation");
            setSubrogations(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading subrogations:", error);
            setSubrogations([]);
        }
    };

    // --- Pagination computed values ---

    // Debtor pagination
    const debtorTotal = totalDebtors;
    const debtorTotalPages = Math.max(1, Math.ceil(debtorTotal / pageSize));
    const debtorFrom = debtorTotal === 0 ? 0 : (debtorPage - 1) * pageSize + 1;
    const debtorTo = Math.min(debtorTotal, debtorPage * pageSize);

    // Bordero pagination
    const borderoTotal = totalBorderos;
    const borderoTotalPages = Math.max(1, Math.ceil(borderoTotal / pageSize));
    const borderoFrom = borderoTotal === 0 ? 0 : (borderoPage - 1) * pageSize + 1;
    const borderoTo = Math.min(borderoTotal, borderoPage * pageSize);

    // Claim pagination
    const claimTotal = totalClaims;
    const claimTotalPages = Math.max(1, Math.ceil(claimTotal / pageSize));
    const claimFrom = claimTotal === 0 ? 0 : (claimPage - 1) * pageSize + 1;
    const claimTo = Math.min(claimTotal, claimPage * pageSize);

    // --- Filter change effects ---

    // Debtor: reset page when filters change
    useEffect(() => {
        setSelectedItems([]);
        if (debtorPage !== 1) {
            setDebtorPage(1);
            return;
        }
        loadDebtors(1, filters);
    }, [
        filters.contract, filters.batch, filters.branch_desc,
        filters.region_desc, filters.submitStatus,
        filters.startDate, filters.endDate,
    ]);

    useEffect(() => {
        if (isFirstDebtorPageEffect.current) { isFirstDebtorPageEffect.current = false; return; }
        setSelectedItems([]);
        loadDebtors(debtorPage, filters);
    }, [debtorPage]);

    useEffect(() => {
        if (debtorPage > debtorTotalPages) setDebtorPage(debtorTotalPages);
    }, [debtorTotalPages]);

    // Bordero: reset page when filters change
    useEffect(() => {
        if (borderoPage !== 1) { setBorderoPage(1); return; }
        loadBorderos(1, filters);
    }, [filters.period]);

    useEffect(() => {
        if (isFirstBorderoPageEffect.current) { isFirstBorderoPageEffect.current = false; return; }
        loadBorderos(borderoPage, filters);
    }, [borderoPage]);

    useEffect(() => {
        if (borderoPage > borderoTotalPages) setBorderoPage(borderoTotalPages);
    }, [borderoTotalPages]);

    // Claim: reset page when filters change
    useEffect(() => {
        if (claimPage !== 1) { setClaimPage(1); return; }
        loadClaims(1, filters);
    }, [filters.claimStatus, filters.startDate, filters.endDate]);

    useEffect(() => {
        if (isFirstClaimPageEffect.current) { isFirstClaimPageEffect.current = false; return; }
        loadClaims(claimPage, filters);
    }, [claimPage]);

    useEffect(() => {
        if (claimPage > claimTotalPages) setClaimPage(claimTotalPages);
    }, [claimTotalPages]);

    // Contract: page change
    useEffect(() => {
        if (isFirstContractPageEffect.current) { isFirstContractPageEffect.current = false; return; }
        loadContracts(contractPage);
    }, [contractPage]);

    const handleExportExcel = () => {
        let data = [];
        let headers = [];
        let sourceData = [];
        if (activeTab === "debtors") { //Export Debtors
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
        } else if (activeTab === "borderos") { //Export Borderos
            sourceData =
                selectedItems.length > 0
                    ? filteredBorderos.filter((b) =>
                          selectedItems.includes(b.id),
                      )
                    : filteredBorderos;
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
        } else if (activeTab === "claims") { //Export Claims
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
        } else if (activeTab === "subrogation") { //Export Subrogation
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

            // Reload borderos to update UI
            loadBorderos(borderoPage, filters);
        } catch (error) {
            console.error("Bordero action error:", error);
        }
        setProcessing(false);
    };

    // All entities are now loaded via server-side pagination
    const filteredDebtors = debtors;
    const filteredBorderos = borderos;
    const filteredClaims = claims;

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
            header: "Debtor",
            cell: (row) => (
                <div>
                    <p className="font-medium">{row.nama_peserta}</p>
                    <p className="text-sm text-gray-500">{row.nomor_peserta}</p>
                </div>
            ),
        },
        {
            header: "Branch",
            accessorKey: "branch_desc",
            cell: (row) => (
                <span className="text-sm">{row.branch_desc}</span>
            )
        },
        {
            header: "Region",
            accessorKey: "region_desc",
            cell: (row) => (
                <span className="text-sm">{row.region_desc}</span>
            )
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
                </Button>
            ),
        },
    ];

    const borderoColumns = [
        { header: "Bordero ID", accessorKey: "bordero_id" },
        { header: "Period", accessorKey: "period" },
        { header: "Total Debtors", accessorKey: "total_debtors" },
        // {
        //     header: "Plafond",
        //     cell: (row) => formatRupiahAdaptive(row.plafon)
        // },
        {
            header: "Exposure",
            cell: (row) => formatRupiahAdaptive(row.total_exposure)
        },
        {
            header: "Total Premium",
            cell: (row) => formatRupiahAdaptive(row.total_premium),
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
                    </Button>
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
                        <Button variant="outline" onClick={() => { loadDebtors(debtorPage, filters); loadBorderos(borderoPage, filters); loadClaims(claimPage, filters); loadContracts(contractPage); loadSubrogations(); }}>
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

            {/* KPI Card */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {activeTab === "debtors" && (<>
                    <GradientStatCard
                        title="Total Debtors"
                        value={totalDebtors}
                        subtitle={`Showing ${filteredDebtors.length} of ${totalDebtors}`}
                        icon={FileText}
                        gradient="from-blue-500 to-blue-600"
                    />
                    <GradientStatCard
                        title="Borderos"
                        value={filteredBorderos.length}
                        subtitle={`${filteredBorderos.filter(
                            (b) => b.status === "FINAL",
                        ).length} finalized`}
                        icon={FileText}
                        gradient="from-purple-500 to-purple-600"
                    />
                    <GradientStatCard
                        title="Total Premi"
                        value={formatRupiahAdaptive(filteredDebtors.reduce((sum, debtor) => {
                            const netPremi = parseFloat(debtor.net_premi) || 0;
                            return sum + netPremi;
                        }, 0))}
                        subtitle="Current page"
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
                </>)}
                {activeTab === "borderos" && (<>
                    <GradientStatCard title="Total Debtors" value={totalDebtors} subtitle={`Showing ${filteredDebtors.length} of ${totalDebtors}`} icon={FileText} gradient="from-blue-500 to-blue-600"/>
                    <GradientStatCard title="Borderos" value={borderos.length} subtitle={`${borderos.filter( (b) => b.status === "FINAL",).length} finalized`} icon={FileText} gradient="from-purple-500 to-purple-600"/>
                    <GradientStatCard title="Total Premi" value={formatRupiahAdaptive(filteredBorderos.reduce((sum, bordero) => { const netPremi = parseFloat(bordero.total_premium) || 0; return sum + netPremi;}, 0))} subtitle="Current page" icon={DollarSign} gradient="from-green-500 to-green-600"/>
                    <GradientStatCard title="Total Claims" value={claims.length}subtitle="All statuses"icon={AlertCircle}gradient="from-orange-500 to-orange-600"/>
                    <GradientStatCard title="Subrogrations"value={subrogations.length}subtitle="Recovery cases"icon={RefreshCw}gradient="from-teal-500 to-teal-600"/>
                </>)}
                {activeTab === "claims" && (<>
                    <GradientStatCard title="Total Debtors" value={totalDebtors} subtitle={`Showing ${filteredDebtors.length} of ${totalDebtors}`} icon={FileText} gradient="from-blue-500 to-blue-600"/>
                    <GradientStatCard title="Borderos" value={borderos.length} subtitle={`${borderos.filter( (b) => b.status === "FINAL",).length} finalized`} icon={FileText} gradient="from-purple-500 to-purple-600"/>
                    <GradientStatCard title="Total Premi" value={formatRupiahAdaptive(filteredDebtors.reduce((sum, debtor) => { const netPremi = parseFloat(debtor.net_premi) || 0; return sum + netPremi;}, 0))} subtitle="Current page" icon={DollarSign} gradient="from-green-500 to-green-600"/>
                    <GradientStatCard title="Total Claims" value={claims.length}subtitle="All statuses"icon={AlertCircle}gradient="from-orange-500 to-orange-600"/>
                    <GradientStatCard title="Subrogrations"value={subrogations.length}subtitle="Recovery cases"icon={RefreshCw}gradient="from-teal-500 to-teal-600"/>
                </>)}
                {activeTab === "subrogation" && (<>
                    <GradientStatCard title="Total Debtors" value={totalDebtors} subtitle={`Showing ${filteredDebtors.length} of ${totalDebtors}`} icon={FileText} gradient="from-blue-500 to-blue-600"/>
                    <GradientStatCard title="Borderos" value={borderos.length} subtitle={`${borderos.filter( (b) => b.status === "FINAL",).length} finalized`} icon={FileText} gradient="from-purple-500 to-purple-600"/>
                    <GradientStatCard title="Total Premi" value={formatRupiahAdaptive(filteredDebtors.reduce((sum, debtor) => { const netPremi = parseFloat(debtor.net_premi) || 0; return sum + netPremi;}, 0))} subtitle="Current page" icon={DollarSign} gradient="from-green-500 to-green-600"/>
                    <GradientStatCard title="Total Claims" value={claims.length}subtitle="All statuses"icon={AlertCircle}gradient="from-orange-500 to-orange-600"/>
                    <GradientStatCard title="Subrogrations"value={subrogations.length}subtitle="Recovery cases"icon={RefreshCw}gradient="from-teal-500 to-teal-600"/>
                </>)}
            </div>

            {/* Filters */}
            <FilterTab
                filters = {filters}
                onFilterChange={setFilters}
                defaultFilters={defaultFilter}
                filterConfig={[
                    ...(['debtors'].includes(activeTab) ? [{
                        key: "batch",
                        label: "Batch ID",
                        placeholder: "Search batch",
                        type: "input",
                        inputType: "text"
                    },{
                        key:"branch_desc",
                        label:"Branch",
                        placeholder:"Search Branch",
                        type: "input",
                        inputType: "text",
                    },{
                        key:"region_desc",
                        label:"Region",
                        placeholder:"Search Region",
                        type: "input",
                        inputType: "text"
                    }] : []),
                    ...(['borderos'].includes(activeTab) ? [{
                        key:"period",
                        label:"Period",
                        placeholder:"Search Period",
                        type: "input",
                        inputType: "text",
                    }] : []),
                    {
                        key:"submitStatus",
                        label: "Submit Status",
                        placeholder: "Submit Status",
                        options: [
                            { value: "all", label: "All"},
                            { value: "SUBMITTED", label: "Submitted"},
                            { value: "APPROVED", label: "Approved"},
                            { value: "CHECKED_BRINS", label: "Checked (Brins)"},
                            { value: "APPROVED_BRINS", label: "Approved (Brins)"},
                            { value: "CHECKED_TUGURE", label: "Checked (Tugure)"},
                            { value: "ARCHIVED REVISION", label: "Archived Revision"},
                            { value: "REVISION", label: "Revision"},
                        ]
                    },
                    {
                        key: "reconStatus",
                        placeholder: "All Status",
                        label: "Reconciliation Status",
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
                <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="debtors">
                        <FileText className="w-4 h-4 mr-2" />
                        Debtors ({totalDebtors})
                    </TabsTrigger>
                    <TabsTrigger value="borderos">
                        <FileText className="w-4 h-4 mr-2" />
                        Borderos ({totalBorderos})
                    </TabsTrigger>
                    <TabsTrigger value="claims">
                        <FileText className="w-4 h-4 mr-2" />
                        Claims ({totalClaims})
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
                        pagination={{ from: debtorFrom, to: debtorTo, total: debtorTotal, page: debtorPage, totalPages: debtorTotalPages }}
                        onPageChange={(p) => setDebtorPage(p)}
                        emptyMessage="No debtors found"
                    />
                </TabsContent>

                <TabsContent value="borderos" className="mt-4">
                    {filteredBorderos.length === 0 ? (
                        <Alert className="bg-blue-50 border-blue-200 mb-4">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                                No borderos yet. Borderos are automatically
                                created when debtors are submitted via Excel
                                upload in Submit Debtor.
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    <DataTable
                        columns={borderoColumns}
                        data={filteredBorderos}
                        isLoading={loading}
                        pagination={{ from: borderoFrom, to: borderoTo, total: borderoTotal, page: borderoPage, totalPages: borderoTotalPages }}
                        onPageChange={(p) => setBorderoPage(p)}
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
                        pagination={{ from: claimFrom, to: claimTo, total: claimTotal, page: claimPage, totalPages: claimTotalPages }}
                        onPageChange={(p) => setClaimPage(p)}
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
                                    <div>
                                        <Label className="text-gray-500">
                                            Bordero
                                        </Label>
                                        <p className="font-medium">
                                            {selectedItem.bordero_id}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Region
                                        </Label>
                                        <p className="font-medium">
                                            {selectedItem.region_desc}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Branch
                                        </Label>
                                        <p className="font-medium">
                                            {selectedItem.branch_desc}
                                        </p>
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
                                            {formatRupiahAdaptive(selectedItem.total_exposure)}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-500">
                                            Total Premium
                                        </Label>
                                        <p className="font-medium">
                                            {formatRupiahAdaptive(selectedItem.total_premium)}
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
