import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    Eye,
    RefreshCw,
    Check,
    X,
    XCircle,
    Loader2,
    AlertCircle,
    DollarSign,
    Plus,
} from "lucide-react";
import { formatRupiahAdaptive } from "@/utils/currency";
import { Checkbox } from "@/components/ui/checkbox";
import { backend } from "@/api/backendClient";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";
import {
    sendNotificationEmail,
    createAuditLog,
} from "@/components/utils/emailTemplateHelper";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";

const defaultFilter = {
    contract: "all",
    batch: "all",
    claimStatus: "all",
    subrogationStatus: "all",
}

const normalizeRole = (role = "") => String(role).trim().toLowerCase();

const TUGURE_CHECKER_ROLES = ["checker-tugure-role"];
const TUGURE_APPROVER_ROLES = ["approver-tugure-role"];
const BRINS_MAKER_ROLES = ["maker-brins-role"];
const canCheckClaim = (roles = []) =>
    (Array.isArray(roles) ? roles : [])
        .map(normalizeRole)
        .some((role) => TUGURE_CHECKER_ROLES.includes(role));
const canApproveClaim = (roles = []) =>
    (Array.isArray(roles) ? roles : [])
        .map(normalizeRole)
        .some((role) => TUGURE_APPROVER_ROLES.includes(role));

