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
    sendTemplatedEmail,
    createNotification,
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
const TUGURE_ACTION_ROLES = ["checker-tugure-role", "approver-tugure-role"];
const BRINS_ACTION_ROLES = ["maker-brins-role", "checker-brins-role"];
const hasTugureActionRole = (roles = []) =>
    (Array.isArray(roles) ? roles : [])
        .map(normalizeRole)
        .some((role) => TUGURE_ACTION_ROLES.includes(role));

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
    const canManageClaimActions = hasTugureActionRole(tokenRoles);

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

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
                backend.list("Claim"),
                backend.list("Subrogation"),
                backend.list("Nota"),
                backend.list("Contract"),
                backend.list("Debtor"),
                backend.list("Batch"),
            ]);
            setClaims(Array.isArray(claimData) ? claimData : []);
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

    const handleClaimAction = async () => {
        if (!selectedClaim || !actionType) return;

        // CRITICAL: Block claim approval if Nota payment not completed
        if (actionType === "check" || actionType === "verify") {
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
            let newStatus = "";
            let updateData = {
                reviewed_by: user?.email,
                review_date: new Date().toISOString(),
            };

            switch (actionType) {
                case "check":
                    newStatus = "Checked";
                    updateData.status = "Checked";
                    updateData.checked_by = user?.email;
                    updateData.checked_date = new Date().toISOString();
                    break;
                case "verify":
                    newStatus = "Doc Verified";
                    updateData.status = "Doc Verified";
                    updateData.doc_verified_by = user?.email;
                    updateData.doc_verified_date = new Date().toISOString();
                    break;
                case "invoice":
                    newStatus = "Invoiced";
                    updateData.status = "Invoiced";
                    updateData.invoiced_by = user?.email;
                    updateData.invoiced_date = new Date().toISOString();

                    // Create Claim Nota (IMMUTABLE AFTER ISSUED)
                    const notaNumber = `NOTA-CLM-${selectedClaim.claim_no}-${Date.now()}`;
                    await backend.create("Nota", {
                        nota_number: notaNumber,
                        nota_type: "Claim",
                        reference_id: selectedClaim.claim_no,
                        contract_id: selectedClaim.contract_id,
                        amount:
                            selectedClaim.share_tugure_amount ||
                            selectedClaim.nilai_klaim ||
                            0,
                        currency: "IDR",
                        status: "Draft",
                        is_immutable: false,
                        total_actual_paid: 0,
                        reconciliation_status: "PENDING",
                    });

                    // Create notification using backend client
                    try {
                        await backend.create("Notification", {
                            title: "Claim Nota Generated",
                            message: `Nota ${notaNumber} created for Claim ${selectedClaim.claim_no}. Amount: Rp ${(selectedClaim.share_tugure_amount || selectedClaim.nilai_klaim || 0).toLocaleString()}. Process in Nota Management.`,
                            type: "ACTION_REQUIRED",
                            module: "CLAIM",
                            reference_id:
                                selectedClaim.claim_no || selectedClaim.id,
                            target_role: TUGURE_ACTION_ROLES[0],
                        });
                    } catch (notifError) {
                        console.warn(
                            "Failed to create notification:",
                            notifError,
                        );
                    }
                    break;
                case "reject":
                    newStatus = "Draft";
                    updateData.status = "Draft";
                    updateData.revision_reason = remarks;
                    break;
            }

            // Update claim using backend client
            // Note: Claim entity uses claim_no as primary key
            const claimId = selectedClaim.claim_no || selectedClaim.id;
            await backend.update("Claim", claimId, updateData);

            // Create notification using backend client
            try {
                await backend.create("Notification", {
                    title: `Claim ${newStatus}`,
                    message: `Claim ${selectedClaim.claim_no} moved to ${newStatus}`,
                    type: "INFO",
                    module: "CLAIM",
                    reference_id: claimId,
                    target_role: BRINS_ACTION_ROLES[0],
                });
            } catch (notifError) {
                console.warn("Failed to create notification:", notifError);
            }

            // Create audit log using backend client
            try {
                await backend.create("AuditLog", {
                    action: `CLAIM_${actionType.toUpperCase()}`,
                    module: "CLAIM",
                    entity_type: "Claim",
                    entity_id: claimId,
                    old_value: JSON.stringify({ status: selectedClaim.status }),
                    new_value: JSON.stringify({ status: newStatus }),
                    user_email: auditActor?.user_email || user?.email,
                    user_role: auditActor?.user_role || user?.role,
                    reason: remarks,
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            setSuccessMessage(
                `Claim ${actionType}ed successfully${actionType === "invoice" ? " - Nota created" : ""}`,
            );
            setShowActionDialog(false);
            setSelectedClaim(null);
            setRemarks("");
            loadData();
        } catch (error) {
            console.error("Action error:", error);
            setErrorMessage("Failed to process claim");
        }
        setProcessing(false);
    };

    const pendingClaims = claims.filter(
        (c) => c.status === "Draft" || c.status === "Checked",
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
                    {canManageClaimActions && row.status === "Draft" && (
                        <>
                            <Button
                                size="sm"
                                className="bg-blue-600"
                                onClick={() => {
                                    setSelectedClaim(row);
                                    setActionType("check");
                                    setShowActionDialog(true);
                                }}
                            >
                                Check
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                    setSelectedClaim(row);
                                    setActionType("reject");
                                    setShowActionDialog(true);
                                }}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </>
                    )}
                    {canManageClaimActions && row.status === "Checked" && (
                        <Button
                            size="sm"
                            className="bg-green-600"
                            onClick={() => {
                                setSelectedClaim(row);
                                setActionType("verify");
                                setShowActionDialog(true);
                            }}
                        >
                            Verify Docs
                        </Button>
                    )}
                    {canManageClaimActions && row.status === "Doc Verified" && (
                        <Button
                            size="sm"
                            className="bg-purple-600"
                            onClick={() => {
                                setSelectedClaim(row);
                                setActionType("invoice");
                                setShowActionDialog(true);
                            }}
                        >
                            Issue Nota
                        </Button>
                    )}
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
                        {canManageClaimActions && selectedClaims.length > 0 && (
                            <>
                                <Button
                                    className="bg-green-600"
                                    onClick={async () => {
                                        setProcessing(true);
                                        try {
                                            for (const claimId of selectedClaims) {
                                                const claim = claims.find(
                                                    (c) => c.id === claimId,
                                                );
                                                if (claim?.status === "Draft") {
                                                    // Update claim using backend client
                                                    const updateId =
                                                        claim.claim_no ||
                                                        claim.id;
                                                    await backend.update(
                                                        "Claim",
                                                        updateId,
                                                        {
                                                            status: "Checked",
                                                            checked_by:
                                                                user?.email,
                                                            checked_date:
                                                                new Date().toISOString(),
                                                        },
                                                    );
                                                }
                                            }
                                            setSuccessMessage(
                                                `${selectedClaims.length} claims checked`,
                                            );
                                            setSelectedClaims([]);
                                            loadData();
                                        } catch (error) {
                                            console.error(
                                                "Bulk check error:",
                                                error,
                                            );
                                            setErrorMessage(
                                                "Failed to bulk check claims",
                                            );
                                        }
                                        setProcessing(false);
                                    }}
                                    disabled={processing}
                                >
                                    <Check className="w-4 h-4 mr-2" />
                                    Check ({selectedClaims.length})
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={async () => {
                                        setProcessing(true);
                                        try {
                                            for (const claimId of selectedClaims) {
                                                // Update claim using backend client
                                                const claim = claims.find(
                                                    (c) => c.id === claimId,
                                                );
                                                const updateId =
                                                    claim.claim_no || claim.id;
                                                await backend.update(
                                                    "Claim",
                                                    updateId,
                                                    {
                                                        status: "Draft",
                                                        revision_reason:
                                                            "Bulk rejection",
                                                    },
                                                );
                                            }
                                            setSuccessMessage(
                                                `${selectedClaims.length} claims rejected`,
                                            );
                                            setSelectedClaims([]);
                                            loadData();
                                        } catch (error) {
                                            console.error(
                                                "Bulk reject error:",
                                                error,
                                            );
                                            setErrorMessage(
                                                "Failed to bulk reject claims",
                                            );
                                        }
                                        setProcessing(false);
                                    }}
                                    disabled={processing}
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Reject ({selectedClaims.length})
                                </Button>
                            </>
                        )}
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
                    title="Invoiced"
                    value={
                        claims.filter((c) => c.claim_status === "Invoiced")
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
                                <SelectItem value="Draft">Draft</SelectItem>
                                <SelectItem value="Checked">Checked</SelectItem>
                                <SelectItem value="Doc Verified">
                                    Doc Verified
                                </SelectItem>
                                <SelectItem value="Invoiced">
                                    Invoiced
                                </SelectItem>
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

                <TabsContent value="review">
                    <DataTable
                        columns={claimColumns}
                        data={pendingClaims.filter((c) => {
                            if (
                                filters.contract !== "all" &&
                                c.contract_id !== filters.contract
                            )
                                return false;
                            if (
                                filters.claimStatus !== "all" &&
                                c.claim_status !== filters.claimStatus
                            )
                                return false;
                            return true;
                        })}
                        isLoading={loading}
                        emptyMessage="No pending claims"
                    />
                </TabsContent>
                <TabsContent value="all">
                    <DataTable
                        columns={claimColumns}
                        data={claims.filter((c) => {
                            if (
                                filters.contract !== "all" &&
                                c.contract_id !== filters.contract
                            )
                                return false;
                            if (
                                filters.claimStatus !== "all" &&
                                c.claim_status !== filters.claimStatus
                            )
                                return false;
                            return true;
                        })}
                        isLoading={loading}
                        emptyMessage="No claims"
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
                                cell: (row) =>
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
                            {actionType === "check" && "Check Claim"}
                            {actionType === "verify" && "Verify Documents"}
                            {actionType === "invoice" && "Issue Claim Nota"}
                            {actionType === "reject" && "Reject Claim"}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedClaim?.claim_no} -{" "}
                            {selectedClaim?.nama_tertanggung}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {actionType === "invoice" && (
                            <Alert className="bg-purple-50 border-purple-200">
                                <Plus className="h-4 w-4 text-purple-600" />
                                <AlertDescription className="text-purple-700">
                                    <strong>Creating Claim Nota:</strong>
                                    <br />• Nota Type: Claim
                                    <br />• Amount:{" "}
                                    {selectedClaim
                                        ? `Rp ${(selectedClaim.share_tugure_amount || selectedClaim.nilai_klaim || 0).toLocaleString()}`
                                        : "-"}
                                    <br />• Status: Draft (process in Nota
                                    Management)
                                    <br />
                                    <br />
                                    Claim Nota follows same workflow as Batch
                                    Nota:
                                    <br />
                                    Draft → Issued → Confirmed → Paid
                                </AlertDescription>
                            </Alert>
                        )}
                        {selectedClaim && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">
                                            Claim No:
                                        </span>
                                        <span className="ml-2 font-medium">
                                            {selectedClaim.claim_no}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Debtor:
                                        </span>
                                        <span className="ml-2 font-medium">
                                            {selectedClaim.nama_tertanggung}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Claim Amount:
                                        </span>
                                        <span className="ml-2 font-bold">
                                            {formatRupiahAdaptive(
                                                Number(
                                                    selectedClaim.nilai_klaim,
                                                ) || 0,
                                            )}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Share TUGURE:
                                        </span>
                                        <span className="ml-2 font-bold text-green-600">
                                            {formatRupiahAdaptive(
                                                Number(
                                                    selectedClaim.share_tugure_amount,
                                                ) || 0,
                                            )}
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
