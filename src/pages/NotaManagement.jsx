import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle2,
    RefreshCw,
    ArrowRight,
    Loader2,
    Eye,
    FileText,
    Clock,
    DollarSign,
    AlertTriangle,
    Scale,
    Plus,
    X,
    AlertCircle,
    Lock,
    Check,
    Download,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";
import FilterTab from "@/components/common/FilterTab";
import {
    sendTemplatedEmail,
    createNotification,
    createAuditLog,
} from "@/components/utils/emailTemplateHelper";
import { formatRupiahAdaptive } from "@/utils/currency";
import GradientStatCard from "@/components/dashboard/GradientStatCard";

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const nearlyEqual = (a, b) => Math.abs(a - b) < 0.0001;

// Compute nota amount from debtors when nota is batch-type
const getNotaAmount = (nota) => {
    try {
        if (!nota) return 0;
        if (nota.nota_type === "Batch" && nota.reference_id) {
            const batchDebtors = debtors.filter(
                (d) => d.batch_id === nota.reference_id,
            );
            return batchDebtors.reduce((s, d) => s + toNumber(d.net_premi), 0);
        }
        return toNumber(nota.amount);
    } catch (e) {
        return toNumber(nota.amount);
    }
};

const defaultFilter = {
    contract: "all",
    notaType: "all",
    status: "all",
};

const defaultFilterRecon = {
    contract: "all",
    status: "all",
    hasException: "all",
};

const defaultFilterDnCn = {
    contract: "all",
    noteType: "all",
    status: "all",
};

const normalizeRole = (role = "") => String(role).trim().toLowerCase();
const BRINS_ACTION_ROLES = ["maker-brins-role", "checker-brins-role", "approver-brins-role"];

const isBrinsRole = (roles = []) => 
    (Array.isArray(roles) ? roles : [])
        .map(normalizeRole)
        .some((role) => BRINS_ACTION_ROLES.includes(role));

