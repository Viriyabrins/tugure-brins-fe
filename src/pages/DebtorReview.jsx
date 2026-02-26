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
    AlertCircle,
    Pen,
    ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
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

const defaultFilter = {
    contract: "all",
    batch: "",
    submitStatus: "all",
    status: "all",
    startDate: "",
    endDate: "",
};

const normalizeRole = (role = "") => String(role).trim().toLowerCase();
const TUGURE_ACTION_ROLES = ["checker-tugure-role", "approver-tugure-role"];
const BRINS_ACTION_ROLES = ["maker-brins-role", "checker-brins-role", "approver-brins-role"];
const ALL_ROLES = ["maker-brins-role", "checker-brins-role", "approver-brins-role", "checker-tugure-role", "approver-tugure-role"];
const hasTugureActionRole = (roles = []) =>
    (Array.isArray(roles) ? roles : [])
        .map(normalizeRole)
        .some((role) => TUGURE_ACTION_ROLES.includes(role));
const hasRole = (roles = [], targetRole) =>
    (Array.isArray(roles) ? roles : [])
        .map(normalizeRole)
        .includes(targetRole);

export default function DebtorReview() {
    const [user, setUser] = useState(null);
    const [tokenRoles, setTokenRoles] = useState([]);
    const [auditActor, setAuditActor] = useState(null);
    const [debtors, setDebtors] = useState([]);
    const [totalDebtors, setTotalDebtors] = useState(0);
    const [contracts, setContracts] = useState([]);
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
    const canManageDebtorActions = hasTugureActionRole(tokenRoles);
    const isCheckerTugure = hasRole(tokenRoles, "checker-tugure-role");
    const isApproverTugure = hasRole(tokenRoles, "approver-tugure-role");

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

    const loadData = async () => {
        setLoading(true);
        setSuccessMessage("");

        try {
            // Load small reference data (contracts, batches)
            const contractData = await backend.list("MasterContract");

            setContracts(Array.isArray(contractData) ? contractData : []);

            // Load first page of debtors with current filters
            await loadDebtors(1);
            // Load counts for status KPIs
            await loadStatusCounts();
        } catch (error) {
            console.error("Failed to load data:", error);
            setDebtors([]);
            setContracts([]);
        } finally {
            setLoading(false);
        }
    };

    const loadDebtors = async (pageToLoad = page) => {
        setLoading(true);
        try {
            const query = { page: pageToLoad, limit: pageSize };
            // Always exclude pre-BRINS-approval statuses from DebtorReview
            const reviewFilters = {
                ...filters,
                excludeStatuses: "SUBMITTED,CHECKED_BRINS,DRAFT",
            };
            // include filters as JSON string in `q`
            query.q = JSON.stringify(reviewFilters);

            const useReviseLog =
                filters?.submitStatus === "REVISION" ||
                filters?.status === "REVISION";
            const entityName = useReviseLog ? "ReviseLog" : "Debtor";

            const result = await backend.listPaginated(entityName, query);

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
            const statuses = [
                "APPROVED_BRINS",
                "CHECKED_TUGURE",
                "APPROVED",
                "REVISION",
            ];
            const promises = statuses.map((s) =>
                backend.listPaginated("Debtor", {
                    page: 1,
                    limit: 1,
                    q: JSON.stringify({ submitStatus: s }),
                }),
            );
            const results = await Promise.all(promises);
            const counts = results.map((r) => Number(r.pagination?.total) || 0);
            // set local derived counters based on these counts
            // [0]=APPROVED_BRINS, [1]=CHECKED_TUGURE, [2]=APPROVED, [3]=REVISION
            setPendingCountLocal(counts[0] || 0);       // APPROVED_BRINS (pending Tugure check)
            setApprovedCountLocal(counts[2] || 0);       // APPROVED (final)
            setRevisionCountLocal(counts[3] || 0);       // REVISION
            setConditionalCountLocal(counts[1] || 0);    // CHECKED_TUGURE (pending Tugure approve)
            // sample approved debtors to estimate total plafon (limited to reasonable page)
            try {
                const approvedSample = await backend.listPaginated("Debtor", {
                    page: 1,
                    limit: 100,
                    q: JSON.stringify({ submitStatus: "APPROVED" }),
                });
                const approvedRows = Array.isArray(approvedSample.data)
                    ? approvedSample.data
                    : [];
                const samplePlafon = approvedRows.reduce(
                    (s, d) => s + (parseFloat(d.plafon) || 0),
                    0,
                );
                setTotalPlafondLocal(samplePlafon);
            } catch (e) {
                console.warn("Failed to load approved sample for plafon", e);
            }
        } catch (e) {
            console.warn("Failed to load status counts", e);
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

            // Determine the new status based on action and role
            let newStatus;
            if (action === "check") {
                // Checker Tugure: APPROVED_BRINS → CHECKED_TUGURE
                newStatus = "CHECKED_TUGURE";
            } else if (action === "approve") {
                // Approver Tugure: CHECKED_TUGURE → APPROVED
                newStatus = "APPROVED";
            } else {
                // Revision
                newStatus = "REVISION";
            }

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

            let processedCount = 0;
            for (const debtor of debtorsToProcess) {
                if (!debtor || !debtor.id) continue;

                // Validate the correct source status for the transition
                if (action === "check" && debtor.status !== "APPROVED_BRINS") continue;
                if (action === "approve" && debtor.status !== "CHECKED_TUGURE") continue;

                try {
                    // Update debtor using backend client
                    await backend.update("Debtor", debtor.id, {
                        status: newStatus,
                        revision_reason:
                            action === "revision" ? approvalRemarks : null,
                        validation_remarks:
                            action === "revision" ? approvalRemarks : null,
                    });
                    processedCount++;

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
                            accepted_date: new Date().toISOString(),
                        });
                    }

                    // Create audit log using backend client
                    try {
                        const actionLabel = action === "check"
                            ? "DEBTOR_CHECKED_TUGURE"
                            : action === "approve"
                                ? "DEBTOR_APPROVED"
                                : "DEBTOR_REVISION";
                        await backend.create("AuditLog", {
                            action: actionLabel,
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
                            user_email: auditActor?.user_email || user?.email,
                            user_role: auditActor?.user_role || user?.role,
                            reason: approvalRemarks,
                        });
                    } catch (auditError) {
                        console.warn("Failed to create audit log:", auditError);
                    }
                } catch (error) {
                    console.error(
                        `Error processing debtor ${debtor.id}:`,
                        error,
                    );
                }
            }

            if (processedCount === 0) {
                toast.warning("No debtors with the correct status were found in your selection.");
                setShowApprovalDialog(false);
                setProcessing(false);
                return;
            }

            // Create notifications for ALL roles
            const notifTitle = action === "check"
                ? "Debtors Checked by Tugure"
                : action === "approve"
                    ? "Debtors Approved (Final)"
                    : "Debtors Marked for Revision";
            const notifMessage = isBulk
                ? `${auditActor?.user_email || user?.email} ${action === "check" ? "checked" : action === "approve" ? "approved" : "marked for revision"} ${processedCount} debtor(s).`
                : `${auditActor?.user_email || user?.email} ${action === "check" ? "checked" : action === "approve" ? "approved" : "marked for revision"} debtor ${selectedDebtor?.nama_peserta || selectedDebtor?.debtor_name}.`;
            const notifType = action === "revision" ? "WARNING" : "INFO";

            for (const role of ALL_ROLES) {
                try {
                    await backend.create("Notification", {
                        title: notifTitle,
                        message: notifMessage,
                        type: notifType,
                        module: "DEBTOR",
                        reference_id: isBulk
                            ? debtorsToProcess[0]?.batch_id
                            : selectedDebtor?.id,
                        target_role: role,
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            }

            const actionDisplay =
                action === "check"
                    ? isBulk
                        ? `${processedCount} checked by Tugure`
                        : "checked by Tugure"
                    : action === "approve"
                        ? isBulk
                            ? `${processedCount} approved (final)`
                            : "approved (final)"
                        : isBulk
                            ? `${processedCount} marked for revision`
                            : "marked for revision";
            setSuccessMessage(
                isBulk
                    ? `${actionDisplay}. Batch reconciliation handled by backend.`
                    : `Debtor ${actionDisplay}. Batch reconciliation handled by backend.`,
            );
            setShowApprovalDialog(false);
            setSelectedDebtor(null);
            setSelectedDebtors([]);
            setApprovalRemarks("");

            // Reload data after success
            setTimeout(() => {
                loadData();
            }, 1000);
        } catch (error) {
            console.error("Approval error:", error);
        }
        setProcessing(false);
    };

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

    const pendingCount =
        pendingCountLocal ||
        debtors.filter((d) => d.status === "APPROVED_BRINS").length;
    const approvedCount =
        approvedCountLocal ||
        debtors.filter((d) => d.status === "APPROVED").length;
    const revisionCount =
        revisionCountLocal ||
        debtors.filter((d) => d.status === "REVISION").length;
    const checkedTugureCount =
        conditionalCountLocal ||
        debtors.filter((d) => d.status === "CHECKED_TUGURE").length;
    const totalPlafond =
        totalPlafondLocal ||
        debtors
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
                            setSelectedDebtors(pageData.map((d) => d.id));
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
                    title="Pending Check"
                    value={pendingCount}
                    subtitle="BRINS approved, awaiting Tugure check"
                    icon={FileText}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title="Checked"
                    value={checkedTugureCount}
                    subtitle="Checked by Tugure, awaiting approval"
                    icon={ShieldCheck}
                    gradient="from-teal-500 to-teal-600"
                />
                <GradientStatCard
                    title="Approved"
                    value={approvedCount}
                    subtitle="Fully approved"
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
                            { value: "APPROVED_BRINS", label: "Approved (BRINS)" },
                            { value: "CHECKED_TUGURE", label: "Checked (Tugure)" },
                            { value: "APPROVED", label: "Approved (Final)" },
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
            {canManageDebtorActions && selectedDebtors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {isCheckerTugure && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setApprovalAction("bulk_check");
                                setShowApprovalDialog(true);
                            }}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Check ({selectedDebtors.length})
                        </Button>
                    )}
                    {isApproverTugure && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setApprovalAction("bulk_approve");
                                setShowApprovalDialog(true);
                            }}
                        >
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Approve ({selectedDebtors.length})
                        </Button>
                    )}
                    {canManageDebtorActions && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setApprovalAction("bulk_revision");
                                setShowApprovalDialog(true);
                            }}
                        >
                            <Pen className="w-4 h-4 mr-2" />
                            Revision ({selectedDebtors.length})
                        </Button>
                    )}
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
