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
import {
    FileText,
    CheckCircle2,
    Eye,
    Download,
    RefreshCw,
    Check,
    X,
    Loader2,
    DollarSign,
    Filter,
    Clock,
    AlertCircle,
    Pen,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { backend } from "@/api/backendClient";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import ModernKPI from "@/components/dashboard/ModernKPI";
import {
    sendTemplatedEmail,
    createNotification,
    createAuditLog,
} from "@/components/utils/emailTemplateHelper";
import { formatRupiahAdaptive } from "@/utils/currency";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import SuccessAlert from "@/components/common/SuccessAlert";

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const defaultFilter = {
    contract: "all",
    batch: "",
    submitStatus: "all",
    status: "all",
    startDate: "",
    endDate: "",
};

export default function DebtorReview() {
    const [user, setUser] = useState(null);
    const [debtors, setDebtors] = useState([]);
    const [totalDebtors, setTotalDebtors] = useState(0);
    const [contracts, setContracts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [pendingCountLocal, setPendingCountLocal] = useState(0);
    const [approvedCountLocal, setApprovedCountLocal] = useState(0);
    const [revisionCountLocal, setRevisionCountLocal] = useState(0);
    const [conditionalCountLocal, setConditionalCountLocal] = useState(0);
    const [totalPlafondLocal, setTotalPlafondLocal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [selectedDebtors, setSelectedDebtors] = useState([]);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showFilterDialog, setShowFilterDialog] = useState(false);
    const [approvalAction, setApprovalAction] = useState("");
    const [approvalRemarks, setApprovalRemarks] = useState("");
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [filters, setFilters] = useState(defaultFilter);

    useEffect(() => {
        loadUser();
        // load contracts/batches and initial page of debtors
        loadData();
    }, []);

    const isTugure = user?.role === "TUGURE" || user?.role === "admin";

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
        setSuccessMessage("");

        try {
            // Load small reference data (contracts, batches)
            const [contractData, batchData] = await Promise.all([
                backend.list("MasterContract"),
                backend.list("Batch"),
            ]);

            setContracts(Array.isArray(contractData) ? contractData : []);
            setBatches(Array.isArray(batchData) ? batchData : []);

            // Load first page of debtors with current filters
            await loadDebtors(1);
            // Load counts for status KPIs
            await loadStatusCounts();
        } catch (error) {
            console.error("Failed to load data:", error);
            setDebtors([]);
            setContracts([]);
            setBatches([]);
        } finally {
            setLoading(false);
        }
    };

    const loadDebtors = async (pageToLoad = page) => {
        setLoading(true);
        try {
            const query = { page: pageToLoad, limit: pageSize };
            // include filters as JSON string in `q`
            if (filters) query.q = JSON.stringify(filters);

            const result = await backend.listPaginated("Debtor", query);

            setDebtors(Array.isArray(result.data) ? result.data : []);
            setTotalDebtors(Number(result.pagination?.total) || 0);
        } catch (error) {
            console.error("Failed to load debtors:", error);
            setDebtors([]);
            setTotalDebtors(0);
        } finally {
            setLoading(false);
        }
    };

    const loadStatusCounts = async () => {
        try {
            const statuses = ["SUBMITTED", "APPROVED", "REVISION", "CONDITIONAL"];
            const promises = statuses.map((s) =>
                backend.listPaginated("Debtor", { page: 1, limit: 1, q: JSON.stringify({ submitStatus: s }) }),
            );
            const results = await Promise.all(promises);
            const counts = results.map((r) => Number(r.pagination?.total) || 0);
            // set local derived counters based on these counts
            setPendingCountLocal(counts[0] || 0);
            setApprovedCountLocal(counts[1] || 0);
            setRevisionCountLocal(counts[2] || 0);
            setConditionalCountLocal(counts[3] || 0);
            // sample approved debtors to estimate total plafon (limited to reasonable page)
            try {
                const approvedSample = await backend.listPaginated("Debtor", { page: 1, limit: 100, q: JSON.stringify({ submitStatus: 'APPROVED' }) });
                const approvedRows = Array.isArray(approvedSample.data) ? approvedSample.data : [];
                const samplePlafon = approvedRows.reduce((s, d) => s + (parseFloat(d.plafon) || 0), 0);
                setTotalPlafondLocal(samplePlafon);
            } catch (e) {
                console.warn('Failed to load approved sample for plafon', e);
            }
        } catch (e) {
            console.warn('Failed to load status counts', e);
        }
    };

    const handleApprovalAction = async () => {
        if (
            (!selectedDebtor && selectedDebtors.length === 0) ||
            !approvalAction
        ) {
            console.error("No debtors selected or no action specified");
            return;
        }

        setProcessing(true);

        try {
            const isBulk = approvalAction.startsWith("bulk_");
            const action = isBulk
                ? approvalAction.replace("bulk_", "")
                : approvalAction;
            // All non-approve actions map to REVISION
            const newStatus = action === "approve" ? "APPROVED" : "REVISION";

            // Get debtors to process
            const debtorsToProcess = isBulk
                ? debtors.filter((d) => selectedDebtors.includes(d.id))
                : selectedDebtor
                  ? [selectedDebtor]
                  : [];

            if (debtorsToProcess.length === 0) {
                console.error("No debtors to process");
                setProcessing(false);
                return;
            }

            // FINANCIAL GATE: Track batch updates
            const batchUpdates = {};

            for (const debtor of debtorsToProcess) {
                if (!debtor || !debtor.id) continue;

                try {
                    // Update debtor using backend client
                    await backend.update("Debtor", debtor.id, {
                        status: newStatus,
                        revision_reason:
                            action === "revision" ? approvalRemarks : null,
                        validation_remarks:
                            action === "revision" ? approvalRemarks : null,
                    });

                    if (action === "approve") {
                        // Create record using backend client
                        await backend.create("Record", {
                            batch_id: debtor.batch_id,
                            debtor_id: debtor.id,
                            record_status: "Accepted",
                            exposure_amount: parseFloat(debtor.plafon) || 0,
                            premium_amount: parseFloat(debtor.net_premi) || 0,
                            revision_count: 0,
                            accepted_by: user?.email,
                            // use full ISO-8601 datetime so Prisma DateTime accepts it
                            accepted_date: new Date().toISOString(),
                        });
                    }

                    // Track batch for final amount calculation
                    if (debtor.batch_id) {
                        if (!batchUpdates[debtor.batch_id]) {
                            batchUpdates[debtor.batch_id] = {
                                batchIdString: debtor.batch_id,
                                approvedExposure: 0,
                                approvedPremium: 0,
                                approvedCount: 0,
                                totalCount: 0,
                                allDebtors: debtors.filter(
                                    (d) => d.batch_id === debtor.batch_id,
                                ),
                            };
                        }
                        batchUpdates[debtor.batch_id].totalCount++;

                        if (action === "approve") {
                            batchUpdates[debtor.batch_id].approvedExposure +=
                                parseFloat(debtor.plafon) || 0;
                            batchUpdates[debtor.batch_id].approvedPremium +=
                                parseFloat(debtor.net_premi) || 0;
                            batchUpdates[debtor.batch_id].approvedCount++;
                        }

                        // Create audit log using backend client
                        try {
                            await backend.create("AuditLog", {
                                action: `DEBTOR_${newStatus}`,
                                module: "DEBTOR",
                                entity_type: "Debtor",
                                entity_id: debtor.id,
                                old_value: JSON.stringify({
                                    status: debtor.status,
                                }),
                                new_value: JSON.stringify({
                                    status: newStatus,
                                    remarks: approvalRemarks,
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
                    }
                } catch (error) {
                    console.error(
                        `Error processing debtor ${debtor.id}:`,
                        error,
                    );
                }
            }

            // CRITICAL: Update batch with FINAL amounts after Debtor Review
            for (const [batchId, batchData] of Object.entries(batchUpdates)) {
                try {
                    // Find batch using backend client
                    const batchRecord = batches.find(
                        (b) => b.batch_id === batchId,
                    );

                    if (batchRecord) {
                        // Re-count ALL debtors with updated status
                        const updatedDebtors = batchData.allDebtors.map((d) => {
                            const processed = debtorsToProcess.find(
                                (dp) => dp.id === d.id,
                            );
                            if (processed) {
                                return { ...d, status: newStatus };
                            }
                            return d;
                        });

                        const approvedDebtors = updatedDebtors.filter(
                            (d) =>
                                (d.status || "").toString().toUpperCase() ===
                                "APPROVED",
                        );

                        const allApproved =
                            updatedDebtors.length > 0 &&
                            approvedDebtors.length === updatedDebtors.length;

                        const revisionDebtors = updatedDebtors.filter(
                            (d) =>
                                (d.status || "").toString().toUpperCase() ===
                                "REVISION",
                        );
                        const hasRevisions = revisionDebtors.length > 0;
                        // All debtors are reviewed (either APPROVED or REVISION, no SUBMITTED left)
                        const allReviewed = updatedDebtors.every((d) => {
                            const s = (d.status || "").toString().toUpperCase();
                            return (
                                s === "APPROVED" ||
                                s === "REVISION" ||
                                s === "CONDITIONAL"
                            );
                        });

                        const totalApprovedExposure = approvedDebtors.reduce(
                            (sum, d) => sum + toNumber(d.plafon),
                            0,
                        );
                        const totalApprovedPremium = approvedDebtors.reduce(
                            (sum, d) => sum + toNumber(d.net_premi),
                            0,
                        );

                        await backend.update("Batch", batchRecord.batch_id, {
                            final_exposure_amount: totalApprovedExposure,
                            final_premium_amount: totalApprovedPremium,
                            debtor_review_completed: allApproved,
                            batch_ready_for_nota: allApproved,
                        });

                        if (allApproved) {
                            // Auto-transition batch to Approved status
                            await backend.update(
                                "Batch",
                                batchRecord.batch_id,
                                {
                                    status: "Approved",
                                    approved_by: user?.email,
                                    approved_date: new Date()
                                        .toISOString()
                                        .split("T")[0],
                                },
                            );

                            // Create notification using backend client
                            try {
                                await backend.create("Notification", {
                                    title: "✅ Debtor Review COMPLETED - Ready for Nota",
                                    message: `Batch ${batchId}: ALL ${updatedDebtors.length} debtors reviewed. ${approvedDebtors.length} approved. Final premium: Rp ${totalApprovedPremium.toLocaleString()}. ✓ debtor_review_completed = TRUE. ✓ batch_ready_for_nota = TRUE.`,
                                    type: "ACTION_REQUIRED",
                                    module: "DEBTOR",
                                    reference_id: batchRecord.batch_id,
                                    target_role: "TUGURE",
                                });
                            } catch (notifError) {
                                console.warn(
                                    "Failed to create notification:",
                                    notifError,
                                );
                            }

                            // Create audit log
                            try {
                                await backend.create("AuditLog", {
                                    action: "DEBTOR_REVIEW_COMPLETED",
                                    module: "DEBTOR",
                                    entity_type: "Batch",
                                    entity_id: batchRecord.batch_id,
                                    old_value: JSON.stringify({
                                        debtor_review_completed: false,
                                    }),
                                    new_value: JSON.stringify({
                                        debtor_review_completed: true,
                                        batch_ready_for_nota: true,
                                        final_premium_amount:
                                            totalApprovedPremium,
                                        status: "Approved",
                                    }),
                                    user_email: user?.email,
                                    user_role: user?.role,
                                    reason: `All ${updatedDebtors.length} debtors reviewed - ${approvedDebtors.length} approved`,
                                });
                            } catch (auditError) {
                                console.warn(
                                    "Failed to create audit log:",
                                    auditError,
                                );
                            }
                        } else if (approvedDebtors.length === 0) {
                            await backend.update(
                                "Batch",
                                batchRecord.batch_id,
                                {
                                    status: "Revision",
                                    revision_reason:
                                        "All debtors marked for revision in review",
                                    debtor_review_completed: false,
                                    batch_ready_for_nota: false,
                                },
                            );

                            // Create notification
                            try {
                                await backend.create("Notification", {
                                    title: "Batch Requires Revision - All Debtors Marked",
                                    message: `Batch ${batchId}: All debtors marked for revision. BRINS must revise and resubmit.`,
                                    type: "WARNING",
                                    module: "DEBTOR",
                                    reference_id: batchRecord.batch_id,
                                    target_role: "BRINS",
                                });
                            } catch (notifError) {
                                console.warn(
                                    "Failed to create notification:",
                                    notifError,
                                );
                            }
                        } else if (hasRevisions && allReviewed) {
                            // Mixed: some approved, some revision — batch not complete
                            await backend.update(
                                "Batch",
                                batchRecord.batch_id,
                                {
                                    status: "Partial Revision",
                                    revision_reason: `${revisionDebtors.length} debtor(s) marked for revision`,
                                    debtor_review_completed: false,
                                    batch_ready_for_nota: false,
                                },
                            );

                            try {
                                await backend.create("Notification", {
                                    title: "Batch Partial Revision",
                                    message: `Batch ${batchId}: ${approvedDebtors.length} approved, ${revisionDebtors.length} need revision. BRINS must revise and resubmit revision debtors.`,
                                    type: "WARNING",
                                    module: "DEBTOR",
                                    reference_id: batchRecord.batch_id,
                                    target_role: "BRINS",
                                });
                            } catch (notifError) {
                                console.warn(
                                    "Failed to create notification:",
                                    notifError,
                                );
                            }
                        }
                    }
                } catch (batchError) {
                    console.error(
                        `Error updating batch ${batchId}:`,
                        batchError,
                    );
                }
            }

            // Create final notification
            try {
                await backend.create("Notification", {
                    title: `Debtor ${newStatus}`,
                    message: isBulk
                        ? `${debtorsToProcess.length} debtors ${newStatus.toLowerCase()}`
                        : `${selectedDebtor?.nama_peserta || selectedDebtor?.debtor_name} ${newStatus.toLowerCase()}`,
                    type: newStatus === "APPROVED" ? "INFO" : "WARNING",
                    module: "DEBTOR",
                    reference_id: isBulk
                        ? debtorsToProcess[0]?.batch_id
                        : selectedDebtor?.id,
                    target_role: "BRINS",
                });
            } catch (notifError) {
                console.warn("Failed to create notification:", notifError);
            }

            const actionDisplay =
                action === "approve"
                    ? isBulk
                        ? `${debtorsToProcess.length} approved`
                        : "approved"
                    : isBulk
                      ? `${debtorsToProcess.length} marked for revision`
                      : "marked for revision";
            setSuccessMessage(
                isBulk
                    ? `${actionDisplay}. Batch final amounts updated.`
                    : `Debtor ${actionDisplay}. Batch final amounts updated.`,
            );
            setShowApprovalDialog(false);
            setSelectedDebtor(null);
            setSelectedDebtors([]);
            setApprovalRemarks("");

            // Reload data setelah berhasil
            setTimeout(() => {
                loadData();
            }, 1000);
        } catch (error) {
            console.error("Approval error:", error);
        }
        setProcessing(false);
    };

    const filteredDebtors = Array.isArray(debtors)
        ? debtors.filter((d) => {
              if (
                  filters.contract !== "all" &&
                  d.contract_id !== filters.contract
              )
                  return false;
              if (filters.batch && !(d.batch_id || "").includes(filters.batch))
                  return false;
              if (
                  filters.submitStatus !== "all" &&
                  d.underwriting_status !== filters.submitStatus
              )
                  return false;
              if (filters.status !== "all" && d.batch_status !== filters.status)
                  return false;
              if (
                  filters.startDate &&
                  new Date(d.created_date) < new Date(filters.startDate)
              )
                  return false;
              if (
                  filters.endDate &&
                  new Date(d.created_date) > new Date(filters.endDate)
              )
                  return false;
              return true;
          })
        : [];

    // Pagination for Debtor Review (pageSize 10) - server-driven
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const total = totalDebtors;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    const pageData = Array.isArray(debtors) ? debtors : [];

    // Keep page within bounds when filtered set changes
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages]);

    // Reset to first page when filters change
    useEffect(() => {
        // when filters change, reset to first page and reload
        setPage(1);
        loadDebtors(1);
    }, [
        filters.contract,
        filters.batch,
        filters.startDate,
        filters.endDate,
        filters.submitStatus,
        filters.status,
    ]);

    // Load page when `page` changes
    useEffect(() => {
        loadDebtors(page);
    }, [page]);

    const toggleDebtorSelection = (debtorId) => {
        if (selectedDebtors.includes(debtorId)) {
            setSelectedDebtors(selectedDebtors.filter((id) => id !== debtorId));
        } else {
            setSelectedDebtors([...selectedDebtors, debtorId]);
        }
    };

    const pendingCount = pendingCountLocal || debtors.filter((d) => d.status === "SUBMITTED").length;
    const approvedCount = approvedCountLocal || debtors.filter((d) => d.status === "APPROVED").length;
    const revisionCount = revisionCountLocal || debtors.filter((d) => d.status === "REVISION").length;
    const conditionalCount = conditionalCountLocal || debtors.filter(
        (d) => d.status === "CONDITIONAL",
    ).length;
    const totalPlafond = totalPlafondLocal || debtors
        .filter((d) => d.status === "APPROVED")
        .reduce((sum, d) => sum + (parseFloat(d.plafon) || 0), 0);

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
                    onCheckedChange={() => toggleDebtorSelection(row.id)}
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
        {
            header: "Plafond",
            cell: (row) => `${formatRupiahAdaptive(row.plafon)}`,
        },
        {
            header: "Net Premi",
            cell: (row) => `${formatRupiahAdaptive(row.net_premi)}`,
        },
        {
            header: "Status",
            cell: (row) => <StatusBadge status={row.status} />,
        },
        {
            header: "Remarks",
            cell: (row) =>
                row.validation_remarks ? (
                    <span className="text-xs text-orange-600">⚠️ Issues</span>
                ) : (
                    <span className="text-xs text-green-600">✓ OK</span>
                ),
        },
        {
            header: "Actions",
            cell: (row) => (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelectedDebtor(row);
                            setShowDetailDialog(true);
                        }}
                    >
                        <Eye className="w-4 h-4" />
                    </Button>

                    {/* actions dalam tabel */}
                    {/* {isTugure && row.status === "SUBMITTED" && (
                        <>
                            <Button
                                size="sm"
                                className="bg-green-500 hover:bg-green-600"
                                onClick={() => {
                                    setSelectedDebtor(row);
                                    setApprovalAction("approve");
                                    setShowApprovalDialog(true);
                                }}
                            >
                                <Check className="w-4 h-4" />
                            </Button>
                            <Button
                                size="sm"
                                className="bg-orange-500 hover:bg-orange-600"
                                onClick={() => {
                                    setSelectedDebtor(row);
                                    setApprovalAction("revision");
                                    setShowApprovalDialog(true);
                                }}
                            >
                                <Pen className="w-4 h-4" />
                            </Button>
                        </>
                    )} */}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Debtor Review - Financial Gate"
                subtitle="⚠️ CRITICAL: Only APPROVED debtors are included in financial calculations"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Debtor Review" },
                ]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={loadData}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                }
            />

            {successMessage && <SuccessAlert message={successMessage} />}

            {/* Gradient Stat Card */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <GradientStatCard
                    title="Pending Review"
                    value={pendingCount}
                    subtitle="Awaiting approval"
                    icon={FileText}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title="Approved"
                    value={approvedCount}
                    subtitle="Ready for nota"
                    icon={CheckCircle2}
                    gradient="from-green-500 to-green-600"
                />
                <GradientStatCard
                    title="Revision"
                    value={revisionCount}
                    subtitle="Requires revision"
                    icon={AlertCircle}
                    gradient="from-red-500 to-red-600"
                />
                <GradientStatCard
                    title="Conditional"
                    value={conditionalCount}
                    subtitle="Additional docs needed"
                    icon={Clock}
                    gradient="from-yellow-500 to-yellow-600"
                />
                <GradientStatCard
                    title="Total Plafon"
                    value={formatRupiahAdaptive(totalPlafond)}
                    subtitle="Approved only"
                    icon={DollarSign}
                    gradient="from-purple-500 to-purple-600"
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
                                value: c.id,
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
                        key: "startDate",
                        label: "Start Date",
                        type: "date",
                    },
                    {
                        key: "endDate",
                        label: "End Date",
                        type: "date",
                    },
                    {
                        key: "submitStatus",
                        label: "Underwriting Status",
                        options: [
                            { value: "all", label: "All Statuses" },
                            { value: "SUBMITTED", label: "Submitted" },
                            { value: "APPROVED", label: "Approved" },
                            { value: "REVISION", label: "Revision" },
                        ],
                    },
                    {
                        key: "status",
                        label: "Batch Status",
                        options: [
                            { value: "all", label: "All Statuses" },
                            { value: "Uploaded", label: "Uploaded" },
                            { value: "Validated", label: "Validated" },
                            { value: "Matched", label: "Matched" },
                            { value: "Approved", label: "Approved" },
                        ],
                    },
                ]}
            />

            {/* Bulk Actions */}
            {isTugure && selectedDebtors.length >= 0 && (
                <div className="flex flex-wrap gap-2">
                    <>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setApprovalAction("bulk_approve");
                                setShowApprovalDialog(true);
                            }}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Approve{" "}
                            {selectedDebtors.length > 0
                                ? `(${selectedDebtors.length})`
                                : ""}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setApprovalAction("bulk_revision");
                                setShowApprovalDialog(true);
                            }}
                        >
                            <Pen className="w-4 h-4 mr-2" />
                            Revision{" "}
                            {selectedDebtors.length > 0
                                ? `(${selectedDebtors.length})`
                                : ""}
                        </Button>
                    </>
                </div>
            )}

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={pageData}
                isLoading={loading}
                emptyMessage="No debtors to review"
                pagination={{ from, to, total, page, totalPages }}
                onPageChange={(p) => setPage(p)}
            />

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Debtor Details</DialogTitle>
                        <DialogDescription>
                            {selectedDebtor?.debtor_name}
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
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowDetailDialog(false)}>
                            Close
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
                            {approvalAction?.includes("bulk")
                                ? `Bulk ${approvalAction.includes("approve") ? "Approve" : "Revision"} (${selectedDebtors.length} debtors)`
                                : approvalAction === "approve"
                                  ? "Approve Debtor"
                                  : "Request Revision"}
                        </DialogTitle>
                        <DialogDescription>
                            {approvalAction?.includes("bulk")
                                ? `Processing ${selectedDebtors.length} selected debtors`
                                : selectedDebtor?.debtor_name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {!approvalAction?.includes("bulk") &&
                            selectedDebtor && (
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-500">
                                                Plafond:
                                            </span>
                                            <span className="ml-2 font-medium">
                                                Rp{" "}
                                                {(
                                                    selectedDebtor?.plafon || 0
                                                ).toLocaleString("id-ID")}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">
                                                Net Premi:
                                            </span>
                                            <span className="ml-2 font-medium">
                                                Rp{" "}
                                                {(
                                                    selectedDebtor?.net_premi ||
                                                    0
                                                ).toLocaleString("id-ID")}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                        {(approvalAction === "revision" ||
                            approvalAction === "bulk_revision") && (
                            <Alert>
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                                <AlertDescription>
                                    {approvalAction === "bulk_revision"
                                        ? `Marking ${selectedDebtors.length} debtors for revision will allow them to be revised and resubmitted.`
                                        : "Marking debtor for revision will allow revision and resubmission."}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div>
                            <label className="text-sm font-medium">
                                Remarks *
                            </label>
                            <Textarea
                                value={approvalRemarks}
                                onChange={(e) =>
                                    setApprovalRemarks(e.target.value)
                                }
                                placeholder={
                                    approvalAction === "approve" ||
                                    approvalAction === "bulk_approve"
                                        ? "Enter approval notes..."
                                        : "Enter revision reason..."
                                }
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowApprovalDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApprovalAction}
                            disabled={processing || !approvalRemarks}
                            className={
                                approvalAction === "approve" ||
                                approvalAction === "bulk_approve"
                                    ? "bg-green-600 hover:bg-green-600"
                                    : "bg-orange-600 hover:bg-orange-600"
                            }
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    {approvalAction === "approve" ||
                                    approvalAction === "bulk_approve" ? (
                                        <Check className="w-4 h-4 mr-2" />
                                    ) : (
                                        <X className="w-4 h-4 mr-2" />
                                    )}
                                    {approvalAction === "approve" ||
                                    approvalAction === "bulk_approve"
                                        ? "Approve"
                                        : "Revision"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
