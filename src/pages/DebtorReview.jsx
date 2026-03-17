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
    History,
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
    sendNotificationEmail,
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
    const [revisionDiffs, setRevisionDiffs] = useState([]);
    const [showApprovalSummaryDialog, setShowApprovalSummaryDialog] = useState(false);
    const [approvalSummaryDebtors, setApprovalSummaryDebtors] = useState([]);

    // Batch picker dialog state
    const [showBatchPickerDialog, setShowBatchPickerDialog] = useState(false);
    const [uniqueBatches, setUniqueBatches] = useState([]);
    const [selectedBatchForAction, setSelectedBatchForAction] = useState(null);

    // Scope selection dialog state
    const [showScopeDialog, setShowScopeDialog] = useState(false);
    const [actionScope, setActionScope] = useState("selected"); // "selected" or "whole-batch"

    // Progress modal state
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [pollingInterval, setPollingInterval] = useState(null);

    useEffect(() => {
        loadUser();
        // load contracts/batches and initial page of debtors
        loadData();
    }, []);

    // Cleanup polling interval on unmount or modal close
    useEffect(() => {
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, [pollingInterval]);

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

    // Helper: Extract unique batch IDs from selectedDebtors
    const getUniqueBatchesFromSelection = () => {
        const selectedSet = new Set(selectedDebtors);
        const batches = debtors
            .filter((d) => selectedSet.has(d.id))
            .map((d) => d.batch_id)
            .filter(Boolean);
        return [...new Set(batches)];
    };

    // Helper: Handle action button click
    // Shows batch picker if multiple batches, else scope picker
    const handleActionButtonClick = (action) => {
        const uniqueBatches = getUniqueBatchesFromSelection();

        if (uniqueBatches.length === 0) {
            toast.error("Please select debtors first");
            return;
        }

        setApprovalAction(action);

        // If multiple batches, show batch picker
        if (uniqueBatches.length > 1) {
            setUniqueBatches(uniqueBatches);
            setShowBatchPickerDialog(true);
        } else {
            // Single batch - go straight to scope dialog
            setSelectedBatchForAction(uniqueBatches[0]);
            setActionScope("selected"); // default to selected
            setShowScopeDialog(true);
        }
    };

    // Helper: Handle batch selection
    const handleBatchSelect = (batchId) => {
        setSelectedBatchForAction(batchId);
        setShowBatchPickerDialog(false);
        setActionScope("selected");
        setShowScopeDialog(true);
    };

    // Helper: Poll job status
    const startPolling = (newJobId) => {
        setJobId(newJobId);
        let count = 0;

        const interval = setInterval(async () => {
            try {
                const status = await backend.getDebtorJobStatus(newJobId);
                setJobStatus(status);

                if (status.status === "COMPLETED" || status.status === "FAILED") {
                    clearInterval(interval);
                    setPollingInterval(null);

                    if (status.status === "COMPLETED") {
                        toast.success(
                            `Action completed: ${status.processedCount} success, ${status.failedCount} failed`
                        );
                    } else {
                        toast.error(`Action failed: ${status.message}`);
                    }

                    setTimeout(() => {
                        setShowProgressModal(false);
                        loadData();
                    }, 1500);
                }
            } catch (error) {
                console.error("Polling error:", error);
            }

            count++;
            if (count > 300) {
                // Stop after 2.5 minutes
                clearInterval(interval);
                setPollingInterval(null);
                toast.error("Job polling timeout");
            }
        }, 500); // Poll every 500ms

        setPollingInterval(interval);
    };

    const handleCheck = async (isBulk = false, debtorArg = null) => {
        const targetDebtors = isBulk
            ? debtors.filter((d) => selectedDebtors.includes(d.id))
            : debtorArg ? [debtorArg] : selectedDebtor ? [selectedDebtor] : [];

        if (targetDebtors.length === 0) {
            toast.error("Please select debtors to check");
            return;
        }

        setProcessing(true);
        let processedCount = 0;

        try {
            for (const debtor of targetDebtors) {
                if (!debtor || !debtor.id || debtor.status !== "APPROVED_BRINS") continue;

                await backend.update("Debtor", debtor.id, {
                    status: "CHECKED_TUGURE",
                });
                processedCount++;

                // Create audit log using backend client
                try {
                    await backend.create("AuditLog", {
                        action: "DEBTOR_CHECKED_TUGURE",
                        module: "DEBTOR",
                        entity_type: "Debtor",
                        entity_id: debtor.id,
                        old_value: JSON.stringify({ status: debtor.status }),
                        new_value: JSON.stringify({ status: "CHECKED_TUGURE", remarks: "" }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason: `Tugure Checker checked debtor ${debtor.nama_peserta || debtor.debtor_name}`,
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
            }

            if (processedCount === 0) {
                toast.warning("No debtors with APPROVED_BRINS status found in selection.");
                setProcessing(false);
                return;
            }

            // Notifications
            for (const role of ALL_ROLES) {
                try {
                    await backend.create("Notification", {
                        title: "Debtors Checked by Tugure",
                        message: `${auditActor?.user_email || user?.email} checked ${processedCount} debtor(s).`,
                        type: "INFO",
                        module: "DEBTOR",
                        reference_id: targetDebtors[0]?.batch_id,
                        target_role: role,
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            }

            // Email Notification via Background Fire-and-Forget
            sendNotificationEmail({
                targetGroup: "tugure-approver",
                objectType: "Record",
                statusTo: "CHECKED_TUGURE",
                recipientRole: "TUGURE",
                variables: {
                    debtor_count: String(processedCount),
                    action_by: auditActor?.user_email || user?.email,
                },
                fallbackSubject: `Debtor Checked - Awaiting Approval`,
                fallbackBody: `${processedCount} debtor(s) have been checked by ${auditActor?.user_email || user?.email} and are awaiting your approval.`,
            }).catch(err => console.error("Background email failed:", err));

            setSuccessMessage(`${processedCount} debtor(s) checked successfully.`);
            toast.success(`${processedCount} debtor(s) checked.`);
            setSelectedDebtor(null);
            setSelectedDebtors([]);
            
            // Reload data
            setTimeout(() => loadData(), 1000);
        } catch (error) {
            console.error("Check failed:", error);
            toast.error("Check action failed.");
        }
        setProcessing(false);
    };

    const handleApproveRevise = async () => {
        if (
            (!selectedDebtor && selectedDebtors.length === 0) ||
            !approvalAction
        ) {
            console.error("No debtors selected or no action specified");
            return;
        }

        // If action is "approve", show summary dialog first
        if (approvalAction.includes("approve")) {
            const isBulk = approvalAction.startsWith("bulk_");
            const debtorsToProcess = isBulk
                ? debtors.filter((d) => selectedDebtors.includes(d.id))
                : selectedDebtor
                    ? [selectedDebtor]
                    : [];
            
            if (debtorsToProcess.length === 0) return;
            
            setApprovalSummaryDebtors(debtorsToProcess);
            setShowApprovalSummaryDialog(true);
            return;
        }

        // For revision action, proceed directly
        await executeApproval();
    };

    const executeApproval = async () => {
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

            const newStatus = action === "approve" ? "APPROVED" : "REVISION";

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
            let totalPlafon = 0;
            let totalNetPremi = 0;
            const batchId = debtorsToProcess[0]?.batch_id;
            const contractId = debtorsToProcess[0]?.contract_id;

            for (const debtor of debtorsToProcess) {
                if (!debtor || !debtor.id || debtor.status !== "CHECKED_TUGURE") continue;

                try {
                    // Update debtor status
                    await backend.update("Debtor", debtor.id, {
                        status: newStatus,
                        revision_reason:
                            action === "revision" ? approvalRemarks : null,
                        validation_remarks:
                            action === "revision" ? approvalRemarks : null,
                    });
                    processedCount++;
                    totalPlafon += parseFloat(debtor.plafon) || 0;
                    totalNetPremi += parseFloat(debtor.net_premi) || 0;

                    if (action === "approve") {
                        // Create record
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

                    // Create audit log
                    try {
                        const actionLabel = action === "approve"
                            ? "DEBTOR_APPROVED"
                            : "DEBTOR_REVISION";
                        await backend.create("AuditLog", {
                            action: actionLabel,
                            module: "DEBTOR",
                            entity_type: "Debtor",
                            entity_id: debtor.id,
                            old_value: JSON.stringify({ status: debtor.status }),
                            new_value: JSON.stringify({ status: newStatus, remarks: approvalRemarks }),
                            user_email: auditActor?.user_email || user?.email,
                            user_role: auditActor?.user_role || user?.role,
                            reason: approvalRemarks,
                        });
                    } catch (auditError) {
                        console.warn("Failed to create audit log:", auditError);
                    }
                } catch (error) {
                    console.error(`Error processing debtor ${debtor.id}:`, error);
                }
            }

            if (processedCount === 0) {
                toast.warning("No debtors with CHECKED_TUGURE status found.");
                setShowApprovalDialog(false);
                setShowApprovalSummaryDialog(false);
                setProcessing(false);
                return;
            }

            // **GENERATE NOTA IF ACTION IS APPROVE**
            if (action === "approve" && contractId) {
                try {
                    // Fetch the Batch record to get pre-calculated premium values
                    let batchData = null;
                    try {
                        batchData = await backend.get("Batch", batchId);
                    } catch (batchErr) {
                        console.warn("Failed to fetch batch for Nota:", batchErr);
                    }

                    const notaNumber = `NOTA-${contractId}-${Date.now()}`;
                    await backend.create("Nota", {
                        nota_number: notaNumber,
                        nota_type: "Batch",
                        reference_id: batchId,
                        contract_id: contractId,
                        amount: totalNetPremi,
                        currency: "IDR",
                        status: "UNPAID",
                        issued_by: auditActor?.user_email || user?.email,
                        issued_date: new Date().toISOString(),
                        total_actual_paid: 0,
                        reconciliation_status: "PENDING",
                        premium: parseFloat(batchData?.premium) || 0,
                        commission: parseFloat(batchData?.commission) || 0,
                        claim: parseFloat(batchData?.claim) || 0,
                        total: parseFloat(batchData?.total) || 0,
                        net_due: parseFloat(batchData?.net_due) || 0,
                    });
                    console.log("Nota generated:", notaNumber);
                } catch (notaError) {
                    console.warn("Failed to generate Nota:", notaError);
                }
            }

            // Create notifications
            const notifTitle = action === "approve"
                ? "Debtors Approved (Final)"
                : "Debtors Marked for Revision";
            const notifMessage = isBulk
                ? `${auditActor?.user_email || user?.email} ${action === "approve" ? "approved" : "marked for revision"} ${processedCount} debtor(s).`
                : `${auditActor?.user_email || user?.email} ${action === "approve" ? "approved" : "marked for revision"} debtor.`;

            for (const role of ALL_ROLES) {
                try {
                    await backend.create("Notification", {
                        title: notifTitle,
                        message: notifMessage,
                        type: action === "revision" ? "WARNING" : "INFO",
                        module: "DEBTOR",
                        reference_id: isBulk ? batchId : selectedDebtor?.id,
                        target_role: role,
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            }

            setSuccessMessage(
                action === "approve" 
                    ? `${processedCount} debtor(s) approved. Nota generated.`
                    : `${processedCount} debtor(s) marked for revision.`
            );
            
            setShowApprovalDialog(false);
            setShowApprovalSummaryDialog(false);
            setSelectedDebtor(null);
            setSelectedDebtors([]);
            setApprovalRemarks("");
            setApprovalSummaryDebtors([]);

            setTimeout(() => loadData(), 1000);
        } catch (error) {
            console.error("Approval error:", error);
            toast.error("Failed to process approval");
        }
        setProcessing(false);
    };

    // Execute approval for whole batch (async with real-time progress)
    const executeApprovalWholeBatch = async () => {
        if (!selectedBatchForAction || !approvalAction) {
            toast.error("Invalid action or batch");
            return;
        }

        setProcessing(true);
        const action = approvalAction.replace("bulk_", "");

        try {
            // Build filters for the backend to query matching debtors
            const backendFilters = {
                batch_id: selectedBatchForAction,
                ...filters, // Include active filters from the UI
            };

            // Call backend to start bulk action job
            const response = await backend.startBulkDebtorAction({
                action,
                filters: backendFilters,
                remarks: approvalRemarks,
                batchId: selectedBatchForAction,
                contract_id: filters.contract && filters.contract !== 'all' ? filters.contract : undefined,
            });

            if (response && response.jobId) {
                // Open progress modal and start polling
                setShowProgressModal(true);
                setApprovalRemarks("");
                setSelectedDebtor(null);
                setSelectedDebtors([]);
                startPolling(response.jobId);
            } else {
                toast.error("Failed to start bulk action job");
            }
        } catch (error) {
            console.error("Bulk action error:", error);
            toast.error(`Failed to start bulk action: ${error.message}`);
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

    // Fetch revision diffs when detail dialog opens for a REVISION status debtor
    useEffect(() => {
        console.log('%c[RevisionDiffs] useEffect triggered', 'color: cyan; font-weight: bold');
        console.log('showDetailDialog:', showDetailDialog, 'selectedDebtor:', selectedDebtor);
        
        let mounted = true;
        const fetchRevisionDiffs = async () => {
            console.log('%c[RevisionDiffs] fetchRevisionDiffs called', 'color: yellow');
            
            if (!showDetailDialog || !selectedDebtor) {
                console.log('[RevisionDiffs] Early return: showDetailDialog or selectedDebtor is falsy');
                if (mounted) setRevisionDiffs([]);
                return;
            }

            const version = selectedDebtor?.version_no || 0;
            console.log('[RevisionDiffs] Debtor version_no:', version, 'Is revised?', version > 1);
            
            if (version <= 1) {
                console.log('[RevisionDiffs] Early return: not a revised debtor (version_no <= 1)');
                if (mounted) setRevisionDiffs([]);
                return;
            }

            try {
                console.log('[RevisionDiffs] Fetching for nomor_peserta:', selectedDebtor.nomor_peserta);
                const res = await backend.listPaginated('DebtorRevise', {
                    page: 1,
                    limit: 100,
                    q: JSON.stringify({ nomor_peserta: selectedDebtor.nomor_peserta }),
                });
                
                console.log('[RevisionDiffs] Query response:', res);
                console.log('[RevisionDiffs] res.data:', res?.data);

                if (!Array.isArray(res?.data) || res.data.length === 0) {
                    console.warn('[RevisionDiffs] No records found OR res.data is not array. res.data:', res?.data);
                    if (mounted) setRevisionDiffs([]);
                    return;
                }

                const prev = res.data[0];
                console.log('[RevisionDiffs] Previous version:', prev);
                console.log('[RevisionDiffs] Current version_no:', selectedDebtor.version_no);

                const diffs = [];
                const keys = Object.keys(selectedDebtor || {}).filter((k) => 
                    k !== 'id' && k !== 'created_at' && k !== 'updated_at' && k !== 'archived_at'
                );
                
                console.log('[RevisionDiffs] Keys to compare:', keys);
                
                for (const k of keys) {
                    const oldVal = prev[k];
                    const newVal = selectedDebtor[k];
                    const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal);
                    const newStr = newVal === null || newVal === undefined ? '' : String(newVal);
                    if (oldStr !== newStr) {
                        diffs.push({ key: k, old: oldStr || '-', new: newStr || '-' });
                    }
                }
                
                console.log('[RevisionDiffs] Final diffs array:', diffs);
                if (mounted) {
                    setRevisionDiffs(diffs);
                    console.log('[RevisionDiffs] setRevisionDiffs called with:', diffs);
                }
            } catch (e) {
                console.error('[RevisionDiffs] Exception caught:', e);
                if (mounted) setRevisionDiffs([]);
            }
        };
        
        fetchRevisionDiffs();
        return () => {
            mounted = false;
        };
    }, [showDetailDialog, selectedDebtor]);

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
            header: "action",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelectedDebtor(row);
                            setShowDetailDialog(true);
                        }}
                        title="View detail"
                    >
                        <Eye className="w-4 h-4" />
                    </Button>
                </div>
            ),
            width: "80px",
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
                            // variant="outline"
                            onClick={() => handleActionButtonClick("bulk_check")}
                            disabled={processing || showBatchPickerDialog || showScopeDialog}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Check ({selectedDebtors.length})
                        </Button>
                    )}
                    {isApproverTugure && (
                        <Button
                            variant="outline"
                            onClick={() => handleActionButtonClick("bulk_approve")}
                            disabled={processing || showBatchPickerDialog || showScopeDialog}
                        >
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Approve ({selectedDebtors.length})
                        </Button>
                    )}
                    {isApproverTugure && (
                        <Button
                            variant="outline"
                            onClick={() => handleActionButtonClick("bulk_revision")}
                            disabled={processing || showBatchPickerDialog || showScopeDialog}
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
                            {selectedDebtor?.version_no && (
                                <div>
                                    <span className="text-gray-500">
                                        Version No:
                                    </span>
                                    <p className="font-medium">
                                        {selectedDebtor.version_no}
                                    </p>
                                </div>
                            )}
                        </div>
                        {/* Revision Diffs Section */}
                        {(selectedDebtor?.version_no || 0) > 1 && revisionDiffs && revisionDiffs.length > 0 && (
                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <History className="w-5 h-5 text-blue-600" />
                                    <h3 className="font-semibold text-blue-900">Revision Changes</h3>
                                </div>
                                <div className="space-y-2">
                                    {revisionDiffs.slice(0, 15).map((diff, idx) => (
                                        <div key={idx} className="flex items-start gap-3 text-sm">
                                            <span className="font-mono text-xs bg-white px-2 py-1 rounded text-gray-700 flex-shrink-0 min-w-32">
                                                {diff.key}
                                            </span>
                                            <div className="flex-1">
                                                <p className="text-red-600 line-through text-xs">Old: {diff.old}</p>
                                                <p className="text-green-600 text-xs">New: {diff.new}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {revisionDiffs.length > 15 && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            ...and {revisionDiffs.length - 15} more changes
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
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
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            className={
                                approvalAction?.includes("approve")
                                    ? "bg-green-600 hover:bg-green-700 text-white"
                                    : "bg-orange-600 hover:bg-orange-700 text-white"
                            }
                            onClick={handleApproveRevise}
                            disabled={
                                processing ||
                                (approvalAction?.includes("revision") &&
                                    !approvalRemarks.trim())
                            }
                        >
                            {processing
                                ? "Processing..."
                                : approvalAction?.includes("approve")
                                  ? "Confirm Approval"
                                  : "Submit Revision Request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approval Summary Dialog */}
            <Dialog open={showApprovalSummaryDialog} onOpenChange={setShowApprovalSummaryDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Approve Debtors & Generate Nota</DialogTitle>
                        <DialogDescription>
                            Review the debtors that will be approved and a Nota will be automatically generated.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div>
                                <p className="text-sm text-gray-600">Total Debtors</p>
                                <p className="text-2xl font-bold text-blue-600">{approvalSummaryDebtors.length}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Total Exposure</p>
                                <p className="text-lg font-semibold">
                                    {formatRupiahAdaptive(
                                        approvalSummaryDebtors.reduce((sum, d) => sum + (parseFloat(d.plafon) || 0), 0)
                                    )}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Total Net Premi</p>
                                <p className="text-lg font-semibold">
                                    {formatRupiahAdaptive(
                                        approvalSummaryDebtors.reduce((sum, d) => sum + (parseFloat(d.net_premi) || 0), 0)
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Debtor List */}
                        <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-semibold">Nomor Peserta</th>
                                        <th className="px-4 py-2 text-left font-semibold">Nama</th>
                                        <th className="px-4 py-2 text-right font-semibold">Plafon</th>
                                        <th className="px-4 py-2 text-right font-semibold">Net Premi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {approvalSummaryDebtors.map((d, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            <td className="px-4 py-2">{d.nomor_peserta}</td>
                                            <td className="px-4 py-2 text-sm">{d.nama_peserta}</td>
                                            <td className="px-4 py-2 text-right">{formatRupiahAdaptive(d.plafon)}</td>
                                            <td className="px-4 py-2 text-right">{formatRupiahAdaptive(d.net_premi)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <Alert className="border-green-200 bg-green-50">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                                An invoice Nota (UNPAID status) will be generated automatically and visible in Nota Management.
                            </AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowApprovalSummaryDialog(false);
                                setApprovalSummaryDebtors([]);
                            }}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={executeApproval}
                            disabled={processing}
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Approve & Generate Nota
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Batch Picker Dialog */}
            <Dialog open={showBatchPickerDialog} onOpenChange={setShowBatchPickerDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Batch</DialogTitle>
                        <DialogDescription>
                            Multiple batches found in your selection. Which batch do you want to apply this action to?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {uniqueBatches.map((batchId) => {
                            const count = selectedDebtors.filter(
                                (id) =>
                                    debtors.find((d) => d.id === id)?.batch_id === batchId
                            ).length;
                            return (
                                <Button
                                    key={batchId}
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => handleBatchSelect(batchId)}
                                >
                                    <span className="font-mono">{batchId}</span>
                                    <span className="ml-auto text-xs text-gray-500">
                                        {count} selected
                                    </span>
                                </Button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Scope Selection Dialog */}
            <Dialog open={showScopeDialog} onOpenChange={setShowScopeDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Action Scope</DialogTitle>
                        <DialogDescription>
                            {selectedBatchForAction && (
                                <>
                                    Apply action to which debtors in batch{" "}
                                    <span className="font-mono font-semibold">
                                        {selectedBatchForAction}
                                    </span>
                                    ?
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Option A: Selected rows only */}
                        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="scope"
                                value="selected"
                                checked={actionScope === "selected"}
                                onChange={(e) => setActionScope(e.target.value)}
                                className="mt-1"
                            />
                            <div>
                                <p className="font-medium">
                                    {selectedDebtors.length} selected row(s)
                                </p>
                                <p className="text-xs text-gray-500">
                                    Apply action only to debtors selected on current page
                                </p>
                            </div>
                        </label>

                        {/* Option B: Whole batch */}
                        <label className="flex items-start gap-3 p-4 border rounded-lg border-blue-200 bg-blue-50 cursor-pointer">
                            <input
                                type="radio"
                                name="scope"
                                value="whole-batch"
                                checked={actionScope === "whole-batch"}
                                onChange={(e) => setActionScope(e.target.value)}
                                className="mt-1"
                            />
                            <div>
                                <p className="font-medium text-blue-900">
                                    {selectedBatchForAction}
                                </p>
                                <p className="text-xs text-blue-700">
                                    Apply action to all debtors in this batch with real-time
                                    progress tracking
                                </p>
                            </div>
                        </label>

                        {/* Show only for non-check actions */}
                        {!approvalAction.includes("check") && (
                            <div>
                                <label className="text-sm font-medium">Remarks *</label>
                                <Textarea
                                    value={approvalRemarks}
                                    onChange={(e) => setApprovalRemarks(e.target.value)}
                                    placeholder={
                                        approvalAction.includes("approval")
                                            ? "Enter approval notes..."
                                            : "Enter revision reason..."
                                    }
                                    rows={3}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowScopeDialog(false)}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                setShowScopeDialog(false);
                                if (actionScope === "selected") {
                                    // Use existing logic for page-based actions
                                    if (approvalAction === "bulk_check") {
                                        handleCheck(true);
                                    } else if (approvalAction === "bulk_approve") {
                                        setApprovalAction("bulk_approve");
                                        setShowApprovalDialog(true);
                                    } else if (approvalAction === "bulk_revision") {
                                        setApprovalAction("bulk_revision");
                                        setShowApprovalDialog(true);
                                    }
                                } else {
                                    // Whole batch action - trigger via executeApprovalWholeB batch
                                    executeApprovalWholeBatch();
                                }
                            }}
                            disabled={
                                processing ||
                                (!approvalAction.includes("check") &&
                                    !approvalRemarks.trim())
                            }
                        >
                            {processing ? "Processing..." : "Proceed"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Progress Modal */}
            <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Bulk Action Progress</DialogTitle>
                        <DialogDescription>
                            {approvalAction}
                        </DialogDescription>
                    </DialogHeader>

                    {jobStatus && (
                        <div className="space-y-4">
                            {/* Progress Stats */}
                            <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                                <div>
                                    <p className="text-xs text-gray-600">Processed</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {jobStatus.processedCount || 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600">Total</p>
                                    <p className="text-2xl font-bold text-gray-700">
                                        {jobStatus.totalCount}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600">Progress</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {jobStatus.percentage}%
                                    </p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-green-600 h-full transition-all duration-300"
                                        style={{
                                            width: `${jobStatus.percentage || 0}%`,
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-gray-600 text-center">
                                    {jobStatus.message}
                                </p>
                            </div>

                            {/* Errors if any */}
                            {jobStatus.errors && jobStatus.errors.length > 0 && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm font-medium text-red-700 mb-2">
                                        Errors ({jobStatus.errors.length}):
                                    </p>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {jobStatus.errors.slice(0, 10).map((err, idx) => (
                                            <div
                                                key={idx}
                                                className="text-xs text-red-600"
                                            >
                                                <span className="font-mono">
                                                    {err.debtorId || err.error}
                                                </span>
                                                : {err.error || err.nama}
                                            </div>
                                        ))}
                                        {jobStatus.errors.length > 10 && (
                                            <p className="text-xs text-red-500">
                                                ...and {jobStatus.errors.length - 10} more
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Status badge */}
                            <div className="flex justify-center">
                                {jobStatus.status === "PROCESSING" && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processing...
                                    </div>
                                )}
                                {jobStatus.status === "COMPLETED" && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Completed
                                    </div>
                                )}
                                {jobStatus.status === "FAILED" && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                                        <X className="w-4 h-4" />
                                        Failed
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