export default function NotaManagement() {
    const [user, setUser] = useState(null);
    const [tokenRoles, setTokenRoles] = useState([]);
    const [auditActor, setAuditActor] = useState(null);
    const [notas, setNotas] = useState([]);
    const [batches, setBatches] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [payments, setPayments] = useState([]);
    const [paymentIntents, setPaymentIntents] = useState([]);
    const [dnCnRecords, setDnCnRecords] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedNota, setSelectedNota] = useState(null);
    const [selectedDnCn, setSelectedDnCn] = useState(null);
    const [selectedRecon, setSelectedRecon] = useState(null);
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [showDnCnDialog, setShowDnCnDialog] = useState(false);
    const [showDnCnActionDialog, setShowDnCnActionDialog] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [actionType, setActionType] = useState("");
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [remarks, setRemarks] = useState("");
    const [activeTab, setActiveTab] = useState("notas");
    const [paymentFormData, setPaymentFormData] = useState({
        actual_paid_amount: "",
        payment_date: new Date().toISOString().split("T")[0],
        bank_reference: "",
    });
    const [dnCnFormData, setDnCnFormData] = useState({
        note_type: "Debit Note",
        adjustment_amount: 0,
        reason_code: "Payment Difference",
        reason_description: "",
    });
    const [filters, setFilters] = useState(defaultFilter);
    const [reconFilters, setReconFilters] = useState(defaultFilterRecon);
    const [dnCnFilters, setDnCnFilters] = useState(defaultFilterDnCn);
    const [showNotaStatusDialog, setShowNotaStatusDialog] = useState(false);
    const [selectedNotaForStatus, setSelectedNotaForStatus] = useState(null);
    const [newNotaStatus, setNewNotaStatus] = useState("PAID");
    const canManageNotaActions = isBrinsRole(tokenRoles);
    const [subrogations, setSubrogations] = useState([]);

    // Nota pagination state
    const notaPageSize = 10;
    const [notaPage, setNotaPage] = useState(1);
    const [totalNotas, setTotalNotas] = useState(0);
    const isFirstNotaPageEffect = useRef(true);

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
                // Handle roles as BOTH string and array
                const rolesArray = Array.isArray(roles) 
                    ? roles 
                    : typeof roles === 'string' 
                        ? [roles] 
                        : [];
                setTokenRoles(rolesArray);
                const role =
                    actor?.user_role ||
                    (rolesArray && rolesArray.length > 0
                        ? normalizeRole(rolesArray[0])
                        : "user");
                setUser({ id: userInfo.id, email: userInfo.email, full_name: userInfo.name, role });
                console.log("DEBUG - Raw roles from Keycloak:", roles);
                console.log("DEBUG - rolesArray after normalization:", rolesArray);
                console.log("DEBUG - isBrinsRole result:", isBrinsRole(rolesArray));
                console.log("DEBUG - user role:", role);
            }
        } catch (error) {
            console.error("Failed to load user:", error);
        }
    };

    const loadNotas = async (pageToLoad = notaPage, activeFilters = filters) => {
        try {
            const query = { page: pageToLoad, limit: notaPageSize };
            if (activeFilters) query.q = JSON.stringify(activeFilters);
            const result = await backend.listPaginated("Nota", query);
            const data = Array.isArray(result.data) ? result.data : [];
            setNotas(data);
            setTotalNotas(Number(result.pagination?.total) || 0);
            console.log("notas",data);
            return data;
        } catch (error) {
            console.error("Error loading notas:", error);
            setNotas([]);
            setTotalNotas(0);
            return [];
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            // Load notas with pagination, everything else in bulk
            const [
                notaData,
                batchData,
                contractData,
                paymentData,
                paymentIntentData,
                dnCnData,
                debtorData,
                subrogationData,
            ] = await Promise.all([
                loadNotas(1, filters),
                backend.list("Batch"),
                backend.list("Contract"),
                backend.list("Payment"),
                backend.list("PaymentIntent"),
                backend.list("DebitCreditNote"),
                backend.list("Debtor"),
                backend.list("Subrogation"),
            ]);

            const nextNotas = Array.isArray(notaData) ? notaData : [];
            const rawBatches = Array.isArray(batchData) ? batchData : [];
            const nextContracts = Array.isArray(contractData)
                ? contractData
                : [];
            const nextPayments = Array.isArray(paymentData) ? paymentData : [];
            const nextPaymentIntents = Array.isArray(paymentIntentData)
                ? paymentIntentData
                : [];
            const nextDnCnRecords = Array.isArray(dnCnData) ? dnCnData : [];
            const nextDebtors = Array.isArray(debtorData) ? debtorData : [];
            setSubrogations(Array.isArray(subrogationData) ? subrogationData : []);

            const batchReviewSync = rawBatches.map((batch) => {
                const batchDebtors = nextDebtors.filter(
                    (debtor) => debtor.batch_id === batch.batch_id,
                );

                if (batchDebtors.length === 0) {
                    return {
                        batch,
                        needsUpdate: false,
                        updatePayload: null,
                        batchId: batch.batch_id || batch.id,
                        isFinal: false,
                    };
                }

                // For nota generation we only consider debtors with explicit DB status === 'APPROVED'
                const approvedDebtors = batchDebtors.filter(
                    (d) =>
                        (d.status || "").toString().toUpperCase() ===
                        "APPROVED",
                );

                // All debtors in a batch must be APPROVED before the batch is final
                const allApproved =
                    batchDebtors.length > 0 &&
                    approvedDebtors.length === batchDebtors.length;

                const finalExposureAmount = approvedDebtors.reduce(
                    (sum, debtor) => sum + toNumber(debtor.plafon),
                    0,
                );
                const finalPremiumAmount = approvedDebtors.reduce(
                    (sum, debtor) => sum + toNumber(debtor.net_premi),
                    0,
                );

                const currentFinalExposure = toNumber(
                    batch.final_exposure_amount,
                );
                const currentFinalPremium = toNumber(
                    batch.final_premium_amount,
                );
                const currentAllApproved = Boolean(
                    batch.debtor_review_completed,
                );

                const needsUpdate =
                    currentAllApproved !== allApproved ||
                    !nearlyEqual(currentFinalExposure, finalExposureAmount) ||
                    !nearlyEqual(currentFinalPremium, finalPremiumAmount);

                return {
                    batch: {
                        ...batch,
                        debtor_review_completed: allApproved,
                        batch_ready_for_nota: allApproved,
                        final_exposure_amount: finalExposureAmount,
                        final_premium_amount: finalPremiumAmount,
                    },
                    needsUpdate,
                    updatePayload: {
                        debtor_review_completed: allApproved,
                        batch_ready_for_nota: allApproved,
                        final_exposure_amount: finalExposureAmount,
                        final_premium_amount: finalPremiumAmount,
                    },
                    batchId: batch.batch_id || batch.id,
                    isFinal: allApproved,
                    allApproved,
                };
            });

            const updatedBatches = batchReviewSync.map((entry) => entry.batch);

            // Create map of batch_id to Final status
            const batchNotaMap = {};
            batchReviewSync.forEach((entry) => {
                if (entry.batchId) {
                    batchNotaMap[entry.batchId] = {
                        isFinal: entry.isFinal,
                        batchData: entry.batch,
                    };
                }
            });
            
            setNotas(nextNotas);
            setBatches(updatedBatches);
            setContracts(nextContracts);
            setPayments(nextPayments);
            setPaymentIntents(nextPaymentIntents);
            setDnCnRecords(nextDnCnRecords);
            setDebtors(nextDebtors);
        } catch (error) {
            console.error("Failed to load data:", error);
            setNotas([]);
            setTotalNotas(0);
            setBatches([]);
            setContracts([]);
            setPayments([]);
            setPaymentIntents([]);
            setDnCnRecords([]);
            setDebtors([]);
        }
        setLoading(false);
    };

    // Nota pagination effects
    useEffect(() => {
        if (isFirstNotaPageEffect.current) { isFirstNotaPageEffect.current = false; return; }
        loadNotas(notaPage, filters);
    }, [notaPage]);

    const getNextStatus = (currentStatus) => {
        // Normalize old status values to new ones
        const normalizedStatus = normalizeNotaStatus(currentStatus);
        const workflow = ["UNPAID", "PAID"];
        const currentIndex = workflow.indexOf(normalizedStatus);
        return currentIndex >= 0 && currentIndex < workflow.length - 1
            ? workflow[currentIndex + 1]
            : null;
    };

    const normalizeNotaStatus = (status) => {
        if (!status) return "UNPAID";
        const statusMap = {
            "UNPAID": "UNPAID",
            "PAID": "PAID"
        };
        return statusMap[status] || status;
    };

    const handleNotaAction = async () => {
        if (!selectedNota || !actionType) return;

        setProcessing(true);
        try {
            const nextStatus = getNextStatus(selectedNota.status);
            if (!nextStatus) {
                setProcessing(false);
                return;
            }

            const updateData = { status: nextStatus };

            if (nextStatus === "PAID") {
                updateData.marked_paid_by = user?.email;
                updateData.marked_paid_date = new Date().toISOString();
            }

            await backend.update(
                "Nota",
                selectedNota.nota_number || selectedNota.id,
                updateData,
            );

            // Create notification using backend client
            try {
                await backend.create("Notification", {
                    title: `Nota marked as PAID`,
                    message: `Nota ${selectedNota.nota_number} (${selectedNota.nota_type}) has been marked as PAID.`,
                    type: "INFO",
                    module: "DEBTOR",
                    reference_id: selectedNota.nota_number,
                    target_role: "ALL",
                });
            } catch (notifError) {
                console.warn("Failed to create notification:", notifError);
            }

            // Create audit log using backend client
            try {
                await backend.create("AuditLog", {
                    action: `NOTA_MARKED_PAID`,
                    module: "DEBTOR",
                    entity_type: "Nota",
                    entity_id: selectedNota.nota_number,
                    old_value: JSON.stringify({ status: selectedNota.status }),
                    new_value: JSON.stringify({ status: nextStatus }),
                    user_email: auditActor?.user_email || user?.email,
                    user_role: auditActor?.user_role || user?.role,
                    reason: remarks,
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            setSuccessMessage(`Nota marked as PAID successfully`);
            setShowActionDialog(false);
            setSelectedNota(null);
            setRemarks("");
            loadData();
        } catch (error) {
            console.error("Action error:", error);
        }
        setProcessing(false);
    };

    const handleChangeNotaStatus = async () => {
        if (!selectedNotaForStatus) return;
        
        setProcessing(true);
        try {
            await backend.update("Nota", selectedNotaForStatus.nota_number, {
                status: newNotaStatus,
                marked_paid_by: auditActor?.user_email || user?.email,
                marked_paid_date: new Date().toISOString(),
            });
            
            // Reload notas
            await loadNotas(notaPage, filters);
            setShowNotaStatusDialog(false);
            setSelectedNotaForStatus(null);
            setNewNotaStatus("PAID");
            setSuccessMessage(`Nota status updated to ${newNotaStatus}`);
        } catch (error) {
            console.error("Failed to update nota status:", error);
            setSuccessMessage("");
        }
        setProcessing(false);
    };

    const parseNumberSafe = (value) => {
        if (value === null || value === undefined || value === "") return 0;

        if (typeof value === "number") {
            if (isNaN(value) || !isFinite(value)) return 0;
            return value;
        }

        let str = value.toString().trim();

        if (str === "") return 0;

        let cleaned = str;

        cleaned = cleaned.replace(/,/g, "");

        cleaned = cleaned.replace(/[^\d.-]/g, "");

        if (cleaned.startsWith("-")) {
            cleaned = "-" + cleaned.substring(1).replace(/-/g, "");
        } else {
            cleaned = cleaned.replace(/-/g, "");
        }

        const num = parseFloat(cleaned);

        if (isNaN(num) || !isFinite(num)) {
            console.warn(`Failed to parse number: "${value}" -> "${cleaned}"`);
            return 0;
        }

        return num;
    };

    const PaymentCalculationDisplay = ({
        paymentAmount,
        previousPaid,
        notaAmount,
    }) => {
        const paidAmount = parseNumberSafe(paymentAmount);
        const prevPaid = parseNumberSafe(previousPaid) || 0;
        const notaAmt = parseNumberSafe(notaAmount) || 0;

        const newTotalPaid = prevPaid + paidAmount;
        const difference = notaAmt - newTotalPaid;
        const absDiff = Math.abs(difference);

        let diffStatus = "";
        if (difference > 1000) {
            diffStatus = "PARTIAL";
        } else if (difference < -1000) {
            diffStatus = "OVERPAID";
        }

        const isMatched = absDiff <= 1000;

        return (
            <div
                className="mt-2 p-3 rounded-lg border-2"
                style={{
                    backgroundColor: isMatched ? "#d1fae5" : "#fed7aa",
                    borderColor: isMatched ? "#10b981" : "#f59e0b",
                }}
            >
                <div className="text-sm font-semibold">
                    New Total Paid: Rp {newTotalPaid.toLocaleString("id-ID")}
                </div>
                <div className="text-xs mt-1">
                    {isMatched
                        ? "✓ MATCHED - Nota will auto-close"
                        : `⚠️ ${diffStatus} - Difference: Rp ${absDiff.toLocaleString("id-ID")}`}
                </div>
                {paidAmount < 0 && (
                    <div className="text-xs mt-1 text-red-600">
                        ⚠️ Negative payment (adjustment) will reduce total paid
                    </div>
                )}
            </div>
        );
    };

    const handleRecordPayment = async () => {
        if (!selectedRecon || !paymentFormData.actual_paid_amount) return;

        setProcessing(true);
        try {
            const paidAmount = parseNumberSafe(
                paymentFormData.actual_paid_amount,
            );
            if (isNaN(paidAmount)) {
                alert("Please enter a valid number for the paid amount.");
                setProcessing(false);
                return;
            }

            const notaAmount = parseNumberSafe(selectedRecon.amount) || 0;
            const previousPaid =
                parseNumberSafe(selectedRecon.total_actual_paid) || 0;
            const newTotalPaid = previousPaid + paidAmount;
            const difference = notaAmount - newTotalPaid;

            let matchStatus = "RECEIVED";
            let exceptionType = "NONE";
            let reconStatus = "PARTIAL";

            if (Math.abs(difference) <= 1000) {
                matchStatus = "MATCHED";
                exceptionType = "NONE";
                reconStatus = "MATCHED";
            } else if (difference > 0) {
                matchStatus = "PARTIALLY_MATCHED";
                exceptionType = "UNDER";
                reconStatus = "PARTIAL";
            } else {
                matchStatus = "PARTIALLY_MATCHED";
                exceptionType = "OVER";
                reconStatus = "OVERPAID";
            }

            if (paidAmount === 0) {
                alert("Payment amount cannot be zero.");
                setProcessing(false);
                return;
            }

            const paymentRef =
                paymentFormData.bank_reference ||
                `PAY-${selectedRecon.nota_number}-${Date.now()}`;

            const paymentDateISO = new Date(
                paymentFormData.payment_date,
            ).toISOString();

            await backend.create("Payment", {
                payment_ref: paymentRef,
                invoice_id: selectedRecon.nota_number,
                contract_id: selectedRecon.contract_id,
                amount: paidAmount,
                payment_date: paymentDateISO,
                bank_reference: paymentFormData.bank_reference,
                currency: "IDR",
                match_status: matchStatus,
                exception_type: exceptionType,
                matched_by: user?.email,
                matched_date: new Date().toISOString(),
                is_actual_payment: true,
            });

            // Update Nota with accumulated payment
            await backend.update("Nota", selectedRecon.nota_number, {
                total_actual_paid: newTotalPaid,
                reconciliation_status: reconStatus,
            });

            // If MATCHED, auto mark Nota as PAID
            if (reconStatus === "MATCHED") {
                await backend.update("Nota", selectedRecon.nota_number, {
                    status: "PAID",
                    paid_date: paymentDateISO,
                    payment_reference: paymentRef,
                });

                // Create notification using backend client
                try {
                    await backend.create("Notification", {
                        title: "Payment MATCHED - Nota Marked PAID",
                        message: `Nota ${selectedRecon.nota_number} fully paid. Amount: Rp ${newTotalPaid.toLocaleString("id-ID")}. Status marked as PAID.`,
                        type: "INFO",
                        module: "DEBTOR",
                        reference_id: selectedRecon.nota_number,
                        target_role: "ALL",
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            } else {
                try {
                    await backend.create("Notification", {
                        title: `Payment ${reconStatus} - ${exceptionType !== "NONE" ? "Exception Detected" : "Partial"}`,
                        message: `Nota ${selectedRecon.nota_number}: Rp ${paidAmount.toLocaleString("id-ID")} recorded. Total paid: Rp ${newTotalPaid.toLocaleString("id-ID")}. ${exceptionType === "UNDER" ? "UNDERPAYMENT" : exceptionType === "OVER" ? "OVERPAYMENT" : "PARTIAL"} (Difference: Rp ${Math.abs(difference).toLocaleString("id-ID")})`,
                        type: exceptionType !== "NONE" ? "WARNING" : "INFO",
                        module: "DEBTOR",
                        reference_id: selectedRecon.nota_number,
                        target_role: "ALL",
                    });
                } catch (notifError) {
                    console.warn("Failed to create notification:", notifError);
                }
            }

            // Create audit log using backend client
            try {
                await backend.create("AuditLog", {
                    action: "PAYMENT_RECORDED",
                    module: "PAYMENT",
                    entity_type: "Payment",
                    entity_id: paymentRef,
                    old_value: "{}",
                    new_value: JSON.stringify({
                        nota_id: selectedRecon.nota_number,
                        amount: paidAmount,
                        match_status: matchStatus,
                        exception_type: exceptionType,
                    }),
                    user_email: auditActor?.user_email || user?.email,
                    user_role: auditActor?.user_role || user?.role,
                    reason: paymentFormData.bank_reference || "",
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            setSuccessMessage(
                `Payment recorded: ${reconStatus}. ${exceptionType !== "NONE" ? `Exception may be required for ${exceptionType === "UNDER" ? "underpayment" : "overpayment"}.` : ""}`,
            );
            setShowPaymentDialog(false);
            setSelectedRecon(null);
            setPaymentFormData({
                actual_paid_amount: "",
                payment_date: new Date().toISOString().split("T")[0],
                bank_reference: "",
            });
            loadData();
        } catch (error) {
            console.error("Payment error:", error);
        }
        setProcessing(false);
    };

    const handleMarkReconFinal = async (nota) => {
        if (nota.reconciliation_status === "PARTIAL") {
            const diff = (nota.amount || 0) - (nota.total_actual_paid || 0);
            if (Math.abs(diff) > 1000) {
                alert(
                    `❌ Cannot mark as FINAL while payment is PARTIAL.\n\nDifference: Rp ${Math.abs(diff).toLocaleString()}\n\nPlease record additional payments or create Exception to resolve the difference.`,
                );

                try {
                    await backend.create("AuditLog", {
                        action: "BLOCKED_RECON_FINAL",
                        module: "RECONCILIATION",
                        entity_type: "Nota",
                        entity_id: nota.nota_number,
                        old_value: "{}",
                        new_value: JSON.stringify({
                            blocked_reason:
                                "PARTIAL payment - difference exists",
                        }),
                        user_email: auditActor?.user_email || user?.email,
                        user_role: auditActor?.user_role || user?.role,
                        reason: "Attempted to finalize reconciliation with outstanding difference",
                    });
                } catch (auditError) {
                    console.warn("Failed to create audit log:", auditError);
                }
                return;
            }
        }

        setProcessing(true);
        try {
            await backend.update("Nota", nota.nota_number, {
                reconciliation_status: "FINAL",
            });

            // Create notification using backend client
            try {
                await backend.create("Notification", {
                    title: "Reconciliation Marked FINAL",
                    message: `Nota ${nota.nota_number} reconciliation finalized. ${Math.abs((nota.amount || 0) - (nota.total_actual_paid || 0)) > 1000 ? "Exception creation now enabled." : "Payment matched."}`,
                    type: "INFO",
                    module: "RECONCILIATION",
                    reference_id: nota.nota_number,
                    target_role: "ALL",
                });
            } catch (notifError) {
                console.warn("Failed to create notification:", notifError);
            }

            setSuccessMessage("Reconciliation marked as FINAL");
            loadData();
        } catch (error) {
            console.error("Mark final error:", error);
        }
        setProcessing(false);
    };

    const handleCreateDnCn = async () => {
        if (!selectedNota) return;

        // BLOCK: Exception only after FINAL reconciliation
        if (selectedNota.reconciliation_status !== "FINAL") {
            alert(
                "❌ BLOCKED: Exception can only be created after reconciliation is marked FINAL.\n\nPlease finalize reconciliation first.",
            );

            try {
                await backend.create("AuditLog", {
                    action: "BLOCKED_DNCN_CREATION",
                    module: "RECONCILIATION",
                    entity_type: "Nota",
                    entity_id: selectedNota.nota_number,
                    old_value: "{}",
                    new_value: JSON.stringify({
                        blocked_reason: "reconciliation_status not FINAL",
                    }),
                    user_email: auditActor?.user_email || user?.email,
                    user_role: auditActor?.user_role || user?.role,
                    reason: "Attempted Exception creation before reconciliation finalized",
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            setProcessing(false);
            setShowDnCnDialog(false);
            return;
        }

        // BLOCK: Exception only if actual paid != nota amount
        const diff =
            (selectedNota.amount || 0) - (selectedNota.total_actual_paid || 0);
        if (Math.abs(diff) <= 1000) {
            alert(
                "❌ BLOCKED: Exception not needed.\n\nPayment is MATCHED (difference within tolerance).",
            );
            setShowDnCnDialog(false);
            return;
        }

        setProcessing(true);
        try {
            const noteNumber = `${dnCnFormData.note_type === "Debit Note" ? "DN" : "CN"}-${selectedNota.nota_number}-${Date.now()}`;

            await backend.create("DebitCreditNote", {
                note_number: noteNumber,
                note_type: dnCnFormData.note_type,
                original_nota_id: selectedNota.nota_number,
                batch_id: selectedNota.reference_id,
                contract_id: selectedNota.contract_id,
                adjustment_amount:
                    dnCnFormData.note_type === "Debit Note"
                        ? Math.abs(dnCnFormData.adjustment_amount)
                        : -Math.abs(dnCnFormData.adjustment_amount),
                reason_code: dnCnFormData.reason_code,
                reason_description: dnCnFormData.reason_description,
                status: "UNPAID",
                created_by: user?.email,
                created_date: new Date().toISOString(),
                currency: "IDR",
            });

            // Create audit log using backend client
            try {
                await backend.create("AuditLog", {
                    action: "DNCN_CREATED",
                    module: "RECONCILIATION",
                    entity_type: "DebitCreditNote",
                    entity_id: noteNumber,
                    old_value: "{}",
                    new_value: JSON.stringify({
                        original_nota: selectedNota.nota_number,
                        adjustment: dnCnFormData.adjustment_amount,
                    }),
                    user_email: auditActor?.user_email || user?.email,
                    user_role: auditActor?.user_role || user?.role,
                    reason: dnCnFormData.reason_description,
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            setSuccessMessage(`${dnCnFormData.note_type} created successfully`);
            setShowDnCnDialog(false);
            setSelectedNota(null);
            setDnCnFormData({
                note_type: "Debit Note",
                adjustment_amount: 0,
                reason_code: "Payment Difference",
                reason_description: "",
            });
            loadData();
        } catch (error) {
            console.error("Exception creation error:", error);
        }
        setProcessing(false);
    };

    const handleDnCnAction = async (dnCn, action) => {
        setProcessing(true);
        try {
            const statusMap = {
                review: "Under Review",
                approve: "Approved",
                revision: "Revision",
                acknowledge: "Acknowledged",
            };

            const updates = { status: statusMap[action] };

            if (action === "review") {
                updates.reviewed_by = user?.email;
                updates.reviewed_date = new Date().toISOString();
            } else if (action === "approve") {
                updates.approved_by = user?.email;
                updates.approved_date = new Date().toISOString();

                // When Exception approved, allow Nota close
                const originalNota = notas.find(
                    (n) => n.nota_number === dnCn.original_nota_id,
                );
                if (originalNota) {
                    await backend.update("Nota", originalNota.nota_number, {
                        reconciliation_status: "FINAL",
                    });
                }
            } else if (action === "acknowledge") {
                updates.acknowledged_by = user?.email;
                updates.acknowledged_date = new Date().toISOString();
            } else if (action === "revision") {
                updates.revision_reason = remarks;
            }

            await backend.update("DebitCreditNote", dnCn.note_number, updates);

            // Create notification using backend client
            try {
                await backend.create("Notification", {
                    title: `Exception ${statusMap[action]}`,
                    message: `${dnCn.note_type} ${dnCn.note_number} is now ${statusMap[action]}`,
                    type: "ACTION_REQUIRED",
                    module: "RECONCILIATION",
                    reference_id: dnCn.note_number,
                    target_role: BRINS_ACTION_ROLES[0],
                });
            } catch (notifError) {
                console.warn("Failed to create notification:", notifError);
            }

            // Create audit log using backend client
            try {
                await backend.create("AuditLog", {
                    action: `DNCN_${action.toUpperCase()}`,
                    module: "RECONCILIATION",
                    entity_type: "DebitCreditNote",
                    entity_id: dnCn.note_number,
                    old_value: JSON.stringify({ status: dnCn.status }),
                    new_value: JSON.stringify({ status: statusMap[action] }),
                    user_email: auditActor?.user_email || user?.email,
                    user_role: auditActor?.user_role || user?.role,
                    reason: remarks,
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            setSuccessMessage(`Exception ${action}ed successfully`);
            setShowDnCnActionDialog(false);
            setSelectedDnCn(null);
            setRemarks("");
            loadData();
        } catch (error) {
            console.error("Exception action error:", error);
        }
        setProcessing(false);
    };

    const handleCloseNota = async (nota) => {
        const hasApprovedDnCn = dnCnRecords.some(
            (d) =>
                d.original_nota_id === nota.nota_number &&
                d.status === "Approved",
        );

        if (nota.reconciliation_status !== "MATCHED" && !hasApprovedDnCn) {
            alert(
                `❌ BLOCKED: Cannot close Nota.\n\nNota can only be closed if:\n• Actual Paid = Nota Amount (MATCHED)\nOR\n• Exception Approved\n\nCurrent status: ${nota.reconciliation_status}\nDifference: Rp ${Math.abs((nota.amount || 0) - (nota.total_actual_paid || 0)).toLocaleString()}`,
            );

            try {
                await backend.create("AuditLog", {
                    action: "BLOCKED_NOTA_CLOSE",
                    module: "RECONCILIATION",
                    entity_type: "Nota",
                    entity_id: nota.nota_number,
                    old_value: "{}",
                    new_value: JSON.stringify({
                        blocked_reason:
                            "Payment not matched and no approved Exception",
                    }),
                    user_email: auditActor?.user_email || user?.email,
                    user_role: auditActor?.user_role || user?.role,
                    reason: "Attempted to close Nota without payment match or Exception approval",
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }
            return;
        }

        setProcessing(true);
        try {
            await backend.update("Nota", nota.nota_number, {
                status: "PAID",
                paid_date: new Date().toISOString(),
                payment_reference: "Marked PAID via Exception or MATCHED payment",
            });

            setSuccessMessage("Nota marked as PAID successfully");
            loadData();
        } catch (error) {
            console.error("Close nota error:", error);
        }
        setProcessing(false);
    };

    const activeCategoryNotas = notas.filter(n => {
        if (activeTab === "notas") return n.nota_type === "Batch" || n.nota_type === "INVOICE";
        if (activeTab === "claim") return n.nota_type === "Claim";
        if (activeTab === "subrogation") return n.nota_type === "Subrogation";
        return true;
    });

    const filteredNotas = activeCategoryNotas.filter((n) => {
        if (filters.contract !== "all" && n.contract_id !== filters.contract)
            return false;
        if (filters.status !== "all" && n.status !== filters.status)
            return false;
        return true;
    });

    const renderNotaTabContent = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard
                    title="Total Notas"
                    value={activeCategoryNotas.length}
                    subtitle={`${activeCategoryNotas.length} ${activeTab === "claim" ? "claim" : activeTab === "subrogation" ? "subrogation" : "batch"} notas`}
                    icon={FileText}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title="Pending Confirmation"
                    value={
                        activeCategoryNotas.filter((n) => n.status === "UNPAID").length
                    }
                    subtitle="Awaiting branch"
                    icon={Clock}
                    gradient="from-orange-500 to-orange-600"
                />
                <GradientStatCard
                    title="Total Amount"
                    value={formatRupiahAdaptive(
                        activeCategoryNotas.reduce(
                            (sum, n) => sum + getNotaAmount(n),
                            0,
                        ),
                    )}
                    subtitle={`All ${activeTab === "claim" ? "claim" : activeTab === "subrogation" ? "subrogation" : "batch"} notas`}
                    icon={DollarSign}
                    gradient="from-green-500 to-green-600"
                />
                <GradientStatCard
                    title="Closed Notas"
                    value={
                        activeCategoryNotas.filter((n) => n.status === "Nota Closed").length
                    }
                    subtitle={formatRupiahAdaptive(
                        activeCategoryNotas
                            .filter((n) => n.status === "Nota Closed")
                            .reduce(
                                (sum, n) => sum + getNotaAmount(n),
                                0,
                            ),
                    )}
                    icon={CheckCircle2}
                    gradient="from-purple-500 to-purple-600"
                />
            </div>

            <FilterTab
                filters={filters}
                onFilterChange={setFilters}
                defaultFilters={{
                    contract: "all",
                    status: "all"
                }}
                filterConfig={[
                    {
                        key: "contract",
                        label: "Contract",
                        options: [
                            { value: "all", label: "All Contracts" },
                            ...contracts.map((c) => ({
                                value: c.id,
                                label: c.contract_number,
                            })),
                        ],
                    },
                    {
                        key: "status",
                        label: "Status",
                        options: [
                            { value: "all", label: "All Status" },
                            { value: "UNPAID", label: "UNPAID" },
                            { value: "PAID", label: "PAID" },
                        ],
                    },
                ]}
            />

            <DataTable
                columns={[
                    {
                        header: "Nota Number",
                        cell: (row) => (
                            <div>
                                <p className="font-medium font-mono">
                                    {row.nota_number}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                        {row.nota_type}
                                    </Badge>
                                </div>
                            </div>
                        ),
                    },
                    {
                        header: "Reference",
                        cell: (row) => (
                            <span className="text-sm">
                                {row.reference_id}
                            </span>
                        ),
                    },
                    {
                        header: "Amount",
                        cell: (row) => (
                            <span className="font-bold">
                                {formatRupiahAdaptive(getNotaAmount(row))}
                            </span>
                        ),
                    },
                    {
                        header: "Payment Status",
                        cell: (row) => (
                            <div className="flex items-center gap-2">
                                {row.status === "PAID" ? (
                                    <Badge variant="default" className="bg-green-600">PAID</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-orange-600 border-orange-300">UNPAID</Badge>
                                )}
                            </div>
                        ),
                    },
                    {
                        header: "Payment Action",
                        cell: (row) => {
                            const isBrins = isBrinsRole(tokenRoles);
                            const isUnpaid = row.status === "UNPAID";
                            return isBrins && isUnpaid ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedNotaForStatus(row);
                                        setShowNotaStatusDialog(true);
                                    }}
                                >
                                    Mark Paid
                                </Button>
                            ) : (
                                <span className="text-xs text-gray-500">View Only</span>
                            );
                        },
                    },
                    {
                        header: "Actions",
                        cell: (row) => (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedNota(row);
                                        setShowViewDialog(true);
                                    }}
                                >
                                    <Eye className="w-4 h-4 mr-1" />
                                    View
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadPDF(row);
                                    }}
                                >
                                    <Download className="w-4 h-4 mr-1" />
                                    PDF
                                </Button>
                            </div>
                        ),
                    },
                ]}
                data={filteredNotas}
                isLoading={loading}
                emptyMessage={`No ${activeTab === 'claim' ? 'claim' : activeTab === 'subrogation' ? 'subrogation' : 'batch'} notas found`}
                onRowClick={() => {}}
                pagination={{
                    from: totalNotas === 0 ? 0 : (notaPage - 1) * notaPageSize + 1,
                    to: Math.min(totalNotas, notaPage * notaPageSize),
                    total: totalNotas,
                    page: notaPage,
                    totalPages: Math.max(1, Math.ceil(totalNotas / notaPageSize)),
                }}
                onPageChange={(p) => setNotaPage(p)}
            />
        </>
    );

    // DEBUG: Log all notas to see their actual status values
    useEffect(() => {
        if (notas.length > 0) {
            console.log("DEBUG - All notas from DB:", notas.map(n => ({
                nota_number: n.nota_number,
                status: n.status,
                statusType: typeof n.status
            })));
            console.log("DEBUG - filters.status:", filters.status);
            console.log("DEBUG - filteredNotas count:", filteredNotas.length);
            if (filteredNotas.length > 0) {
                console.log("DEBUG - First filtered nota:", {
                    nota_number: filteredNotas[0].nota_number,
                    status: filteredNotas[0].status,
                    statusType: typeof filteredNotas[0].status
                });
            }
        }
    }, [notas, filteredNotas, filters]);

    // Reconciliation items with payment details (ALL NOTA TYPES)
    const reconciliationItems = notas.map((nota) => {
        const relatedPayments = payments.filter(
            (p) =>
                (p.invoice_id === nota.id ||
                    p.invoice_id === nota.nota_number) &&
                p.is_actual_payment,
        );
        const paymentReceivedFromPayments = relatedPayments.reduce(
            (sum, p) => sum + (p.amount || 0),
            0,
        );

        // Prefer existing nota.total_actual_paid if backend provided it, otherwise use computed payments
        const totalActualPaid =
            nota.total_actual_paid !== undefined &&
            nota.total_actual_paid !== null
                ? nota.total_actual_paid
                : paymentReceivedFromPayments;

        const difference = (nota.amount || 0) - (totalActualPaid || 0);

        const relatedIntents = paymentIntents.filter(
            (pi) =>
                pi.invoice_id === nota.id || pi.invoice_id === nota.nota_number,
        );
        const totalPlanned = relatedIntents.reduce(
            (sum, pi) => sum + (pi.planned_amount || 0),
            0,
        );

        return {
            ...nota,
            total_actual_paid: totalActualPaid,
            payment_received: paymentReceivedFromPayments,
            total_planned: totalPlanned,
            difference: difference,
            reconciliation_status: nota.reconciliation_status,
            has_exception:
                Math.abs(difference) > 1000 && nota.status !== "PAID",
            payment_count: relatedPayments.length,
            intent_count: relatedIntents.length,
        };
    });

    const filteredRecon = reconciliationItems.filter((r) => {
        if (
            reconFilters.contract !== "all" &&
            r.contract_id !== reconFilters.contract
        )
            return false;
        if (reconFilters.status !== "all" && r.status !== reconFilters.status)
            return false;
        if (reconFilters.hasException === "yes" && !r.has_exception)
            return false;
        if (reconFilters.hasException === "no" && r.has_exception) return false;
        return true;
    });

    // Exception items: derive from reconciliation - show notas with positive difference
    // and that are not already matched. If difference becomes 0 and recon_status is MATCHED
    // they will no longer appear here.
    const exceptionItems = reconciliationItems.filter((r) => {
        const diff = r.difference || 0;
        const recon = (r.reconciliation_status || "").toString().toUpperCase();
        return diff > 0 && recon !== "MATCHED";
    });

    const filteredExceptions = exceptionItems.filter((r) => {
        if (
            dnCnFilters.contract !== "all" &&
            r.contract_id !== dnCnFilters.contract
        )
            return false;
        // Allow filtering by recon status via the existing 'status' filter
        if (
            dnCnFilters.status !== "all" &&
            r.reconciliation_status !== dnCnFilters.status
        )
            return false;
        return true;
    });

    const handleDownloadPDF = (nota) => {
        try {
            const pdf = new jsPDF("l", "mm", "a4");

            // Helper to format currency correctly
            const formatCurrency = (val) => {
                const num = parseFloat(val) || 0;
                const formatted = Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                if (num < 0) return `(${formatted})`;
                return formatted;
            };

            // Setup Header text
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(0, 0, 0);

            // Set positions
            const startY = 30;
            const marginX = 15;
            const rowHeight = 8;
            
            // X coordinates for the columns (right-aligned for numbers)
            const colKindX = marginX; // Left aligned
            const colPremiumX = 100;
            const colCommissionX = 135;
            const colClaimX = 170;
            const colTotalX = 220;
            const colNetDueX = 270;

            // Draw Top Line
            pdf.setLineWidth(0.5);
            pdf.line(colKindX, startY, 280, startY);

            // Draw Header Row
            pdf.setFont("helvetica", "bold");
            pdf.text("Kind Of Treaty", colKindX, startY + rowHeight);
            
            pdf.text("Premium", colPremiumX, startY + rowHeight, { align: "right" });
            pdf.text("Commission", colCommissionX, startY + rowHeight, { align: "right" });
            pdf.text("Claim", colClaimX, startY + rowHeight, { align: "right" });
            pdf.text("Total", colTotalX, startY + rowHeight, { align: "right" });
            pdf.text("Net Due", colNetDueX, startY + rowHeight, { align: "right" });

            // Draw Bottom Line for Header
            pdf.line(colKindX, startY + rowHeight + 2, 280, startY + rowHeight + 2);

            // Currency Row
            pdf.setFont("helvetica", "normal");
            pdf.text("Currency : IDR", colKindX, startY + (rowHeight * 2) + 2);

            // Data Row
            const dataY = startY + (rowHeight * 3) + 2;
            
            // Mock Kind of Treaty text - using reference_id for now as it represents the batch
            const kindOfTreaty = nota.reference_id || nota.contract_id || "AUTO FACULTATIVE CREDIT COMMERCIAL - 2024";
            pdf.text(kindOfTreaty, colKindX, dataY);
            
            // Print Values
            pdf.text(formatCurrency(nota.premium), colPremiumX, dataY, { align: "right" });
            pdf.text(formatCurrency(nota.commission), colCommissionX, dataY, { align: "right" });
            pdf.text(formatCurrency(nota.claim), colClaimX, dataY, { align: "right" });
            pdf.text(formatCurrency(nota.total), colTotalX, dataY, { align: "right" });
            pdf.text(formatCurrency(nota.net_due), colNetDueX, dataY, { align: "right" });

            pdf.save(`${nota.nota_number}.pdf`);
            setSuccessMessage("PDF downloaded successfully");
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            setSuccessMessage("Failed to generate PDF");
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Nota Management"
                subtitle="Manage notas, reconciliation, and Exception adjustments"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Nota Management" },
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

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-4xl grid-cols-3">
                    <TabsTrigger value="notas">Premi</TabsTrigger>
                    <TabsTrigger value="claim">Claim</TabsTrigger>
                    <TabsTrigger value="subrogation">Subrogation</TabsTrigger>
                    {/* <TabsTrigger value="exception">Exception</TabsTrigger> */}
                </TabsList>

                {/* NOTAS (PREMI) TAB */}
                <TabsContent value="notas" className="space-y-6">
                    {renderNotaTabContent()}
                </TabsContent>

                {/* CLAIM TAB */}
                <TabsContent value="claim" className="space-y-6">
                    {renderNotaTabContent()}
                </TabsContent>

                {/* SUBROGATION TAB */}
                <TabsContent value="subrogation" className="space-y-6">
                    {renderNotaTabContent()}
                </TabsContent>

                {/* Exception TAB */}
                <TabsContent value="exception" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <GradientStatCard
                            title="Total Exceptions"
                            value={exceptionItems.length}
                            subtitle={`${filteredExceptions.length} visible`}
                            icon={FileText}
                            gradient="from-blue-500 to-blue-600"
                        />
                        <GradientStatCard
                            title="Final Pending"
                            value={
                                exceptionItems.filter(
                                    (r) => r.recon_status === "FINAL",
                                ).length
                            }
                            subtitle="Ready for Exception"
                            icon={Clock}
                            gradient="from-orange-500 to-orange-600"
                        />
                        <GradientStatCard
                            title="Total Difference"
                            value={formatRupiahAdaptive(
                                exceptionItems.reduce(
                                    (sum, r) => sum + toNumber(r.difference),
                                    0,
                                ),
                            )}
                            subtitle="sum of differences"
                            icon={AlertTriangle}
                            gradient="from-red-500 to-red-600"
                        />
                        <GradientStatCard
                            title="Affected Notas"
                            value={
                                new Set(
                                    exceptionItems.map((r) => r.nota_number),
                                ).size
                            }
                            subtitle="unique notas"
                            icon={DollarSign}
                            gradient="from-purple-500 to-purple-600"
                        />
                    </div>

                    <FilterTab
                        filters={dnCnFilters}
                        onFilterChange={setDnCnFilters}
                        defaultFilters={defaultFilterDnCn}
                        filterConfig={[
                            {
                                key: "contract",
                                label: "Contract",
                                options: [
                                    { value: "all", label: "All Contracts" },
                                    ...contracts.map((c) => ({
                                        value: c.id,
                                        label: c.contract_number,
                                    })),
                                ],
                            },
                            {
                                key: "status",
                                label: "Recon Status",
                                options: [
                                    { value: "all", label: "All Status" },
                                    { value: "UNPAID", label: "UNPAID" },
                                    { value: "PAID", label: "PAID" },
                                ],
                            },
                        ]}
                    />
                    <DataTable
                        columns={[
                            {
                                header: "Nota",
                                cell: (row) => (
                                    <div>
                                        <div className="font-medium font-mono">
                                            {row.nota_number}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {row.nota_type}
                                            </Badge>
                                            <span className="text-xs text-gray-500">
                                                {row.reference_id}
                                            </span>
                                        </div>
                                    </div>
                                ),
                            },
                            { header: "Batch ID", accessorKey: "batch_id" },
                            {
                                header: "Nota Amount",
                                cell: (row) => (
                                    <div>
                                        {formatRupiahAdaptive(
                                            getNotaAmount(row),
                                        )}
                                    </div>
                                ),
                            },
                            {
                                header: "Paid",
                                cell: (row) => (
                                    <div className="text-green-600 font-bold">
                                        {formatRupiahAdaptive(
                                            row.payment_received ||
                                                row.total_actual_paid ||
                                                0,
                                        )}
                                    </div>
                                ),
                            },
                            {
                                header: "Difference",
                                cell: (row) => (
                                    <div className="text-red-600 font-bold">
                                        {formatRupiahAdaptive(
                                            row.difference ||
                                                (row.amount || 0) -
                                                    (row.payment_received ||
                                                        row.total_actual_paid ||
                                                        0),
                                        )}
                                    </div>
                                ),
                            },
                            {
                                header: "Recon Status",
                                cell: (row) => (
                                    <StatusBadge
                                        status={
                                            row.reconciliation_status ||
                                            row.recon_status
                                        }
                                    />
                                ),
                            },
                            {
                                header: "Actions",
                                cell: (row) => (
                                    <div className="flex gap-1 flex-wrap">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedNota(row);
                                                setShowViewDialog(true);
                                            }}
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>

                                        {canManageNotaActions &&
                                            (row.reconciliation_status ===
                                                "FINAL" ||
                                                row.recon_status ===
                                                    "FINAL") && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-orange-600 border-orange-300"
                                                    onClick={() => {
                                                        setSelectedNota(row);
                                                        const diff =
                                                            row.difference ||
                                                            (row.amount || 0) -
                                                                (row.payment_received ||
                                                                    row.total_actual_paid ||
                                                                    0);
                                                        setDnCnFormData({
                                                            note_type:
                                                                diff > 0
                                                                    ? "Debit Note"
                                                                    : "Credit Note",
                                                            adjustment_amount:
                                                                Math.abs(diff),
                                                            reason_code:
                                                                "Payment Difference",
                                                            reason_description: `${diff > 0 ? "Underpayment" : "Overpayment"} of Rp ${Math.abs(diff).toLocaleString()}`,
                                                        });
                                                        setShowDnCnDialog(true);
                                                    }}
                                                >
                                                    <Plus className="w-4 h-4 mr-1" />
                                                    Exception
                                                </Button>
                                            )}

                                        {canManageNotaActions &&
                                            (row.reconciliation_status ===
                                            "MATCHED" ||
                                            row.recon_status === "MATCHED" ||
                                            dnCnRecords.some(
                                                (d) =>
                                                    d.original_nota_id ===
                                                        row.nota_number &&
                                                    d.status === "Approved",
                                            )) &&
                                            row.status !== "PAID" && (
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600"
                                                    onClick={() =>
                                                        handleCloseNota(row)
                                                    }
                                                >
                                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                                    Close Nota
                                                </Button>
                                            )}
                                    </div>
                                ),
                            },
                        ]}
                        data={filteredExceptions}
                        isLoading={loading}
                        emptyMessage="No exceptions"
                    />
                </TabsContent>
            </Tabs>

            {/* Note: Generate Nota Dialog removed - notas are now auto-created per batch */}

            {/* Record Payment Dialog */}
            <Dialog
                open={showPaymentDialog}
                onOpenChange={setShowPaymentDialog}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Record Actual Payment</DialogTitle>
                        <DialogDescription>
                            Nota: {selectedRecon?.nota_number}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-600">
                                        Nota Amount:
                                    </span>
                                    <div className="font-bold text-blue-600 text-lg">
                                        Rp{" "}
                                        {parseNumberSafe(
                                            selectedRecon?.amount,
                                        ).toLocaleString("id-ID")}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-gray-600">
                                        Total Planned:
                                    </span>
                                    <div className="font-medium text-gray-600 text-lg">
                                        Rp{" "}
                                        {parseNumberSafe(
                                            selectedRecon?.total_planned || 0,
                                        ).toLocaleString("id-ID")}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {selectedRecon?.intent_count} intent(s)
                                    </div>
                                </div>
                                <div>
                                    <span className="text-gray-600">
                                        Already Paid:
                                    </span>
                                    <div className="font-bold text-green-600 text-lg">
                                        Rp{" "}
                                        {parseNumberSafe(
                                            selectedRecon?.total_actual_paid ||
                                                0,
                                        ).toLocaleString("id-ID")}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {selectedRecon?.payment_count}{" "}
                                        payment(s)
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Alert className="bg-blue-50 border-blue-200">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                                <strong>Payment Status Rules:</strong>
                                <br />• PARTIAL: Actual Paid &lt; Nota Amount
                                (normal, can add more payments)
                                <br />• MATCHED: Actual Paid = Nota Amount
                                (auto-close Nota)
                                <br />• OVERPAID: Actual Paid &gt; Nota Amount
                                (Exception required)
                                <br />
                                <br />
                                <strong>Note:</strong> Planned vs Actual
                                mismatch is NORMAL. Multiple payments
                                accumulate.
                            </AlertDescription>
                        </Alert>

                        <div>
                            <Label>Actual Paid Amount (Rp) *</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    value={paymentFormData.actual_paid_amount}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        // Izinkan angka, minus, titik
                                        if (
                                            value === "" ||
                                            /^-?\d*\.?\d*$/.test(value)
                                        ) {
                                            setPaymentFormData({
                                                ...paymentFormData,
                                                actual_paid_amount: value,
                                            });
                                        }
                                    }}
                                    placeholder="Enter amount (positive or negative)"
                                    className="flex-1"
                                />
                                <div className="flex flex-col gap-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-5 w-8 p-0"
                                        onClick={() => {
                                            const current = parseNumberSafe(
                                                paymentFormData.actual_paid_amount,
                                            );
                                            setPaymentFormData({
                                                ...paymentFormData,
                                                actual_paid_amount: (
                                                    current + 1
                                                ).toString(),
                                            });
                                        }}
                                    >
                                        ▲
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-5 w-8 p-0"
                                        onClick={() => {
                                            const current = parseNumberSafe(
                                                paymentFormData.actual_paid_amount,
                                            );
                                            setPaymentFormData({
                                                ...paymentFormData,
                                                actual_paid_amount: (
                                                    current - 1
                                                ).toString(),
                                            });
                                        }}
                                    >
                                        ▼
                                    </Button>
                                </div>
                            </div>

                            {paymentFormData.actual_paid_amount && (
                                <PaymentCalculationDisplay
                                    paymentAmount={
                                        paymentFormData.actual_paid_amount
                                    }
                                    previousPaid={
                                        selectedRecon?.total_actual_paid
                                    }
                                    notaAmount={selectedRecon?.amount}
                                />
                            )}
                        </div>

                        <div>
                            <Label>Payment Date *</Label>
                            <Input
                                type="date"
                                value={paymentFormData.payment_date}
                                onChange={(e) =>
                                    setPaymentFormData({
                                        ...paymentFormData,
                                        payment_date: e.target.value,
                                    })
                                }
                            />
                        </div>

                        <div>
                            <Label>Bank Reference / Transaction ID *</Label>
                            <Input
                                value={paymentFormData.bank_reference}
                                onChange={(e) =>
                                    setPaymentFormData({
                                        ...paymentFormData,
                                        bank_reference: e.target.value,
                                    })
                                }
                                placeholder="e.g., TRX-20250124-001"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowPaymentDialog(false);
                                setPaymentFormData({
                                    actual_paid_amount: "",
                                    payment_date: new Date()
                                        .toISOString()
                                        .split("T")[0],
                                    bank_reference: "",
                                });
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRecordPayment}
                            disabled={
                                processing ||
                                !paymentFormData.actual_paid_amount ||
                                !paymentFormData.bank_reference
                            }
                            className="bg-blue-600"
                        >
                            {processing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                            )}
                            Record Payment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Exception Creation Dialog */}
            <Dialog open={showDnCnDialog} onOpenChange={setShowDnCnDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Debit / Credit Note</DialogTitle>
                        <DialogDescription>
                            For Nota: {selectedNota?.nota_number}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Prerequisites:</strong>
                                <br />✓ Reconciliation must be marked FINAL
                                <br />✓ Payment difference must exist
                                <br />
                                <br />
                                <strong>
                                    Original Nota remains UNCHANGED.
                                </strong>
                            </AlertDescription>
                        </Alert>

                        {selectedNota && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">
                                            Nota Amount:
                                        </span>
                                        <span className="ml-2 font-bold">
                                            Rp{" "}
                                            {(
                                                selectedNota.amount || 0
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Actual Paid:
                                        </span>
                                        <span className="ml-2 font-bold text-green-600">
                                            Rp{" "}
                                            {(
                                                selectedNota.total_actual_paid ||
                                                0
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-500">
                                            Difference:
                                        </span>
                                        <span className="ml-2 font-bold text-red-600">
                                            Rp{" "}
                                            {Math.abs(
                                                (selectedNota.amount || 0) -
                                                    (selectedNota.total_actual_paid ||
                                                        0),
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <Label>Note Type *</Label>
                            <Select
                                value={dnCnFormData.note_type}
                                onValueChange={(val) =>
                                    setDnCnFormData({
                                        ...dnCnFormData,
                                        note_type: val,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Debit Note">
                                        Debit Note (Underpayment - increase
                                        amount)
                                    </SelectItem>
                                    <SelectItem value="Credit Note">
                                        Credit Note (Overpayment - decrease
                                        amount)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Adjustment Amount (IDR) *</Label>
                            <Input
                                type="number"
                                value={dnCnFormData.adjustment_amount}
                                onChange={(e) =>
                                    setDnCnFormData({
                                        ...dnCnFormData,
                                        adjustment_amount:
                                            parseFloat(e.target.value) || 0,
                                    })
                                }
                            />
                        </div>

                        <div>
                            <Label>Reason Code *</Label>
                            <Select
                                value={dnCnFormData.reason_code}
                                onValueChange={(val) =>
                                    setDnCnFormData({
                                        ...dnCnFormData,
                                        reason_code: val,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Payment Difference">
                                        Payment Difference
                                    </SelectItem>
                                    <SelectItem value="FX Adjustment">
                                        FX Adjustment
                                    </SelectItem>
                                    <SelectItem value="Premium Correction">
                                        Premium Correction
                                    </SelectItem>
                                    <SelectItem value="Coverage Adjustment">
                                        Coverage Adjustment
                                    </SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Description *</Label>
                            <Textarea
                                value={dnCnFormData.reason_description}
                                onChange={(e) =>
                                    setDnCnFormData({
                                        ...dnCnFormData,
                                        reason_description: e.target.value,
                                    })
                                }
                                placeholder="Explain the reason for this adjustment..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDnCnDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateDnCn}
                            disabled={
                                processing || !dnCnFormData.reason_description
                            }
                        >
                            {processing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Create Exception
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Exception Action Dialog */}
            <Dialog
                open={showDnCnActionDialog}
                onOpenChange={setShowDnCnActionDialog}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{actionType} Exception</DialogTitle>
                        <DialogDescription>
                            {selectedDnCn?.note_number}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {selectedDnCn && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">
                                            Type:
                                        </span>
                                        <span className="ml-2 font-medium">
                                            {selectedDnCn.note_type}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Adjustment:
                                        </span>
                                        <span className="ml-2 font-bold">
                                            Rp{" "}
                                            {Math.abs(
                                                selectedDnCn.adjustment_amount ||
                                                    0,
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-500">
                                            Original Nota:
                                        </span>
                                        <span className="ml-2 font-medium">
                                            {selectedDnCn.original_nota_id}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-500">
                                            Reason:
                                        </span>
                                        <span className="ml-2 font-medium">
                                            {selectedDnCn.reason_description}
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
                                placeholder="Enter remarks..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDnCnActionDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() =>
                                handleDnCnAction(selectedDnCn, actionType)
                            }
                            disabled={processing}
                        >
                            {processing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : null}
                            Confirm {actionType}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Nota Action Dialog */}
            <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{actionType}</DialogTitle>
                        <DialogDescription>
                            Move nota {selectedNota?.nota_number} from{" "}
                            {selectedNota?.status} to{" "}
                            {getNextStatus(selectedNota?.status)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {getNextStatus(selectedNota?.status) === "Issued" && (
                            <Alert variant="destructive">
                                <Lock className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Warning:</strong> After issuing,
                                    Nota amount becomes IMMUTABLE and cannot be
                                    edited.
                                    <br />
                                    Any adjustments must be done via Exception.
                                </AlertDescription>
                            </Alert>
                        )}
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Type:</span>
                                    <Badge>{selectedNota?.nota_type}</Badge>
                                </div>
                                <div>
                                    <span className="text-gray-500">
                                        Amount:
                                    </span>
                                    <span className="ml-2 font-medium">
                                        Rp{" "}
                                        {(
                                            selectedNota?.amount || 0
                                        ).toLocaleString("id-ID")}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-gray-500">
                                        Reference:
                                    </span>
                                    <span className="ml-2 font-medium">
                                        {selectedNota?.reference_id}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label>Remarks</Label>
                            <Textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter remarks..."
                                rows={3}
                            />
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
                            onClick={handleNotaAction}
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
                                    {actionType}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {selectedNota
                                ? "Nota Detail"
                                : "Debit/Credit Note Detail"}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedNota?.nota_number ||
                                selectedDnCn?.note_number}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {selectedNota && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">
                                            Type:
                                        </span>
                                        <Badge className="ml-2">
                                            {selectedNota.nota_type}
                                        </Badge>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Amount:
                                        </span>
                                        <span className="ml-2 font-medium">
                                            {formatRupiahAdaptive(
                                                selectedNota.amount,
                                            )}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Status:
                                        </span>
                                        <span className="ml-2">
                                            <StatusBadge
                                                status={selectedNota.status}
                                            />
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-500">
                                            Reference:
                                        </span>
                                        <span className="ml-2 font-medium">
                                            {selectedNota.reference_id}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {selectedDnCn && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">
                                            Type:
                                        </span>
                                        <Badge
                                            className={
                                                selectedDnCn?.note_type ===
                                                "Debit Note"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-blue-100 text-blue-700"
                                            }
                                        >
                                            {selectedDnCn?.note_type}
                                        </Badge>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Adjustment:
                                        </span>
                                        <span className="ml-2 font-bold">
                                            Rp{" "}
                                            {Math.abs(
                                                selectedDnCn.adjustment_amount ||
                                                    0,
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-500">
                                            Original Nota:
                                        </span>
                                        <span className="ml-2 font-medium">
                                            {selectedDnCn.original_nota_id}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-500">
                                            Reason:
                                        </span>
                                        <span className="ml-2 font-medium">
                                            {selectedDnCn.reason_description}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowViewDialog(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Nota Status Change Dialog */}
            <Dialog open={showNotaStatusDialog} onOpenChange={setShowNotaStatusDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Payment</DialogTitle>
                        <DialogDescription>
                            Mark Nota {selectedNotaForStatus?.nota_number} as Paid
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs text-gray-600">Nota Number</Label>
                                <p className="font-mono text-sm">{selectedNotaForStatus?.nota_number}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-gray-600">Current Status</Label>
                                <p className="font-semibold text-orange-600">{selectedNotaForStatus?.status}</p>
                            </div>
                            <div className="col-span-2">
                                <Label className="text-xs text-gray-600">Amount</Label>
                                <p className="text-lg font-bold">
                                    {formatRupiahAdaptive(selectedNotaForStatus?.amount)}
                                </p>
                            </div>
                        </div>

                        <Alert className="border-blue-200 bg-blue-50">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                                Status will be changed from UNPAID to PAID
                            </AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowNotaStatusDialog(false);
                                setSelectedNotaForStatus(null);
                            }}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleChangeNotaStatus}
                            disabled={processing}
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Confirm Payment
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
