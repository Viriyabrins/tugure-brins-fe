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

export default function NotaManagement() {
    const [user, setUser] = useState(null);
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

    const isTugure = user?.role === "TUGURE" || user?.role === "admin";
    const isBrins = user?.role === "BRINS" || user?.role === "admin";

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

    const loadUser = async () => {
        try {
            const demoUserStr = localStorage.getItem("demo_user");
            if (demoUserStr) {
                const demoUser = JSON.parse(demoUserStr);
                setUser(demoUser);
            }
        } catch (error) {
            console.error("Failed to load user:", error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            // Load all data using backend client
            const [
                notaData,
                batchData,
                contractData,
                paymentData,
                paymentIntentData,
                dnCnData,
                debtorData,
            ] = await Promise.all([
                backend.list("Nota"),
                backend.list("Batch"),
                backend.list("Contract"),
                backend.list("Payment"),
                backend.list("PaymentIntent"),
                backend.list("DebitCreditNote"),
                backend.list("Debtor"),
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

            // Auto-create nota entries for batches that don't have them
            const notaCreationPromises = [];
            for (const entry of batchReviewSync) {
                const batchId = entry.batchId;
                const existingNota = nextNotas.find(
                    (n) => n.reference_id === batchId,
                );

                // Auto-create Nota only when ALL debtors in batch are APPROVED
                if (!existingNota && batchId && entry.allApproved) {
                    // Create nota for this batch
                    const notaNumber = `NOTA-${batchId}-${Date.now()}`;
                    notaCreationPromises.push(
                        backend
                            .create("Nota", {
                                nota_number: notaNumber,
                                nota_type: "Batch",
                                reference_id: batchId,
                                amount: entry.batch.final_premium_amount || 0,
                                // New notas should be issued immediately (Issued)
                                status: "Issued",
                                contract_id: entry.batch.contract_id,
                            })
                            .catch((err) => {
                                console.warn(
                                    `Failed to auto-create nota for batch ${batchId}:`,
                                    err,
                                );
                            }),
                    );
                }
            }

            if (notaCreationPromises.length > 0) {
                await Promise.allSettled(notaCreationPromises);
                // Reload notas after creation
                const updatedNotas = await backend.list("Nota");
                nextNotas.splice(
                    0,
                    nextNotas.length,
                    ...(Array.isArray(updatedNotas) ? updatedNotas : []),
                );
            }

            const updatePromises = batchReviewSync
                .filter((entry) => entry.needsUpdate && entry.batchId)
                .map((entry) =>
                    backend
                        .update("Batch", entry.batchId, entry.updatePayload)
                        .catch((syncError) => {
                            console.warn(
                                "Failed to sync batch review status:",
                                syncError,
                            );
                        }),
                );

            if (updatePromises.length > 0) {
                await Promise.allSettled(updatePromises);
            }

            // Update nota status to Issued where applicable
            const notaUpdatePromises = [];
            nextNotas.forEach((nota) => {
                const batchInfo = batchNotaMap[nota.reference_id];
                if (
                    batchInfo &&
                    batchInfo.isFinal &&
                    nota.status !== "Issued" &&
                    nota.status !== "Nota Closed"
                ) {
                    notaUpdatePromises.push(
                        backend
                            .update("Nota", nota.id, { status: "Issued" })
                            .then((updated) => {
                                // Update in local array
                                const idx = nextNotas.findIndex(
                                    (n) => n.id === nota.id,
                                );
                                if (idx >= 0) nextNotas[idx] = updated;
                            })
                            .catch((err) =>
                                console.warn(
                                    `Failed to update nota ${nota.id} to Issued:`,
                                    err,
                                ),
                            ),
                    );
                }
            });

            if (notaUpdatePromises.length > 0) {
                await Promise.allSettled(notaUpdatePromises);
            }

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
            setBatches([]);
            setContracts([]);
            setPayments([]);
            setPaymentIntents([]);
            setDnCnRecords([]);
            setDebtors([]);
        }
        setLoading(false);
    };

    const getNextStatus = (currentStatus) => {
        const workflow = ["Draft", "Issued", "Confirmed", "Nota Closed"];
        const currentIndex = workflow.indexOf(currentStatus);
        return currentIndex >= 0 && currentIndex < workflow.length - 1
            ? workflow[currentIndex + 1]
            : null;
    };

    const getActionLabel = (status) => {
        const labels = {
            // Draft no longer used as default for new notas; button should show "Issued"
            Draft: "Issued",
            // Issued -> Close Nota (previously Paid)
            Issued: "Close Nota",
            // Confirmed -> Mark Closed
            Confirmed: "Mark Closed",
        };
        return labels[status] || "Issued";
    };

    // Note: handleGenerateNota removed - notas are now auto-created per batch

    const handleNotaAction = async () => {
        if (!selectedNota || !actionType) return;

        // BLOCK: Cannot edit Nota after it reached Issued state (immutable)
        if (selectedNota.is_immutable && selectedNota.status === "Issued") {
            alert(
                "❌ BLOCKED: Nota is IMMUTABLE after becoming Issued.\n\nNota amount cannot be changed. Use Exception for adjustments.",
            );

            try {
                await backend.create("AuditLog", {
                    action: "BLOCKED_NOTA_EDIT",
                    module: "DEBTOR",
                    entity_type: "Nota",
                    entity_id: selectedNota.nota_number,
                    old_value: "{}",
                    new_value: JSON.stringify({
                        blocked_reason: "is_immutable = TRUE",
                    }),
                    user_email: user?.email,
                    user_role: user?.role,
                    reason: "Attempted to edit immutable Nota",
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            setShowActionDialog(false);
            return;
        }

        setProcessing(true);
        try {
            const nextStatus = getNextStatus(selectedNota.status);
            if (!nextStatus) {
                setProcessing(false);
                return;
            }

            const updateData = { status: nextStatus };

            if (nextStatus === "Issued") {
                updateData.issued_by = user?.email;
                updateData.issued_date = new Date().toISOString();
                updateData.is_immutable = true; // LOCK Nota amount
            } else if (nextStatus === "Confirmed") {
                updateData.confirmed_by = user?.email;
                updateData.confirmed_date = new Date().toISOString();
            }

            await backend.update(
                "Nota",
                selectedNota.nota_number || selectedNota.id,
                updateData,
            );

            const targetRole =
                nextStatus === "Issued"
                    ? "BRINS"
                    : nextStatus === "Confirmed"
                      ? "TUGURE"
                      : "ALL";

            // Create notification using backend client
            try {
                await backend.create("Notification", {
                    title: `Nota ${nextStatus}`,
                    message: `Nota ${selectedNota.nota_number} (${selectedNota.nota_type}) moved to ${nextStatus}${nextStatus === "Issued" ? " - Amount now IMMUTABLE" : ""}`,
                    type: nextStatus === "Issued" ? "ACTION_REQUIRED" : "INFO",
                    module: "DEBTOR",
                    reference_id: selectedNota.nota_number,
                    target_role: targetRole,
                });
            } catch (notifError) {
                console.warn("Failed to create notification:", notifError);
            }

            // Create audit log using backend client
            try {
                await backend.create("AuditLog", {
                    action: `NOTA_${nextStatus.toUpperCase()}`,
                    module: "DEBTOR",
                    entity_type: "Nota",
                    entity_id: selectedNota.nota_number,
                    old_value: JSON.stringify({ status: selectedNota.status }),
                    new_value: JSON.stringify({
                        status: nextStatus,
                        is_immutable: nextStatus === "Issued",
                    }),
                    user_email: user?.email,
                    user_role: user?.role,
                    reason: remarks,
                });
            } catch (auditError) {
                console.warn("Failed to create audit log:", auditError);
            }

            setSuccessMessage(
                `Nota moved to ${nextStatus} successfully${nextStatus === "Issued" ? " - Nota is now IMMUTABLE" : ""}`,
            );
            setShowActionDialog(false);
            setSelectedNota(null);
            setRemarks("");
            loadData();
        } catch (error) {
            console.error("Action error:", error);
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

            // If MATCHED, auto mark Nota as closed
            if (reconStatus === "MATCHED") {
                await backend.update("Nota", selectedRecon.nota_number, {
                    status: "Nota Closed",
                    paid_date: paymentDateISO,
                    payment_reference: paymentRef,
                });

                // Create notification using backend client
                try {
                    await backend.create("Notification", {
                        title: "Payment MATCHED - Nota Closed",
                        message: `Nota ${selectedRecon.nota_number} fully paid. Amount: Rp ${newTotalPaid.toLocaleString("id-ID")}. Nota closed.`,
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
                        target_role: "TUGURE",
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
                    user_email: user?.email,
                    user_role: user?.role,
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
                        user_email: user?.email,
                        user_role: user?.role,
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
                    user_email: user?.email,
                    user_role: user?.role,
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
                status: "Draft",
                drafted_by: user?.email,
                drafted_date: new Date().toISOString(),
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
                    user_email: user?.email,
                    user_role: user?.role,
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
            const targetRole = action === "approve" ? "BRINS" : "TUGURE";
            try {
                await backend.create("Notification", {
                    title: `Exception ${statusMap[action]}`,
                    message: `${dnCn.note_type} ${dnCn.note_number} is now ${statusMap[action]}`,
                    type: "ACTION_REQUIRED",
                    module: "RECONCILIATION",
                    reference_id: dnCn.note_number,
                    target_role: targetRole,
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
                    user_email: user?.email,
                    user_role: user?.role,
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
                    user_email: user?.email,
                    user_role: user?.role,
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
                status: "Nota Closed",
                paid_date: new Date().toISOString(),
                payment_reference: "Closed via Exception or MATCHED payment",
            });

            setSuccessMessage("Nota closed successfully");
            loadData();
        } catch (error) {
            console.error("Close nota error:", error);
        }
        setProcessing(false);
    };

    const filteredNotas = notas.filter((n) => {
        if (filters.contract !== "all" && n.contract_id !== filters.contract)
            return false;
        if (filters.notaType !== "all" && n.nota_type !== filters.notaType)
            return false;
        if (filters.status !== "all" && n.status !== filters.status)
            return false;
        return true;
    });

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
                Math.abs(difference) > 1000 && nota.status !== "Nota Closed",
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
                <TabsList className="grid w-full max-w-3xl grid-cols-3">
                    <TabsTrigger value="notas">Notas</TabsTrigger>
                    <TabsTrigger value="reconciliation">
                        Reconciliation
                    </TabsTrigger>
                    <TabsTrigger value="dncn">Exception</TabsTrigger>
                </TabsList>

                {/* NOTAS TAB */}
                <TabsContent value="notas" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <GradientStatCard
                            title="Total Notas"
                            value={notas.length}
                            subtitle={`${notas.filter((n) => n.nota_type === "Batch").length} batch / ${notas.filter((n) => n.nota_type === "Claim").length} claim`}
                            icon={FileText}
                            gradient="from-blue-500 to-blue-600"
                        />
                        <GradientStatCard
                            title="Pending Confirmation"
                            value={
                                notas.filter((n) => n.status === "Issued").length
                            }
                            subtitle="Awaiting branch"
                            icon={Clock}
                            gradient="from-orange-500 to-orange-600"
                        />
                        <GradientStatCard
                            title="Total Amount"
                            value={formatRupiahAdaptive(
                                notas.reduce(
                                    (sum, n) => sum + getNotaAmount(n),
                                    0,
                                ),
                            )}
                            subtitle="All notas"
                            icon={DollarSign}
                            gradient="from-green-500 to-green-600"
                        />
                        <GradientStatCard
                            title="Closed Notas"
                            value={
                                notas.filter((n) => n.status === "Nota Closed")
                                    .length
                            }
                            subtitle={formatRupiahAdaptive(
                                notas
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
                        defaultFilters={defaultFilter}
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
                                key: "notaType",
                                label: "Nota Type",
                                options: [
                                    { value: "all", label: "All Types" },
                                    { value: "Batch", label: "Batch" },
                                    { value: "Claim", label: "Claim" },
                                    {
                                        value: "Subrogation",
                                        label: "Subrogation",
                                    },
                                ],
                            },
                            {
                                key: "status",
                                label: "Status",
                                options: [
                                    { value: "all", label: "All Status" },
                                    { value: "Draft", label: "Draft" },
                                    { value: "Issued", label: "Issued" },
                                    { value: "Confirmed", label: "Confirmed" },
                                    {
                                        value: "Nota Closed",
                                        label: "Nota Closed",
                                    },
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
                                            <Badge
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {row.nota_type}
                                            </Badge>
                                            {row.is_immutable && (
                                                <Lock
                                                    className="w-3 h-3 text-red-500"
                                                    title="IMMUTABLE - cannot edit"
                                                />
                                            )}
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
                                        {formatRupiahAdaptive(
                                            getNotaAmount(row),
                                        )}
                                    </span>
                                ),
                            },
                            {
                                header: "Status",
                                cell: (row) => (
                                    <StatusBadge status={row.status} />
                                ),
                            },
                            {
                                header: "Recon Status",
                                cell: (row) =>
                                    row.reconciliation_status ? (
                                        <StatusBadge
                                            status={row.reconciliation_status}
                                        />
                                    ) : (
                                        "-"
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
                                                setSelectedNota(row);
                                                setShowViewDialog(true);
                                            }}
                                        >
                                            <Eye className="w-4 h-4 mr-1" />
                                            View
                                        </Button>
                                        {row.status !== "Nota Closed" &&
                                            getNextStatus(row.status) && (
                                                <Button
                                                    size="sm"
                                                    className="bg-blue-600 hover:bg-blue-700 ml-3"
                                                    onClick={() => {
                                                        setSelectedNota(row);
                                                        setActionType(
                                                            getActionLabel(
                                                                row.status,
                                                            ),
                                                        );
                                                        setShowActionDialog(
                                                            true,
                                                        );
                                                    }}
                                                    disabled={
                                                        row.is_immutable &&
                                                        getActionLabel(
                                                            row.status,
                                                        ) === "Issued"
                                                    }
                                                >
                                                    <ArrowRight className="w-4 h-4 mr-1" />
                                                    {getActionLabel(row.status)}
                                                </Button>
                                            )}
                                        {row.is_immutable &&
                                            row.status !== "Nota Closed" && (
                                                <span className="text-xs text-gray-500 italic">
                                                    Proceed to Reconciliation
                                                </span>
                                            )}
                                    </div>
                                ),
                            },
                        ]}
                        data={filteredNotas}
                        isLoading={loading}
                        emptyMessage="No notas found"
                    />
                </TabsContent>

                {/* RECONCILIATION TAB */}
                <TabsContent value="reconciliation" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <GradientStatCard
                            title="Closed Notas"
                            value={
                                notas.filter((n) => n.status === "Nota Closed")
                                    .length
                            }
                            subtitle={formatRupiahAdaptive(
                                notas
                                    .filter((n) => n.status === "Nota Closed")
                                    .reduce(
                                        (sum, n) => sum + getNotaAmount(n),
                                        0,
                                    ),
                            )}
                            icon={CheckCircle2}
                            gradient="from-purple-500 to-purple-600"
                        />
                        <GradientStatCard
                            title="Total Paid"
                            value={formatRupiahAdaptive(
                                reconciliationItems.reduce(
                                    (sum, r) =>
                                        sum + toNumber(r.total_actual_paid),
                                    0,
                                ),
                            )}
                            subtitle="Actual payments"
                            icon={CheckCircle2}
                            gradient="from-green-500 to-green-600"
                        />
                        <GradientStatCard
                            title="Difference"
                            value={formatRupiahAdaptive(
                                reconciliationItems.reduce(
                                    (sum, r) =>
                                        sum +
                                        ((toNumber(r.amount) || 0) -
                                            (toNumber(r.total_actual_paid) ||
                                                0)),
                                    0,
                                ),
                            )}
                            subtitle="To reconcile"
                            icon={AlertTriangle}
                            gradient="from-orange-500 to-orange-600"
                        />
                        <GradientStatCard
                            title="Total Exceptions"
                            value={exceptionItems.length}
                            subtitle={`${filteredExceptions.length} visible`}
                            icon={FileText}
                            gradient="from-red-500 to-red-600"
                        />
                    </div>

                    <FilterTab
                        filters={reconFilters}
                        onFilterChange={setReconFilters}
                        defaultFilters={defaultFilterRecon}
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
                                    { value: "Draft", label: "Draft" },
                                    { value: "Issued", label: "Issued" },
                                    { value: "Confirmed", label: "Confirmed" },
                                    {
                                        value: "Nota Closed",
                                        label: "Nota Closed",
                                    },
                                ],
                            },
                            {
                                key: "hasException",
                                label: "Exception Status",
                                options: [
                                    { value: "all", label: "All" },
                                    { value: "yes", label: "Has Exception" },
                                    { value: "no", label: "No Exception" },
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
                            {
                                header: "Nota Amount",
                                cell: (row) => (
                                    <div>
                                        <div className="font-bold text-blue-600"></div>
                                        {formatRupiahAdaptive(
                                            getNotaAmount(row),
                                        )}
                                    </div>
                                ),
                            },
                            {
                                header: "Total Planned",
                                cell: (row) => (
                                    <div>
                                        <div className="text-gray-600">
                                            {formatRupiahAdaptive(
                                                row.total_planned,
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {row.intent_count} intent(s)
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                header: "Total Actual Paid",
                                cell: (row) => (
                                    <div>
                                        <div className="text-green-600 font-bold">
                                            {formatRupiahAdaptive(
                                                row.total_actual_paid,
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {row.payment_count} payment(s)
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                header: "Difference",
                                cell: (row) => {
                                    const diff =
                                        (row.amount || 0) -
                                        (row.total_actual_paid || 0);
                                    return (
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={
                                                    Math.abs(diff) > 1000
                                                        ? "text-red-600 font-bold"
                                                        : "text-green-600"
                                                }
                                            >
                                                {formatRupiahAdaptive(diff)}
                                            </span>
                                            {Math.abs(diff) > 1000 && (
                                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                            )}
                                        </div>
                                    );
                                },
                            },
                            {
                                header: "Recon Status",
                                cell: (row) => (
                                    <StatusBadge
                                        status={row.reconciliation_status}
                                    />
                                ),
                            },
                            {
                                header: "Nota Status",
                                cell: (row) => (
                                    <StatusBadge status={row.status} />
                                ),
                            },
                            {
                                header: "Actions",
                                cell: (row) => (
                                    <div className="flex gap-1 flex-wrap">
                                        {isTugure &&
                                            row.status !== "Nota Closed" &&
                                            row.reconciliation_status !==
                                                "FINAL" && (
                                                <Button
                                                    size="sm"
                                                    className="bg-blue-600"
                                                    onClick={() => {
                                                        setSelectedRecon(row);
                                                        setPaymentFormData({
                                                            actual_paid_amount:
                                                                "",
                                                            payment_date:
                                                                new Date()
                                                                    .toISOString()
                                                                    .split(
                                                                        "T",
                                                                    )[0],
                                                            bank_reference: "",
                                                        });
                                                        setShowPaymentDialog(
                                                            true,
                                                        );
                                                    }}
                                                >
                                                    Record Payment
                                                </Button>
                                            )}

                                        {isTugure &&
                                            row.reconciliation_status !==
                                                "FINAL" &&
                                            row.total_actual_paid > 0 && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleMarkReconFinal(
                                                            row,
                                                        )
                                                    }
                                                >
                                                    Mark FINAL
                                                </Button>
                                            )}

                                        {isTugure &&
                                            row.has_exception &&
                                            row.reconciliation_status ===
                                                "FINAL" && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-orange-600 border-orange-300"
                                                    onClick={() => {
                                                        setSelectedNota(row);
                                                        const diff =
                                                            (row.amount || 0) -
                                                            (row.total_actual_paid ||
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

                                        {(row.reconciliation_status ===
                                            "MATCHED" ||
                                            dnCnRecords.some(
                                                (d) =>
                                                    d.original_nota_id ===
                                                        row.nota_number &&
                                                    d.status === "Approved",
                                            )) &&
                                            row.status !== "Nota Closed" && (
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
                        data={filteredRecon}
                        isLoading={loading}
                        emptyMessage="No reconciliation items"
                    />
                </TabsContent>

                {/* Exception TAB */}
                <TabsContent value="dncn" className="space-y-6">
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
                                    { value: "Draft", label: "Draft" },
                                    { value: "Issued", label: "Issued" },
                                    { value: "Confirmed", label: "Confirmed" },
                                    {
                                        value: "Nota Closed",
                                        label: "Nota Closed",
                                    },
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

                                        {isTugure &&
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

                                        {(row.reconciliation_status ===
                                            "MATCHED" ||
                                            row.recon_status === "MATCHED" ||
                                            dnCnRecords.some(
                                                (d) =>
                                                    d.original_nota_id ===
                                                        row.nota_number &&
                                                    d.status === "Approved",
                                            )) &&
                                            row.status !== "Nota Closed" && (
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
                                    <div>
                                        <span className="text-gray-500">
                                            Immutable:
                                        </span>
                                        <span className="ml-2 font-bold">
                                            {selectedNota.is_immutable
                                                ? "🔒 YES"
                                                : "NO"}
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
        </div>
    );
}
