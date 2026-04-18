import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, CheckCircle2, AlertCircle, DollarSign, RefreshCw, Eye, Download, ArrowRight, Loader2 } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import { useKeycloakAuth } from "@/lib/KeycloakContext";
import { formatRupiahAdaptive } from "@/utils/currency";
import { borderoService } from "../services/borderoService";
import { useBorderoData } from "../hooks/useBorderoData";
import { DEFAULT_BORDERO_FILTER, getNextBorderoStatus } from "../utils/borderoConstants";

export default function BorderoManagement() {
    const { user } = useKeycloakAuth();
    const [activeTab, setActiveTab] = useState("debtors");
    const [filters, setFilters] = useState(DEFAULT_BORDERO_FILTER);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    const data = useBorderoData(filters);
    const { loading, debtors, totalDebtors, borderos, totalBorderos, claims, totalClaims, filteredSubrogations, borderoDebtors, borderoDebtorsLoading, borderoDebtorsPagination, setBorderoDebtorsPage, loadBorderoDebtors, loadBorderos, reloadAll, debtorPagination, borderoPagination, claimPagination, borderoPage } = data;

    const openDetailDialog = (item) => {
        setSelectedItem(item);
        if (activeTab === "borderos") {
            data.setBorderoDebtorsPage(1);
            loadBorderoDebtors(item.bordero_id, 1);
        }
        setShowDetailDialog(true);
    };

    const handleBorderoAction = async () => {
        if (!selectedItem) return;
        setProcessing(true);
        try {
            const nextStatus = await borderoService.advanceBorderoStatus(selectedItem, user?.email);
            setSuccessMessage(`Bordero ${selectedItem.bordero_id} moved to ${nextStatus}`);
            setShowActionDialog(false);
            setSelectedItem(null);
            loadBorderos(borderoPage, filters);
        } catch (e) { console.error(e); }
        setProcessing(false);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const { debtors: allDebtors, borderos: allBorderos, claims: allClaims, subrogations: allSubrogations } = await borderoService.exportAll(filters);

            // Apply same client-side subrogation filter used in display
            const allFilteredSubs = allSubrogations.filter((s) => {
                if (filters.subrogationStatus !== "all" && s.status !== filters.subrogationStatus) return false;
                if (filters.startDate && s.created_date < filters.startDate) return false;
                if (filters.endDate && s.created_date > filters.endDate) return false;
                return true;
            });

            const debtorRows = allDebtors.map((d) => ({
                "Debtor": d.nama_peserta,
                "Nomor Peserta": d.nomor_peserta,
                "Branch": d.branch_desc,
                "Region": d.region_desc,
                "Batch": d.batch_id,
                "Plafond": parseFloat(d.plafon) || 0,
                "Net Premi": parseFloat(d.net_premi) || 0,
                "Status": d.status,
            }));

            const borderoRows = allBorderos.map((b) => ({
                "Bordero ID": b.bordero_id,
                "Period": b.period,
                "Contract": b.contract_id,
                "Total Debtors": b.total_debtors,
                "Plafond": parseFloat(b.total_plafon) || 0,
                "Nominal Premi": parseFloat(b.total_nominal_premi) || 0,
                "Premium Amount": parseFloat(b.total_premium_amount) || 0,
                "Komisi": parseFloat(b.total_ric_amount) || 0,
                "Net Premi": parseFloat(b.total_net_premi) || 0,
                "Broker Commission": parseFloat(b.total_bf_amount) || 0,
            }));

            const claimRows = allClaims.map((c) => ({
                "Claim No": c.claim_no,
                "Debtor": c.nama_tertanggung,
                "Policy No": c.policy_no,
                "DOL": c.dol,
                "Claim Amount": parseFloat(c.nilai_klaim) || 0,
                "Status": c.status,
            }));

            const subrogationRows = allFilteredSubs.map((s) => ({
                "Subrogation ID": s.subrogation_id,
                "Claim ID": s.claim_id,
                "Debtor ID": s.debtor_id,
                "Recovery Amount": parseFloat(s.recovery_amount) || 0,
                "Recovery Date": s.recovery_date,
                "Status": s.status,
            }));

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(debtorRows), "Debtors");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(borderoRows), "Borderos");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(claimRows), "Claims");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subrogationRows), "Subrogation");

            XLSX.writeFile(wb, `bordero-export-${new Date().toISOString().split("T")[0]}.xlsx`);
        } catch (e) {
            console.error("Export failed", e);
        }
        setExporting(false);
    };

    const kpiProps = [
        { title: "Total Debtors", value: totalDebtors, subtitle: `Showing ${debtors.length} of ${totalDebtors}`, icon: FileText, gradient: "from-blue-500 to-blue-600" },
        { title: "Borderos", value: borderos.length, subtitle: `${borderos.filter((b) => b.status === "FINAL").length} finalized`, icon: FileText, gradient: "from-purple-500 to-purple-600" },
        { title: "Total Premi", value: formatRupiahAdaptive(debtors.reduce((s, d) => s + (parseFloat(d.net_premi) || 0), 0)), subtitle: "Current page", icon: DollarSign, gradient: "from-green-500 to-green-600" },
        { title: "Total Claims", value: claims.length, subtitle: "All statuses", icon: AlertCircle, gradient: "from-orange-500 to-orange-600" },
        { title: "Subrogations", value: filteredSubrogations.length, subtitle: "Recovery cases", icon: RefreshCw, gradient: "from-teal-500 to-teal-600" },
    ];

    const debtorColumns = [
        { header: "Debtor", cell: (r) => <div><p className="font-medium">{r.nama_peserta}</p><p className="text-sm text-gray-500">{r.nomor_peserta}</p></div> },
        { header: "Branch", cell: (r) => <span className="text-sm">{r.branch_desc}</span> },
        { header: "Region", cell: (r) => <span className="text-sm">{r.region_desc}</span> },
        { header: "Batch", cell: (r) => <span className="font-mono text-sm">{r.batch_id}</span> },
        { header: "Plafond", cell: (r) => formatRupiahAdaptive(r.plafon) },
        { header: "Net Premi", cell: (r) => formatRupiahAdaptive(r.net_premi) },
        { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        { header: "Actions", cell: (r) => <Button variant="outline" size="sm" onClick={() => openDetailDialog(r)}><Eye className="w-4 h-4 mr-1" /></Button> },
    ];

    const borderoColumns = [
        { header: "Bordero ID", accessorKey: "bordero_id" },
        { header: "Period", accessorKey: "period" },
        { header: "Contract", accessorKey: "contract_id" },
        { header: "Total Debtors", accessorKey: "total_debtors" },
        { header: "Plafond", cell: (r) => formatRupiahAdaptive(r.total_plafon || 0) },
        { header: "Nominal Premi", cell: (r) => formatRupiahAdaptive(r.total_nominal_premi || 0) },
        { header: "Premium Amount", cell: (r) => formatRupiahAdaptive(r.total_premium_amount || 0) },
        { header: "Komisi", cell: (r) => formatRupiahAdaptive(r.total_ric_amount || 0) },
        { header: "Net Premi", cell: (r) => formatRupiahAdaptive(r.total_net_premi || 0) },
        { header: "Broker Commission", cell: (r) => formatRupiahAdaptive(r.total_bf_amount || 0) },
        { header: "Action", cell: (r) => <Button variant="outline" size="sm" onClick={() => openDetailDialog(r)}><Eye className="w-4 h-4 mr-1" /></Button> },
    ];

    const BORDERO_DEBTOR_COLS = [
        { header: "Nama Peserta", cell: (r) => r.nama_peserta }, 
        { header: "No Peserta", cell: (r) => r.nomor_peserta },
        { header: "No Rekening Pinjaman", cell: (r) => r.nomor_rekening_pinjaman }, 
        { header: "Loan Type", cell: (r) => r.loan_type }, 
        { header: "Jenis Pengajuan", cell: (r) => r.jenis_pengajuan_desc },
        { header: "Jenis Covering", cell: (r) => r.jenis_covering_desc },
        { header: "Tgl Mulai", cell: (r) => r.tanggal_mulai_covering ? new Date(r.tanggal_mulai_covering).toLocaleDateString() : "-" },
        { header: "Tgl Akhir", cell: (r) => r.tanggal_akhir_covering ? new Date(r.tanggal_akhir_covering).toLocaleDateString() : "-" },
        { header: "Plafon", cell: (r) => formatRupiahAdaptive(r.plafon) }, 
        { header: "Nominal Premi", cell: (r) => formatRupiahAdaptive(r.nominal_premi) },
        { header: "Premium", cell: (r) => formatRupiahAdaptive(r.premium_amount) }, 
        { header: "Komisi", cell: (r) => formatRupiahAdaptive(r.ric_amount) },
        { header: "Net Premi", cell: (r) => formatRupiahAdaptive(r.net_premi) }, 
        { header: "Broker Komisi", cell: (r) => formatRupiahAdaptive(r.bf_amount) },
        { header: "Branch", cell: (r) => r.branch_desc }, 
        { header: "Region", cell: (r) => r.region_desc },
        { header: "Cover ID", cell: (r) => r.cover_id }, 
        { header: "Program ID", cell: (r) => r.program_id },
        { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        { header: "Status Aktif", cell: (r) => r.status_aktif },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Bordero Management"
                subtitle="View debtors, exposure, bordero, claims, and process status"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Bordero Management" }]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={reloadAll}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
                        <Button variant="outline" onClick={handleExport} disabled={exporting}>{exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting...</> : <><Download className="w-4 h-4 mr-2" />Export Excel</>}</Button>
                    </div>
                }
            />

            {successMessage && <Alert className="bg-green-50 border-green-200"><CheckCircle2 className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-700">{successMessage}</AlertDescription></Alert>}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {kpiProps.map((p) => <GradientStatCard key={p.title} {...p} />)}
            </div>

            <FilterTab filters={filters} onFilterChange={setFilters} defaultFilters={DEFAULT_BORDERO_FILTER}
                filterConfig={[
                    ...(activeTab === "debtors" ? [{ key: "batch", label: "Batch ID", placeholder: "Search batch", type: "input", inputType: "text" }, { key: "branch_desc", label: "Branch", placeholder: "Search Branch", type: "input", inputType: "text" }, { key: "region_desc", label: "Region", placeholder: "Search Region", type: "input", inputType: "text" }] : []),
                    ...(activeTab === "borderos" ? [{ key: "period", label: "Period", placeholder: "Search Period", type: "input", inputType: "text" }] : []),
                    { key: "submitStatus", label: "Submit Status", options: [{ value: "all", label: "All" }, { value: "SUBMITTED", label: "Submitted" }, { value: "APPROVED", label: "Approved" }, { value: "CHECKED_BRINS", label: "Checked (Brins)" }, { value: "APPROVED_BRINS", label: "Approved (Brins)" }, { value: "CHECKED_TUGURE", label: "Checked (Tugure)" }, { value: "REVISION", label: "Revision" }] },
                    { key: "reconStatus", label: "Reconciliation Status", options: [{ value: "all", label: "All" }, { value: "IN_PROGRESS", label: "In Progress" }, { value: "EXCEPTION", label: "Exception" }, { value: "CLOSED", label: "Closed" }] },
                ]}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="debtors"><FileText className="w-4 h-4 mr-2" />Debtors ({totalDebtors})</TabsTrigger>
                    <TabsTrigger value="borderos"><FileText className="w-4 h-4 mr-2" />Borderos ({totalBorderos})</TabsTrigger>
                    <TabsTrigger value="claims"><FileText className="w-4 h-4 mr-2" />Claims ({totalClaims})</TabsTrigger>
                    <TabsTrigger value="subrogation"><FileText className="w-4 h-4 mr-2" />Subrogation ({filteredSubrogations.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="debtors" className="mt-4">
                    <DataTable columns={debtorColumns} data={debtors} isLoading={loading} pagination={debtorPagination} onPageChange={data.setDebtorPage} emptyMessage="No debtors found" />
                </TabsContent>

                <TabsContent value="borderos" className="mt-4">
                    {borderos.length === 0 && <Alert className="bg-blue-50 border-blue-200 mb-4"><AlertCircle className="h-4 w-4 text-blue-600" /><AlertDescription className="text-blue-700">No borderos yet. Borderos are automatically created when debtors are submitted via Excel upload in Submit Debtor.</AlertDescription></Alert>}
                    <DataTable columns={borderoColumns} data={borderos} isLoading={loading} pagination={borderoPagination} onPageChange={data.setBorderoPage} emptyMessage="No borderos generated yet" />
                </TabsContent>

                <TabsContent value="claims" className="mt-4">
                    <DataTable
                        columns={[
                            { header: "Claim No", accessorKey: "claim_no" },
                            { header: "Debtor", cell: (r) => r.nama_tertanggung },
                            { header: "Policy No", accessorKey: "policy_no" },
                            { header: "DOL", accessorKey: "dol" },
                            { header: "Claim Amount", cell: (r) => `IDR ${(r.nilai_klaim || 0).toLocaleString()}` },
                            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                            { header: "Actions", cell: () => <Button variant="outline" size="sm"><Eye className="w-4 h-4" /></Button> },
                        ]}
                        data={claims} isLoading={loading} pagination={claimPagination} onPageChange={data.setClaimPage} emptyMessage="No claims found"
                    />
                </TabsContent>

                <TabsContent value="subrogation" className="mt-4">
                    <DataTable
                        columns={[
                            { header: "Subrogation ID", accessorKey: "subrogation_id" },
                            { header: "Claim ID", accessorKey: "claim_id" },
                            { header: "Debtor ID", accessorKey: "debtor_id" },
                            { header: "Recovery Amount", cell: (r) => `IDR ${(r.recovery_amount || 0).toLocaleString()}` },
                            { header: "Recovery Date", accessorKey: "recovery_date" },
                            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                            { header: "Actions", cell: () => <Button variant="outline" size="sm"><Eye className="w-4 h-4" /></Button> },
                        ]}
                        data={filteredSubrogations} isLoading={loading} emptyMessage="No subrogation records found"
                    />
                </TabsContent>
            </Tabs>

            {/* Bordero Action Dialog */}
            <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move Bordero to {getNextBorderoStatus(selectedItem?.status)}</DialogTitle>
                        <DialogDescription>Update bordero {selectedItem?.bordero_id} status from {selectedItem?.status}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Period:</span><span className="font-medium">{selectedItem?.period}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Total Debtors:</span><span className="font-medium">{selectedItem?.total_debtors}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Total Premium:</span><span className="font-medium">{formatRupiahAdaptive(selectedItem?.total_premium)}</span></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowActionDialog(false)}>Cancel</Button>
                        <Button onClick={handleBorderoAction} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
                            {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><ArrowRight className="w-4 h-4 mr-2" />Confirm</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-7xl w-full max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>
                            {activeTab === "debtors" && "Debtor Detail"}
                            {activeTab === "borderos" && "Bordero Detail"}
                            {activeTab === "claims" && "Claim Detail"}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedItem && (
                        <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
                            {activeTab === "debtors" && (
                                <div className="grid grid-cols-2 gap-4">
                                    {[["Nama Peserta", selectedItem.nama_peserta], ["Batch ID", selectedItem.batch_id], ["Plafond", formatRupiahAdaptive(selectedItem.plafon)], ["Nominal Premi", formatRupiahAdaptive(selectedItem.nominal_premi)], ["Net Premi", formatRupiahAdaptive(selectedItem.net_premi)], ["Bordero", selectedItem.bordero_id], ["Region", selectedItem.region_desc], ["Branch", selectedItem.branch_desc]].map(([label, val]) => (
                                        <div key={label}><Label className="text-gray-500">{label}</Label><p className="font-medium">{val}</p></div>
                                    ))}
                                    <div><Label className="text-gray-500">Status</Label><StatusBadge status={selectedItem.status} /></div>
                                </div>
                            )}
                            {activeTab === "borderos" && (
                                <div>
                                    <h3 className="text-lg font-medium mb-4">Debtors in this Bordero</h3>
                                    <div className="w-full overflow-x-auto">
                                        <DataTable columns={BORDERO_DEBTOR_COLS} data={borderoDebtors} isLoading={borderoDebtorsLoading} pagination={borderoDebtorsPagination} onPageChange={(p) => { setBorderoDebtorsPage(p); loadBorderoDebtors(selectedItem.bordero_id, p); }} emptyMessage="No debtors found for this bordero" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter><Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
