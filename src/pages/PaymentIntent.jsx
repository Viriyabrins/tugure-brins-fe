import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    DollarSign,
    Send,
    CheckCircle2,
    Download,
    RefreshCw,
    Loader2,
    Eye,
    AlertCircle,
    Clock,
    Check,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import ModernKPI from "@/components/dashboard/ModernKPI";
import { formatRupiahAdaptive } from "@/utils/currency";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import { Checkbox } from "@/components/ui/checkbox";

export default function PaymentIntent() {
    const [user, setUser] = useState(null);
    const [notas, setNotas] = useState([]);
    const [paymentIntents, setPaymentIntents] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedNota, setSelectedNota] = useState("");
    const [selectedIntents, setSelectedIntents] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [paymentType, setPaymentType] = useState("FULL");
    const [plannedAmount, setPlannedAmount] = useState("");
    const [plannedDate, setPlannedDate] = useState("");
    const [remarks, setRemarks] = useState("");
    const [filters, setFilters] = useState({
        contract: "all",
        notaType: "all",
        status: "all",
    });

    const isBrins = user?.role === "BRINS" || user?.role === "admin";
    const isTugure = user?.role === "TUGURE" || user?.role === "admin";

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

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
        try {
            const [notaData, intentData, contractData] = await Promise.all([
                backend.list("Nota"),
                backend.list("PaymentIntent"),
                backend.list("Contract"),
            ]);

            const nextNotas = Array.isArray(notaData) ? notaData : [];
            const nextIntents = Array.isArray(intentData) ? intentData : [];
            const nextContracts = Array.isArray(contractData)
                ? contractData
                : [];

            const issuedNotas = nextNotas.filter(
                (n) => n.status === "Final" || n.status === "Confirmed",
            );

            setNotas(issuedNotas);
            setPaymentIntents(nextIntents);
            setContracts(nextContracts);
        } catch (error) {
            console.error("Failed to load data:", error);
            setNotas([]);
            setPaymentIntents([]);
            setContracts([]);
        }
        setLoading(false);
    };

    const handleCreateIntent = async () => {
        if (!selectedNota || !plannedAmount || !plannedDate) {
            setErrorMessage("Please fill all required fields");
            return;
        }

        setProcessing(true);
        setErrorMessage("");

        try {
            const nota = notas.find(
                (n) => n.id === selectedNota || n.nota_number === selectedNota,
            );
            if (!nota) {
                setErrorMessage("Nota not found");
                setProcessing(false);
                return;
            }

            if (nota.status !== "Final" && nota.status !== "Confirmed") {
                alert(
                    `❌ BLOCKED: Payment Intent can only be created for FINAL or CONFIRMED notas.\n\nCurrent nota status: ${nota.status}\n\nPlease wait for Nota to reach Final status first.`,
                );

                await backend.create("AuditLog", {
                    action: "BLOCKED_PAYMENT_INTENT",
                    module: "PAYMENT",
                    entity_type: "PaymentIntent",
                    entity_id: nota.nota_number,
                    old_value: "{}",
                    new_value: JSON.stringify({
                        blocked_reason: `Current status: ${nota.status}`,
                    }),
                    user_email: user?.email,
                    user_role: user?.role,
                    reason: `Attempted to create Payment Intent before Nota Final (current status: ${nota.status})`,
                });

                setErrorMessage(
                    "Payment Intent blocked - Nota must be Final first",
                );
                setProcessing(false);
                return;
            }

            const intentId = `PI-${nota.nota_number}-${Date.now()}`;

            const plannedDateISO = new Date(`${plannedDate}T00:00:00.000Z`).toISOString();

            await backend.create("PaymentIntent", {
                intent_id: intentId,
                invoice_id: nota.id || nota.nota_number,
                contract_id: nota.contract_id,
                payment_type: paymentType,
                planned_amount: parseFloat(plannedAmount),
                planned_date: plannedDateISO,
                remarks: remarks,
                status: "DRAFT",
            });

            await backend.create("Notification", {
                title: "Payment Intent Created (Planning Only)",
                message: `Payment Intent ${intentId} created for Nota ${nota.nota_number}. This is PLANNING ONLY - actual payment must be recorded in Reconciliation.`,
                type: "INFO",
                module: "PAYMENT",
                reference_id: intentId,
                target_role: "BRINS",
            });

            await backend.create("AuditLog", {
                action: "PAYMENT_INTENT_CREATED",
                module: "PAYMENT",
                entity_type: "PaymentIntent",
                entity_id: intentId,
                old_value: "{}",
                new_value: JSON.stringify({
                    planned_amount: parseFloat(plannedAmount),
                    planned_date: plannedDateISO,
                    note: "PLANNING ONLY",
                }),
                user_email: user?.email,
                user_role: user?.role,
            });

            setSuccessMessage(
                "Payment Intent created (planning only - record actual payment in Reconciliation)",
            );
            setShowCreateDialog(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error("Create error:", error);
            setErrorMessage("Failed to create payment intent");
        }
        setProcessing(false);
    };

    const resetForm = () => {
        setSelectedNota("");
        setPaymentType("FULL");
        setPlannedAmount("");
        setPlannedDate("");
        setRemarks("");
    };

    const handleSubmitIntent = async (intent) => {
        setProcessing(true);
        try {
            // Gunakan intent.intent_id atau intent.id sesuai dengan schema
            const idToUpdate = intent.intent_id || intent.id;

            await backend.update("PaymentIntent", idToUpdate, {
                status: "SUBMITTED",
            });

            await backend.create("Notification", {
                title: "Payment Intent Submitted",
                message: `Payment Intent ${intent.intent_id} submitted for approval`,
                type: "ACTION_REQUIRED",
                module: "PAYMENT",
                reference_id: intent.intent_id,
                target_role: "TUGURE",
            });

            setSuccessMessage("Payment intent submitted for approval");
            loadData();
        } catch (error) {
            console.error("Submit error:", error);
            setErrorMessage("Failed to submit payment intent");
        }
        setProcessing(false);
    };

    const handleApproveIntent = async (intent) => {
        setProcessing(true);
        try {
            const idToUpdate = intent.intent_id || intent.id;

            await backend.update("PaymentIntent", idToUpdate, {
                status: "APPROVED",
            });

            await backend.create("Notification", {
                title: "Payment Intent Approved",
                message: `Payment Intent ${intent.intent_id} approved`,
                type: "INFO",
                module: "PAYMENT",
                reference_id: intent.intent_id,
                target_role: "BRINS",
            });

            setSuccessMessage("Payment intent approved");
            loadData();
        } catch (error) {
            console.error("Approve error:", error);
            setErrorMessage("Failed to approve payment intent");
        }
        setProcessing(false);
    };

    const handleRejectIntent = async (intent) => {
        setProcessing(true);
        try {
            const idToUpdate = intent.intent_id || intent.id;

            await backend.update("PaymentIntent", idToUpdate, {
                status: "REJECTED",
            });

            await backend.create("Notification", {
                title: "Payment Intent Rejected",
                message: `Payment Intent ${intent.intent_id} rejected`,
                type: "WARNING",
                module: "PAYMENT",
                reference_id: intent.intent_id,
                target_role: "BRINS",
            });

            setSuccessMessage("Payment intent rejected");
            loadData();
        } catch (error) {
            console.error("Reject error:", error);
            setErrorMessage("Failed to reject payment intent");
        }
        setProcessing(false);
    };

    // Filter data berdasarkan filter yang dipilih
    const filteredIntents = paymentIntents.filter((p) => {
        if (filters.contract !== "all" && p.contract_id !== filters.contract)
            return false;
        if (filters.status !== "all" && p.status !== filters.status)
            return false;

        // Filter by nota type jika ada
        if (filters.notaType !== "all") {
            const nota = notas.find(
                (n) => n.id === p.invoice_id || n.nota_number === p.invoice_id,
            );
            if (!nota || nota.nota_type !== filters.notaType) return false;
        }

        return true;
    });

    const toggleIntentSelection = (intentId) => {
        if (selectedIntents.includes(intentId)) {
            setSelectedIntents(selectedIntents.filter((id) => id !== intentId));
        } else {
            setSelectedIntents([...selectedIntents, intentId]);
        }
    };

    const columns = [
        {
            header: (
                <Checkbox
                    checked={
                        selectedIntents.length === filteredIntents.length &&
                        filteredIntents.length > 0
                    }
                    onCheckedChange={(checked) => {
                        if (checked) {
                            setSelectedIntents(
                                filteredIntents.map((p) => p.intent_id || p.id),
                            );
                        } else {
                            setSelectedIntents([]);
                        }
                    }}
                />
            ),
            cell: (row) => (
                <Checkbox
                    checked={selectedIntents.includes(row.intent_id || row.id)}
                    onCheckedChange={() =>
                        toggleIntentSelection(row.intent_id || row.id)
                    }
                />
            ),
            width: "40px",
        },
        {
            header: "Intent ID",
            cell: (row) => row.intent_id || row.id
        },
        {
            header: "Nota Reference",
            cell: (row) => {
                const nota = notas.find(
                    (n) =>
                        n.id === row.invoice_id ||
                        n.nota_number === row.invoice_id,
                );
                return nota?.nota_number || "-";
            },
        },
        {
            header: "Type",
            cell: (row) => <StatusBadge status={row.payment_type} />,
        },
        {
            header: "Planned Amount",
            cell: (row) =>
                formatRupiahAdaptive(row.planned_amount),
        },
        {
            header: "Planned Date",
            cell: (row) => row.planned_date,
        },
        {
            header: "Status",
            cell: (row) => <StatusBadge status={row.status} />,
        },
        {
            header: "Actions",
            cell: (row) => (
                <div className="flex gap-2">
                    {row.status === "DRAFT" && isBrins && (
                        <Button
                            size="sm"
                            className="bg-blue-600"
                            onClick={() => handleSubmitIntent(row)}
                        >
                            Submit
                        </Button>
                    )}
                    {row.status === "SUBMITTED" && isTugure && (
                        <>
                            <Button
                                size="sm"
                                className="bg-green-600"
                                onClick={() => handleApproveIntent(row)}
                            >
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectIntent(row)}
                            >
                                Reject
                            </Button>
                        </>
                    )}
                    {row.status === "APPROVED" && (
                        <span className="text-xs text-green-600">
                            Approved - Ready for Matching
                        </span>
                    )}
                </div>
            ),
        },
    ];



    return (
        <div className="space-y-6">
            {/* Page Header  */}
            <PageHeader
                title="Payment Intent - Planning Stage"
                subtitle="⚠️ Payment Intent is PLANNING ONLY - does not mark payment as done. Record actual payments in Reconciliation."
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Payment Intent" },
                ]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={loadData}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                        {isBrins && (
                            <Button
                                onClick={() => setShowCreateDialog(true)}
                                variant="outline"
                            >
                                <DollarSign className="w-4 h-4 mr-2" />
                                Create Intent
                            </Button>
                        )}
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

            {errorMessage && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            {notas.length === 0 && !loading && (
                <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700">
                        No Final notas available. Please ensure Nota Management
                        has Final notas first.
                    </AlertDescription>
                </Alert>
            )}

            {/* Gradient Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard
                    title="Available Notas"
                    value={notas.length}
                    subtitle="Final/Confirmed"
                    icon={DollarSign}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title="Draft Intents"
                    value={
                        paymentIntents.filter((p) => p.status === "DRAFT")
                            .length
                    }
                    subtitle="Pending submission"
                    icon={Clock}
                    gradient="from-orange-500 to-orange-600"
                />
                <GradientStatCard
                    title="Approved Intents"
                    value={
                        paymentIntents.filter((p) => p.status === "APPROVED")
                            .length
                    }
                    subtitle="Ready for matching"
                    icon={CheckCircle2}
                    gradient="from-green-500 to-green-600"
                />
                <GradientStatCard  
                    title="Total Planned"
                    value={formatRupiahAdaptive(
                        filteredIntents.reduce(
                            (sum, p) => sum + (Number(p.planned_amount) || 0),
                            0,
                        ),
                    )}
                    subtitle="Planned Payment Amount"
                    icon={DollarSign}
                    gradient="from-purple-500 to-purple-600"
                />
            </div>

            {/* Filter Tab */}
            <FilterTab
                filters={filters}
                onFilterChange={setFilters}
                defaultFilters={{
                    contract: "all",
                    notaType: "all",
                    status: "all",
                }}
                filterConfig={[
                    {
                        key: "contract",
                        placeholder: "Contract",
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
                        placeholder: "Nota Type",
                        options: [
                            { value: "all", label: "All Types" },
                            { value: "Batch", label: "Batch" },
                            { value: "Claim", label: "Claim" },
                            { value: "Subrogation", label: "Subrogation" },
                        ],
                    },
                    {
                        key: "status",
                        placeholder: "Intent Status",
                        options: [
                            { value: "all", label: "All Status" },
                            { value: "DRAFT", label: "Draft" },
                            { value: "SUBMITTED", label: "Submitted" },
                            { value: "APPROVED", label: "Approved" },
                            { value: "REJECTED", label: "Rejected" },
                        ],
                    },
                ]}
            />



            {/* Payment Intents Table */}
            <DataTable
                columns={columns}
                data={filteredIntents}
                isLoading={loading}
                emptyMessage="No payment intents"
            />

            {/* Create Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Payment Intent</DialogTitle>
                        <DialogDescription>
                            Plan payment for Final nota
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Select Nota *</Label>
                            <Select
                                value={selectedNota}
                                onValueChange={(val) => {
                                    setSelectedNota(val);
                                    const nota = notas.find(
                                        (n) => n.id === val,
                                    );
                                    if (nota) {
                                        setPlannedAmount(
                                            nota.amount?.toString() || "",
                                        );
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select nota" />
                                </SelectTrigger>
                                <SelectContent>
                                    {notas.map((n) => (
                                        <SelectItem
                                            key={n.id || n.nota_number}
                                            value={n.id || n.nota_number}
                                        >
                                            {n.nota_number} - {n.nota_type} - Rp{" "}
                                            {(n.amount || 0).toLocaleString(
                                                "id-ID",
                                            )}{" "}
                                            ({n.status})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Payment Type</Label>
                            <Select
                                value={paymentType}
                                onValueChange={setPaymentType}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FULL">
                                        Full Payment
                                    </SelectItem>
                                    <SelectItem value="PARTIAL">
                                        Partial Payment
                                    </SelectItem>
                                    <SelectItem value="INSTALMENT">
                                        Instalment
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Planned Amount (Rp) *</Label>
                            <Input
                                type="number"
                                value={plannedAmount}
                                onChange={(e) =>
                                    setPlannedAmount(e.target.value)
                                }
                            />
                        </div>
                        <div>
                            <Label>Planned Date *</Label>
                            <Input
                                type="date"
                                value={plannedDate}
                                onChange={(e) => setPlannedDate(e.target.value)}
                                min={new Date().toISOString()}
                            />
                        </div>
                        <div>
                            <Label>Remarks</Label>
                            <Textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCreateDialog(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateIntent}
                            disabled={
                                processing ||
                                !selectedNota ||
                                !plannedAmount ||
                                !plannedDate
                            }
                            className="bg-blue-600"
                        >
                            {processing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4 mr-2" />
                            )}
                            Create Intent
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
