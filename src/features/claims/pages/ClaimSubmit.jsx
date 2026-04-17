import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    FileText,
    Upload,
    CheckCircle2,
    AlertCircle,
    Download,
    RefreshCw,
    Plus,
    DollarSign,
    Paperclip,
    Check,
    ShieldCheck,
    Pen,
    Loader2,
} from "lucide-react";
import { formatRupiahAdaptive } from "@/utils/currency";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import { backend } from "@/api/backendClient";

import { useUserTenant } from "@/shared/hooks/useUserTenant";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { useDialogs } from "@/shared/hooks/useDialogs";
import { useClaimData } from "../hooks/useClaimData";
import { useClaimUpload } from "../hooks/useClaimUpload";
import { ClaimUploadDialog } from "../components/ClaimUploadDialog";
import { SubrogationDialog } from "../components/SubrogationDialog";
import { FilePreviewModal } from "../components/FilePreviewModal";
import { AttachmentCount } from "@/components/common/AttachmentCount";
import { DEFAULT_CLAIM_FILTER, CLAIM_TEMPLATE_HEADERS, CLAIM_TEMPLATE_SAMPLE } from "../utils/claimConstants";
import { useClaimSSE } from "@/hooks/useDebtorSSE";

export default function ClaimSubmit() {
    const { isBrinsUser, isTugureUser } = useUserTenant();
    const { user, userRoles, hasAnyRole } = useCurrentUser();

    const isCheckerBrins = hasAnyRole("checker-brins-role");
    const isApproverBrins = hasAnyRole("approver-brins-role");

    const canShowActionButtons = hasAnyRole(
        "maker-brins-role",
        "checker-brins-role",
        "approver-brins-role",
    );

    // ── Claim workflow action state ──────────────────────────────────────────
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [actionType, setActionType] = useState("");
    const [remarks, setRemarks] = useState("");
    const [actionProcessing, setActionProcessing] = useState(false);
    const [actionError, setActionError] = useState("");

    async function handleClaimAction() {
        if (!selectedClaim || !actionType) return;
        setActionProcessing(true);
        setActionError("");
        try {
            const claimId = selectedClaim.claim_no || selectedClaim.id;
            const ACTION_MAP = {
                check: "CHECK_BRINS",
                approve_brins: "APPROVE_BRINS",
                revise: "REVISION",
            };
            await backend.processClaimWorkflowAction(claimId, {
                action: ACTION_MAP[actionType],
                remarks,
                actorEmail: user?.email,
                actorRole: user?.role,
            });
            const ACTION_LABEL = {
                check: "checked (BRINS)",
                approve_brins: "approved (BRINS)",
                revise: "sent for revision",
            };
            setSuccessMessage(`Claim ${ACTION_LABEL[actionType]} successfully`);
            setShowActionDialog(false);
            setSelectedClaim(null);
            setRemarks("");
            setActionType("");
            loadAll();
        } catch (e) {
            console.error("Claim action error:", e);
            setActionError(e.message || "Failed to process claim");
        }
        setActionProcessing(false);
    }

    const [filters, setFilters] = useState(DEFAULT_CLAIM_FILTER);
    const [activeTab, setActiveTab] = useState("claims");
    const [successMessage, setSuccessMessage] = useState("");
    const [filePreviewOpen, setFilePreviewOpen] = useState(false);
    const [selectedClaimForFiles, setSelectedClaimForFiles] = useState(null);

    const {
        claims,
        subrogations,
        debtors,
        batches,
        contracts,
        notas,
        loading,
        error,
        claimPage,
        setClaimPage,
        totalClaims,
        loadAll,
    } = useClaimData(filters);

    const {
        processing,
        parsedClaims,
        validationRemarks,
        dialogError,
        previewValidationError,
        handleFileUpload,
        handleBulkUpload,
        handleDownloadTemplate,
        reset: resetUpload,
    } = useClaimUpload({
        debtors,
        user,
        isBrinsUser,
        onSuccess: (msg) => {
            closeDialog("upload");
            setSuccessMessage(msg);
            loadAll();
        },
    });

    const { dialogs, open: openDialog, close: closeDialog } = useDialogs([
        "upload",
        "subrogation",
    ]);

    useEffect(() => {
        loadAll();
    }, []);

    useClaimSSE(() => loadAll());

    const downloadTemplate = () => {
        const csvContent =
            CLAIM_TEMPLATE_HEADERS.join(",") + "\n" + CLAIM_TEMPLATE_SAMPLE;
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "claim_template.csv";
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const claimPageSize = 10;

    const claimColumns = [
        { header: "Claim No", accessorKey: "claim_no" },
        { header: "Policy No", accessorKey: "policy_no" },
        {
            header: "Debtor",
            accessorKey: "nama_tertanggung",
            cell: (row) => (
                <div>
                    <div className="font-medium">{row.nama_tertanggung}</div>
                    <div className="text-xs text-gray-500">
                        {row.nomor_peserta}
                    </div>
                </div>
            ),
        },
        {
            header: "Claim Amount",
            cell: (row) =>
                `Rp ${(parseFloat(row.nilai_klaim) || 0).toLocaleString("id-ID")}`,
        },
        {
            header: "Status",
            cell: (row) => <StatusBadge status={row.status} />,
        },
        {
            header: "Files Count",
            cell: (row) => <AttachmentCount recordId={row.nomor_peserta || row.claim_no} />,
        },
        {
            header: "Attachments",
            cell: (row) => (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        setSelectedClaimForFiles(row);
                        setFilePreviewOpen(true);
                    }}
                >
                    <Paperclip className="w-4 h-4" />
                </Button>
            ),
        },
        {
            header: "Actions",
            cell: (row) => (
                <div className="flex gap-2">
                    {isCheckerBrins && row.status === "SUBMITTED" && (
                        <Button size="sm" variant="outline"
                            onClick={() => { setSelectedClaim(row); setActionType("check"); setShowActionDialog(true); }}>
                            <Check className="w-4 h-4 mr-1" />Check
                        </Button>
                    )}
                    {isApproverBrins && row.status === "CHECKED_BRINS" && (
                        <Button size="sm" variant="outline" className="text-blue-600 border-blue-300"
                            onClick={() => { setSelectedClaim(row); setActionType("approve_brins"); setShowActionDialog(true); }}>
                            <ShieldCheck className="w-4 h-4 mr-1" />Approve
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title={isBrinsUser ? "Recovery Submission" : "Claim Submission"}
                subtitle={
                    isBrinsUser
                        ? "Submit recoveries per batch"
                        : "Submit reinsurance claims per batch"
                }
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    {
                        label: isBrinsUser
                            ? "Recovery Submit"
                            : "Claim Submit",
                    },
                ]}
                actions={
                    canShowActionButtons ? (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={loadAll}>
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
                                onClick={() => openDialog("upload")}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Bulk Upload
                            </Button>
                        </div>
                    ) : null
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

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard
                    title={
                        isBrinsUser ? "Total Recoveries" : "Total Claims"
                    }
                    value={claims.length}
                    subtitle={formatRupiahAdaptive(
                        claims.reduce(
                            (s, c) => s + (Number(c.nilai_klaim) || 0),
                            0,
                        ),
                    )}
                    icon={FileText}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title={
                        isBrinsUser
                            ? "Submitted Recoveries"
                            : "Submitted Claims"
                    }
                    value={
                        claims.filter((c) => c.status === "SUBMITTED").length
                    }
                    subtitle="Pending check"
                    icon={FileText}
                    gradient="from-orange-500 to-orange-600"
                />
                <GradientStatCard
                    title="Total Subrogation"
                    value={subrogations.length}
                    subtitle={formatRupiahAdaptive(
                        subrogations.reduce(
                            (s, sub) =>
                                s + (Number(sub.recovery_amount) || 0),
                            0,
                        ),
                    )}
                    icon={DollarSign}
                    gradient="from-green-500 to-green-600"
                />
                <GradientStatCard
                    title="Recovered"
                    value={
                        subrogations.filter(
                            (s) => s.status === "Paid / Closed",
                        ).length
                    }
                    subtitle="Completed"
                    icon={CheckCircle2}
                    gradient="from-purple-500 to-purple-600"
                />
            </div>

            <FilterTab
                filters={filters}
                onFilterChange={setFilters}
                defaultFilters={DEFAULT_CLAIM_FILTER}
                filterConfig={[
                    {
                        key: "contract",
                        label: "Contract",
                        options: [
                            { value: "all", label: "All Contracts" },
                            ...contracts.map((c) => ({
                                value: c.contract_id,
                                label: c.contract_number,
                            })),
                        ],
                    },
                    {
                        key: "claimStatus",
                        label: isBrinsUser
                            ? "Recovery Status"
                            : "Claim Status",
                        options: [
                            {
                                value: "all",
                                label: isBrinsUser
                                    ? "All Recovery Status"
                                    : "All Claim Status",
                            },
                            { value: "SUBMITTED", label: "Submitted" },
                            { value: "CHECKED_BRINS", label: "Checked (BRINS)" },
                            { value: "APPROVED_BRINS", label: "Approved (BRINS)" },
                            { value: "CHECKED_TUGURE", label: "Checked (TUGURE)" },
                            { value: "APPROVED", label: "Approved (Final)" },
                            { value: "REVISION", label: "Revision" },
                        ],
                    },
                ]}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="claims">
                        <FileText className="w-4 h-4 mr-2" />
                        {isBrinsUser ? "Recoveries" : "Claims"} (
                        {claims.length})
                    </TabsTrigger>
                    <TabsTrigger value="subrogation">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Subrogation ({subrogations.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="claims" className="mt-4">
                    <DataTable
                        columns={claimColumns}
                        data={claims}
                        isLoading={loading}
                        emptyMessage={
                            isBrinsUser
                                ? "No recoveries submitted"
                                : "No claims submitted"
                        }
                        pagination={{
                            from:
                                totalClaims === 0
                                    ? 0
                                    : (claimPage - 1) * claimPageSize + 1,
                            to: Math.min(
                                totalClaims,
                                claimPage * claimPageSize,
                            ),
                            total: totalClaims,
                            page: claimPage,
                            totalPages: Math.max(
                                1,
                                Math.ceil(totalClaims / claimPageSize),
                            ),
                        }}
                        onPageChange={(p) => setClaimPage(p)}
                    />
                </TabsContent>

                <TabsContent value="subrogation" className="mt-4">
                    <div className="mb-4 flex justify-end">
                        {canShowActionButtons && (
                            <Button
                                onClick={() => openDialog("subrogation")}
                                className="bg-green-600"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Subrogation
                            </Button>
                        )}
                    </div>
                    <DataTable
                        columns={[
                            {
                                header: "Subrogation ID",
                                accessorKey: "subrogation_id",
                            },
                            {
                                header: "Claim ID",
                                accessorKey: "claim_id",
                            },
                            {
                                header: "Recovery Amount",
                                cell: (row) =>
                                    formatRupiahAdaptive(
                                        Number(row.recovery_amount) || 0,
                                    ),
                            },
                            {
                                header: "Recovery Date",
                                cell: (row) =>
                                    row.recovery_date
                                        ? new Date(
                                              row.recovery_date,
                                          ).toLocaleDateString("id-ID")
                                        : "-",
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
                        emptyMessage="No subrogation records"
                    />
                </TabsContent>


            </Tabs>

            <ClaimUploadDialog
                open={dialogs.upload}
                onClose={() => {
                    closeDialog("upload");
                    resetUpload();
                }}
                isBrinsUser={isBrinsUser}
                parsedClaims={parsedClaims}
                validationRemarks={validationRemarks}
                dialogError={dialogError}
                previewValidationError={previewValidationError}
                processing={processing}
                onPreview={handleFileUpload}
                onUpload={handleBulkUpload}
            />

            <SubrogationDialog
                open={dialogs.subrogation}
                onClose={() => closeDialog("subrogation")}
                claims={claims}
                notas={notas}
                user={user}
                canShowActions={canShowActionButtons}
                onSuccess={(msg) => {
                    setSuccessMessage(msg);
                    loadAll();
                }}
            />

            {selectedClaimForFiles && (
                <FilePreviewModal
                    open={filePreviewOpen}
                    onClose={() => {
                        setFilePreviewOpen(false);
                        setSelectedClaimForFiles(null);
                    }}
                    recordId={selectedClaimForFiles.nomor_peserta || selectedClaimForFiles.claim_no}
                />
            )}

            {/* ── BRINS Workflow Action Dialog ─────────────────────────────── */}
            <Dialog open={showActionDialog} onOpenChange={(open) => { setShowActionDialog(open); if (!open) { setRemarks(""); setActionError(""); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionType === "check" && "Check Claim — BRINS"}
                            {actionType === "approve_brins" && "Approve Claim — BRINS"}
                            {actionType === "revise" && "Request Revision"}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedClaim?.claim_no} — {selectedClaim?.nama_tertanggung}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="text-gray-500">Claim No:</span><span className="ml-2 font-medium">{selectedClaim?.claim_no}</span></div>
                                <div><span className="text-gray-500">Debtor:</span><span className="ml-2 font-medium">{selectedClaim?.nama_tertanggung}</span></div>
                                <div><span className="text-gray-500">Claim Amount:</span><span className="ml-2 font-bold">{formatRupiahAdaptive(Number(selectedClaim?.nilai_klaim) || 0)}</span></div>
                                <div><span className="text-gray-500">Current Status:</span><span className="ml-2"><StatusBadge status={selectedClaim?.status} /></span></div>
                            </div>
                        </div>
                        {actionType !== "check" && (
                            <div>
                                <Label>Remarks</Label>
                                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Enter remarks..." />
                            </div>
                        )}
                        {actionError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{actionError}</AlertDescription>
                            </Alert>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowActionDialog(false); setRemarks(""); setActionError(""); }}>Cancel</Button>
                        <Button onClick={handleClaimAction} disabled={actionProcessing} className="bg-blue-600" type="button">
                            {actionProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
