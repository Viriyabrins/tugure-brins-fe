import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    FileText,
    Upload,
    CheckCircle2,
    AlertCircle,
    Download,
    RefreshCw,
    Plus,
    DollarSign,
    TrendingUp,
    Paperclip,
} from "lucide-react";
import { formatRupiahAdaptive } from "@/utils/currency";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";

import { useUserTenant } from "@/shared/hooks/useUserTenant";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { useDialogs } from "@/shared/hooks/useDialogs";
import { useClaimData } from "../hooks/useClaimData";
import { useClaimUpload } from "../hooks/useClaimUpload";
import { ClaimUploadDialog } from "../components/ClaimUploadDialog";
import { SubrogationDialog } from "../components/SubrogationDialog";
import { FilePreviewModal } from "../components/FilePreviewModal";
import { ClaimTrendTab } from "../components/ClaimTrendTab";
import { DEFAULT_CLAIM_FILTER, CLAIM_TEMPLATE_HEADERS, CLAIM_TEMPLATE_SAMPLE } from "../utils/claimConstants";

export default function ClaimSubmit() {
    const { isBrinsUser, isTugureUser } = useUserTenant();
    const { user, userRoles, hasAnyRole } = useCurrentUser();

    const canShowActionButtons = hasAnyRole(
        "maker-brins-role",
        "checker-brins-role",
    );

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
        allClaimsForTrend,
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
        batches,
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
        { header: "Batch ID", accessorKey: "batch_id" },
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
                        key: "batch",
                        placeholder: "Batch ID",
                        label: "Batch ID",
                        options: [
                            { value: "all", label: "All Batches" },
                            ...batches.map((b) => ({
                                value: b.batch_id,
                                label: b.batch_id,
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
                            { value: "CHECKED", label: "Checked" },
                            { value: "APPROVED", label: "Approved" },
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
                    <TabsTrigger value="trend">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Trend Analysis
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

                <TabsContent value="trend" className="mt-4">
                    <ClaimTrendTab
                        allClaimsForTrend={allClaimsForTrend}
                        batches={batches}
                        isBrinsUser={isBrinsUser}
                    />
                </TabsContent>
            </Tabs>

            <ClaimUploadDialog
                open={dialogs.upload}
                onClose={() => {
                    closeDialog("upload");
                    resetUpload();
                }}
                batches={batches}
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
                    claimId={selectedClaimForFiles.claim_no}
                    batchId={selectedClaimForFiles.batch_id}
                />
            )}
        </div>
    );
}