export default function ClaimReview() {
    const [user, setUser] = useState(null);
    const [tokenRoles, setTokenRoles] = useState([]);
    const [auditActor, setAuditActor] = useState(null);
    const [claims, setClaims] = useState([]);
    const [subrogations, setSubrogations] = useState([]);
    const [notas, setNotas] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("review");
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [selectedClaims, setSelectedClaims] = useState([]);
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [actionType, setActionType] = useState("");
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [remarks, setRemarks] = useState("");
    const [filters, setFilters] = useState(defaultFilter);
    const [claimPage, setClaimPage] = useState(1);
    const [totalClaims, setTotalClaims] = useState(0);
    const claimPageSize = 10;
    const canCheck = canCheckClaim(tokenRoles);
    const canApprove = canApproveClaim(tokenRoles);

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

    useEffect(() => {
        loadClaims(claimPage);
    }, [claimPage]);

    const loadUser = async () => {
        try {
            const { default: keycloakService } = await import('@/services/keycloakService');
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
                setUser({ id: userInfo.id, email: userInfo.email, full_name: userInfo.name, role });
            }
        } catch (error) {
            console.error("Failed to load user:", error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [
                claimData,
                subrogationData,
                notaData,
                contractData,
                debtorData,
                batchData,
            ] = await Promise.all([
                backend.listPaginated("Claim", { page: 1, limit: claimPageSize }),
                backend.list("Subrogation"),
                backend.list("Nota"),
                backend.list("Contract"),
                backend.list("Debtor"),
                backend.list("Batch"),
            ]);
            const claimArr = claimData?.data || claimData;
            setClaims(Array.isArray(claimArr) ? claimArr : []);
            setTotalClaims(Number(claimData?.pagination?.total) || 0);
            setClaimPage(1);
            setSubrogations(
                Array.isArray(subrogationData) ? subrogationData : [],
            );
            setNotas(Array.isArray(notaData) ? notaData : []);
            setContracts(Array.isArray(contractData) ? contractData : []);
            setDebtors(Array.isArray(debtorData) ? debtorData : []);
            setBatches(Array.isArray(batchData) ? batchData : []);
        } catch (error) {
            console.error("Failed to load data:", error);
            setClaims([]);
            setSubrogations([]);
            setNotas([]);
            setContracts([]);
            setDebtors([]);
            setBatches([]);
        }
        setLoading(false);
    };

    const loadClaims = async (pageToLoad = claimPage) => {
        try {
            const result = await backend.listPaginated("Claim", {
                page: pageToLoad,
                limit: claimPageSize,
            });
            setClaims(Array.isArray(result.data) ? result.data : []);
            setTotalClaims(Number(result.pagination?.total) || 0);
        } catch (error) {
            console.error("Failed to load claims:", error);
        }
    };

    const handleClaimAction = async (overrideAction = null) => {
        const currentAction = typeof overrideAction === 'string' ? overrideAction : actionType;
        if (!currentAction) return;
        if (!selectedClaim && !currentAction.startsWith("bulk_")) return;

        // CRITICAL: Block claim approval if Nota payment not completed
        if (currentAction === "check" || currentAction === "approve") {
            // Find related debtor via claim
            const relatedDebtor = selectedClaim.debtor_id
                ? debtors.find((d) => d.id === selectedClaim.debtor_id)
                : null;

            if (relatedDebtor) {
                const batchId = relatedDebtor.batch_id;
                const batchNotas = notas.filter(
                    (n) =>
                        n.reference_id === batchId && n.nota_type === "Batch",
                );

                const hasCompletedPayment = batchNotas.some(
                    (n) => n.status === "Paid",
                );

                if (!hasCompletedPayment) {
                    setErrorMessage(
                        `❌ BLOCKED: Claim review not allowed.\n\nClaim Review may proceed ONLY IF nota_payment_status = PAID.\n\nCurrent Nota status: ${batchNotas[0]?.status || "No Nota found"}`,
                    );

                    // Create audit log using backend client
                    try {
                        await backend.create("AuditLog", {
                            action: "BLOCKED_CLAIM_REVIEW",
                            module: "CLAIM",
                            entity_type: "Claim",
                            entity_id:
                                selectedClaim.claim_no || selectedClaim.id,
                            old_value: {},
                            new_value: {
                                blocked_reason: "Nota payment not completed",
                            },
                            user_email: auditActor?.user_email || user?.email,
                            user_role: auditActor?.user_role || user?.role,
                            reason: "Attempted claim review before Nota payment",
                        });
                    } catch (auditError) {
                        console.warn("Failed to create audit log:", auditError);
                    }

                    setProcessing(false);
                    return;
                }
            }
        }

        setProcessing(true);
        setErrorMessage("");

        try {
            const claimsToProcess = currentAction.startsWith("bulk_")
                ? claims.filter((c) => selectedClaims.includes(c.id))
                : [selectedClaim];

            const baseAction = currentAction.replace("bulk_", "");
            let successCount = 0;

            for (const claim of claimsToProcess) {
                if (!claim) continue;
                
                // Allow skipping if status does not match expectation
                if (baseAction === "check" && claim.status !== "SUBMITTED") continue;
                if ((baseAction === "approve" || baseAction === "revise") && claim.status !== "CHECKED") continue;

                let newStatus = "";
                let updateData = {
                    reviewed_by: user?.email,
                    review_date: new Date().toISOString(),
                };

                const claimId = claim.claim_no || claim.id;

                if (baseAction === "check") {
                    newStatus = "CHECKED";
                    updateData.status = "CHECKED";
                    updateData.checked_by = user?.email;
                    updateData.checked_date = new Date().toISOString();
                    
                    sendNotificationEmail({
                        targetGroup: "tugure-approver",
                        objectType: "Record",
                        statusTo: "CHECKED",
                        recipientRole: "TUGURE",
                        variables: {
                            claim_no: claim.claim_no,
                            action_by: user?.email,
                        },
                        fallbackSubject: `Claim ${claim.claim_no} Checked`,
                        fallbackBody: `Claim ${claim.claim_no} has been checked by ${user?.email} and awaits approval.`,
                    }).catch(e => console.error("Background email fail:", e));

                } else if (baseAction === "approve") {
                    newStatus = "APPROVED";
                    updateData.status = "APPROVED";
                    updateData.approved_by = user?.email;
                    updateData.approved_date = new Date().toISOString();

                    const notaNumber = `NOTA-CLM-${claim.claim_no}-${Date.now()}`;
                    await backend.create("Nota", {
                        nota_number: notaNumber,
                        nota_type: "Claim",
                        reference_id: claim.claim_no,
                        contract_id: claim.contract_id,
                        amount: claim.share_tugure_amount || claim.nilai_klaim || 0,
                        currency: "IDR",
                        status: "Draft",
                        is_immutable: false,
                        total_actual_paid: 0,
                        reconciliation_status: "PENDING",
                    });

                    sendNotificationEmail({
                        targetGroup: "brins-maker",
                        objectType: "Record",
                        statusTo: "APPROVED",
                        recipientRole: "BRINS",
                        variables: {
                            claim_no: claim.claim_no,
                            action_by: user?.email,
                        },
                        fallbackSubject: `Claim ${claim.claim_no} Approved`,
                        fallbackBody: `Claim ${claim.claim_no} has been approved by ${user?.email} and Nota ${notaNumber} has been generated. Remarks: ${remarks || "-"}`,
                    }).catch(e => console.error("Background email fail:", e));

                    try {
                        await backend.create("Notification", {
                            title: "Claim Nota Generated",
                            message: `Nota ${notaNumber} created for Claim ${claim.claim_no}. Remarks: ${remarks}`,
                            type: "ACTION_REQUIRED",
                            module: "CLAIM",
                            reference_id: claim.claim_no || claim.id,
                            target_role: "maker-brins-role",
                        });
                    } catch (notifError) {
                        console.warn("Failed to create notification:", notifError);
                    }

                } else if (baseAction === "revise") {
                    newStatus = "REVISION";
                    updateData.status = "REVISION";
                    updateData.revision_reason = remarks;

                    sendNotificationEmail({
                        targetGroup: "brins-maker",
                        objectType: "Record",
                        statusTo: "REVISION",
                        recipientRole: "BRINS",
                        variables: {
                            claim_no: claim.claim_no,
                            action_by: user?.email,
                            remark: remarks || "Please review and revise the claim.",
                        },
                        fallbackSubject: `Claim ${claim.claim_no} Needs Revision`,
                        fallbackBody: `Claim ${claim.claim_no} needs revision. Remarks: ${remarks}`,
                    }).catch(e => console.error("Background email fail:", e));
                }

                await backend.update("Claim", claimId, updateData);
                successCount++;

                try {
                    let targetRole = "maker-brins-role";
                    if (newStatus === "CHECKED") {
                        targetRole = "tugure-approver-role";
                    }
                    
                    await backend.create("Notification", {
                        title: `Claim ${newStatus}`,
                        message: `Claim ${claim.claim_no} moved to ${newStatus}`,
                        type: "INFO",
                        module: "CLAIM",
                        reference_id: claimId,
                        target_role: targetRole,
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }

                try {
                    await backend.create("AuditLog", {
                        action: `CLAIM_${baseAction.toUpperCase()}`,
                        module: "CLAIM",
                        entity_type: "Claim",
                        entity_id: claimId,
                        old_value: JSON.stringify({ status: claim.status }),
                        new_value: JSON.stringify({ status: newStatus }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason: remarks,
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
            }

            setSuccessMessage(
                currentAction.startsWith("bulk_") 
                    ? `Successfully processed ${successCount} claims`
                    : `Claim ${baseAction}ed successfully${baseAction === "approve" ? " - Nota created" : ""}`
            );
            setShowActionDialog(false);
            setSelectedClaim(null);
            if (currentAction.startsWith("bulk_")) {
                setSelectedClaims([]);
            }
            if (!currentAction.includes("check")) {
                setRemarks("");
                setActionType("");
            }
            loadData();
        } catch (error) {
            console.error("Action error:", error);
            setErrorMessage("Failed to process claim(s)");
        }
        setProcessing(false);
    };

    const pendingClaims = claims.filter(
        (c) => c.status === "SUBMITTED" || c.status === "CHECKED",
    );

    const toggleClaimSelection = (claimId) => {
        setSelectedClaims((prev) =>
            prev.includes(claimId)
                ? prev.filter((id) => id !== claimId)
                : [...prev, claimId],
        );
    };

    const claimColumns = [
        {
            header: (
                <Checkbox
                    checked={
                        selectedClaims.length === claims.length &&
                        claims.length > 0
                    }
                    onCheckedChange={(checked) => {
                        setSelectedClaims(
                            checked ? claims.map((c) => c.id) : [],
                        );
                    }}
                />
            ),
            cell: (row) => (
                <Checkbox
                    checked={selectedClaims.includes(row.id)}
                    onCheckedChange={() => toggleClaimSelection(row.id)}
                />
            ),
            width: "50px",
        },
        { header: "Claim No", accessorKey: "claim_no" },
        { header: "Debtor", accessorKey: "nama_tertanggung" },
        {
            header: "Claim Amount",
            cell: (row) => formatRupiahAdaptive(Number(row.nilai_klaim) || 0),
        },
        {
            header: "Share Tugure",
            cell: (row) =>
                formatRupiahAdaptive(Number(row.share_tugure_amount) || 0),
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
                        onClick={() => {
                            setSelectedClaim(row);
                            setShowViewDialog(true);
                        }}
                    >
                        <Eye className="w-4 h-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Claim Review"
                subtitle="Review and process claims - generates Claim Nota"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Claim Review" },
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

            {successMessage && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        {successMessage}
                    </AlertDescription>
                </Alert>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                <GradientStatCard
                    title="Pending Review"
                    value={pendingClaims.length}
                    subtitle="Awaiting action"
                    icon={FileText}
                    gradient="from-orange-500 to-orange-600"
                />
                <GradientStatCard
                    title="Total Claims"
                    value={claims.length}
                    subtitle={formatRupiahAdaptive(
                        claims.reduce(
                            (s, c) => s + (Number(c.nilai_klaim) || 0),
                            0,
                        ),
                    )}
                    icon={DollarSign}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title="Approved"
                    value={
                        claims.filter((c) => c.status === "APPROVED")
                            .length
                    }
                    subtitle="Nota created"
                    icon={CheckCircle2}
                    gradient="from-purple-500 to-purple-600"
                />
                <GradientStatCard
                    title="Paid"
                    value={
                        claims.filter((c) => c.claim_status === "Paid").length
                    }
                    subtitle="Completed"
                    icon={CheckCircle2}
                    gradient="from-green-500 to-green-600"
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
                            { value: "all", label: "All Contracts"},
                            ...contracts.map((c) => ({ 
                                value:c.id, 
                                label: c.contract_number
                            })),
                        ],
                    },
                    {
                        key: "batch",
                        label: "Batch ID",
                        options: [
                            { value: "all", label: "All Batches"},
                            ...batches.map((b) => ({ 
                                value:b.batch_id, 
                                label: b.batch_id
                            })),
                        ],
                    },
                    {
                        key: "claimStatus",
                        label: "Claim Status",
                        options: [
                            { value: "all", label: "All Status"},
                            { value: "Draft", label: "Draft"},
                            { value: "Checked", label: "Checked"},
                            { value: "Doc Verified", label: "Doc Verified"},
                            { value: "Invoiced", label: "Invoiced"},
                            { value: "Paid", label: "Paid"},
                        ],
                    },
                    {
                        key: "subrogationStatus",
                        label: "Subrogation Status",
                        options: [
                            { value: "all", label: "All Status"},
                            { value: "Draft", label: "Draft"},
                            { value: "Invoiced", label: "Invoiced"},
                            { value: "Paid / Closed", label: "Paid / Closed"},
                        ],
                    }
                ]}
            />

            {/* <Card>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <Select
                            value={filters.contract}
                            onValueChange={(val) =>
                                setFilters({ ...filters, contract: val })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Contract" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Contracts
                                </SelectItem>
                                {contracts.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.contract_number}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Batch ID..."
                            value={filters.batch}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    batch: e.target.value,
                                })
                            }
                        />
                        <Select
                            value={filters.claimStatus}
                            onValueChange={(val) =>
                                setFilters({ ...filters, claimStatus: val })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Claim Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                                <SelectItem value="CHECKED">Checked</SelectItem>
                                <SelectItem value="APPROVED">Approved</SelectItem>
                                <SelectItem value="REVISION">Revision</SelectItem>
                                <SelectItem value="Paid">Paid</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.subrogationStatus}
                            onValueChange={(val) =>
                                setFilters({
                                    ...filters,
                                    subrogationStatus: val,
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Subrogation" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="Draft">Draft</SelectItem>
                                <SelectItem value="Invoiced">
                                    Invoiced
                                </SelectItem>
                                <SelectItem value="Paid / Closed">
                                    Paid / Closed
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            onClick={() =>
                                setFilters({
                                    contract: "all",
                                    batch: "",
                                    claimStatus: "all",
                                    subrogationStatus: "all",
                                })
                            }
                        >
                            Clear Filters
                        </Button>
                    </div>
                </CardContent>
            </Card> */}

            {/* Table */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="review">
                            Pending ({pendingClaims.length})
                        </TabsTrigger>
                        <TabsTrigger value="all">
                            All ({claims.length})
                        </TabsTrigger>
                        <TabsTrigger value="subrogation">
                            Subrogation ({subrogations.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* Bulk Actions */}
                    {selectedClaims.length > 0 && (
                        <div className="flex gap-2">
                            {canCheck && claims.filter(c => selectedClaims.includes(c.id) && c.status === "SUBMITTED").length > 0 && (
                                <Button
                                    className="bg-blue-600"
                                    onClick={() => handleClaimAction("bulk_check")}
                                >
                                    <Check className="w-4 h-4 mr-2" />
                                    Check ({claims.filter(c => selectedClaims.includes(c.id) && c.status === "SUBMITTED").length})
                                </Button>
                            )}
                            {canApprove && claims.filter(c => selectedClaims.includes(c.id) && c.status === "CHECKED").length > 0 && (
                                <>
                                    <Button
                                        className="bg-green-600"
                                        onClick={() => {
                                            setActionType("bulk_approve");
                                            setShowActionDialog(true);
                                        }}
                                    >
                                        <Check className="w-4 h-4 mr-2" />
                                        Approve ({claims.filter(c => selectedClaims.includes(c.id) && c.status === "CHECKED").length})
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            setActionType("bulk_revise");
                                            setShowActionDialog(true);
                                        }}
                                    >
                                        <XCircle className="w-4 h-4 mr-2" />
                                        Revise ({claims.filter(c => selectedClaims.includes(c.id) && c.status === "CHECKED").length})
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <TabsContent value="review">
                    <DataTable
                        columns={claimColumns}
                        data={pendingClaims}
                        isLoading={loading}
                        emptyMessage="No pending claims"
                        pagination={{
                            from: totalClaims === 0 ? 0 : (claimPage - 1) * claimPageSize + 1,
                            to: Math.min(totalClaims, claimPage * claimPageSize),
                            total: totalClaims,
                            page: claimPage,
                            totalPages: Math.max(1, Math.ceil(totalClaims / claimPageSize)),
                        }}
                        onPageChange={(p) => setClaimPage(p)}
                    />
                </TabsContent>
                <TabsContent value="all">
                    <DataTable
                        columns={claimColumns}
                        data={claims}
                        isLoading={loading}
                        emptyMessage="No claims"
                        pagination={{
                            from: totalClaims === 0 ? 0 : (claimPage - 1) * claimPageSize + 1,
                            to: Math.min(totalClaims, claimPage * claimPageSize),
                            total: totalClaims,
                            page: claimPage,
                            totalPages: Math.max(1, Math.ceil(totalClaims / claimPageSize)),
                        }}
                        onPageChange={(p) => setClaimPage(p)}
                    />
                </TabsContent>
                <TabsContent value="subrogation">
                    <DataTable
                        columns={[
                            {
                                header: "Subrogation ID",
                                accessorKey: "subrogation_id",
                            },
                            { header: "Claim ID", accessorKey: "claim_id" },
                            {
                                header: "Recovery",
                                cell: () =>
                                    formatRupiahAdaptive(
                                        subrogations.reduce(
                                            (s, sub) =>
                                                s +
                                                (Number(sub.recovery_amount) ||
                                                    0),
                                            0,
                                        ),
                                    ),
                            },
                            {
                                header: "Status",
                                cell: (row) => (
                                    <StatusBadge status={row.status} />
                                ),
                            },
                        ]}
                        data={subrogations.filter((s) => {
                            if (
                                filters.subrogationStatus !== "all" &&
                                s.status !== filters.subrogationStatus
                            )
                                return false;
                            return true;
                        })}
                        isLoading={loading}
                        emptyMessage="No subrogations"
                    />
                </TabsContent>
            </Tabs>

            {/* Action Dialog */}
            <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionType.includes("check") && (actionType.includes("bulk") ? "Bulk Check Claims" : "Check Claim")}
                            {actionType.includes("approve") && (actionType.includes("bulk") ? "Bulk Approve Claims" : "Approve Claim and Issue Nota")}
                            {actionType.includes("revise") && (actionType.includes("bulk") ? "Bulk Request Revision" : "Request Revision")}
                        </DialogTitle>
                        <DialogDescription>
                            {actionType.includes("bulk") 
                                ? `Processing ${selectedClaims.length} selected claims`
                                : `${selectedClaim?.claim_no} - ${selectedClaim?.nama_tertanggung}`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {actionType.includes("approve") && (
                            <Alert className="bg-purple-50 border-purple-200">
                                <Plus className="h-4 w-4 text-purple-600" />
                                <AlertDescription className="text-purple-700">
                                    <strong>Creating Claim {actionType.includes("bulk") ? "Notas" : "Nota"}:</strong>
                                    <br />• Nota Type: Claim
                                    <br />• Status: Draft (process in Nota Management)
                                    <br />
                                    <br />
                                    Claim Nota follows same workflow as Batch Nota:
                                    <br />
                                    Draft → Issued → Confirmed → Paid
                                </AlertDescription>
                            </Alert>
                        )}
                        {!actionType.includes("bulk") && selectedClaim && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">Claim No:</span>
                                        <span className="ml-2 font-medium">{selectedClaim.claim_no}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Debtor:</span>
                                        <span className="ml-2 font-medium">{selectedClaim.nama_tertanggung}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Claim Amount:</span>
                                        <span className="ml-2 font-bold">
                                            {formatRupiahAdaptive(Number(selectedClaim.nilai_klaim) || 0)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Share TUGURE:</span>
                                        <span className="ml-2 font-bold text-green-600">
                                            {formatRupiahAdaptive(Number(selectedClaim.share_tugure_amount) || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div>
                            <Label>Remarks</Label>
                            <Textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                rows={3}
                                placeholder="Enter remarks..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowActionDialog(false);
                                setRemarks("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleClaimAction}
                            disabled={processing}
                            className="bg-blue-600"
                        >
                            {processing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : null}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Claim Details</DialogTitle>
                        <DialogDescription>
                            {selectedClaim?.claim_no}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Claim No:</span>
                                <span className="ml-2 font-medium">
                                    {selectedClaim?.claim_no}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500">Debtor:</span>
                                <span className="ml-2 font-medium">
                                    {selectedClaim?.nama_tertanggung}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500">Amount:</span>
                                <span className="ml-2 font-medium">
                                    {formatRupiahAdaptive(
                                        Number(selectedClaim?.nilai_klaim) || 0,
                                    )}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500">Status:</span>
                                <StatusBadge status={selectedClaim?.status} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowViewDialog(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
