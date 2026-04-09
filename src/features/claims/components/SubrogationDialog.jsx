import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { formatRupiahAdaptive } from "@/utils/currency";
import { toNumber } from "@/shared/utils/dataTransform";
import { claimService } from "../services/claimService";
import { backend } from "@/api/backendClient";

function SubrogationStepper({ step }) {
    return (
        <div className="flex mt-3">
            {[
                { num: 1, label: "Create Subrogation" },
                { num: 2, label: "Preview Subrogation" },
            ].map(({ num, label }) => {
                const isActive = step === num;
                const isDone = step > num;
                return (
                    <div
                        key={num}
                        className={`flex items-center gap-2 flex-1 pb-3 text-sm border-b-2 transition-all duration-300 ${
                            isActive
                                ? "border-blue-600 text-blue-600 font-medium"
                                : isDone
                                  ? "border-green-600 text-green-600"
                                  : "border-gray-200 text-gray-400"
                        }`}
                    >
                        <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                                isActive
                                    ? "bg-blue-600 text-white"
                                    : isDone
                                      ? "bg-green-600 text-white"
                                      : "bg-gray-200 text-gray-500"
                            }`}
                        >
                            {isDone ? "✓" : num}
                        </div>
                        {label}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Fully self-contained dialog to create a manual subrogation entry.
 *
 * Props:
 *   open           {boolean}
 *   onClose        {() => void}
 *   claims         {Array}     — list of Claim objects (from useClaimData)
 *   notas          {Array}     — list of Nota objects (to filter paid claims)
 *   user           {object}    — current user from useCurrentUser
 *   canShowActions {boolean}   — whether to render action buttons
 *   onSuccess      {(msg: string) => void}
 */
export function SubrogationDialog({
    open,
    onClose,
    claims,
    notas,
    user,
    canShowActions,
    onSuccess,
}) {
    const [step, setStep] = useState(1);
    const [selectedClaim, setSelectedClaim] = useState("");
    const [recoveryAmount, setRecoveryAmount] = useState("");
    const [recoveryDate, setRecoveryDate] = useState("");
    const [remarks, setRemarks] = useState("");
    const [previewError, setPreviewError] = useState("");
    const [processing, setProcessing] = useState(false);

    const resetAndClose = () => {
        setStep(1);
        setSelectedClaim("");
        setRecoveryAmount("");
        setRecoveryDate("");
        setRemarks("");
        setPreviewError("");
        onClose();
    };

    const handlePreview = async () => {
        setPreviewError("");
        if (!selectedClaim) {
            setPreviewError("Select a paid claim first");
            return;
        }
        if (!recoveryAmount || toNumber(recoveryAmount) <= 0) {
            setPreviewError("Enter a valid recovery amount");
            return;
        }
        try {
            await backend.validateSubrogationPayload({ recoveryAmount, recoveryDate });
        } catch (err) {
            setPreviewError(err?.message || "Validasi data gagal. Periksa jumlah dan tanggal pemulihan.");
            return;
        }
        setStep(2);
    };

    const handleCreate = async () => {
        if (!selectedClaim || !recoveryAmount) return;
        setProcessing(true);
        try {
            const claim = claims.find((c) => c.claim_no === selectedClaim);
            await claimService.createSubrogation(
                {
                    claimId: claim.claim_no,
                    debtorId: claim.debtor_id,
                    recoveryAmount,
                    recoveryDate,
                    remarks,
                },
                user,
            );
            onSuccess?.("Subrogation created");
            resetAndClose();
        } catch (err) {
            console.error("Failed to create subrogation:", err);
            setPreviewError("Failed to create subrogation: " + err.message);
        }
        setProcessing(false);
    };

    const paidClaims = Array.isArray(claims)
        ? claims.filter((c) =>
              Array.isArray(notas) &&
              notas.some(
                  (n) =>
                      n.nota_type === "Claim" &&
                      n.reference_id === c.claim_no &&
                      n.status === "PAID",
              ),
          )
        : [];

    const selectedClaimObj = claims?.find(
        (c) => c.claim_no === selectedClaim,
    );

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) resetAndClose();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Subrogation</DialogTitle>
                    <DialogDescription>
                        Create a manual subrogation entry and preview before
                        saving.
                    </DialogDescription>
                    <SubrogationStepper step={step} />
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {step === 1 && (
                        <>
                            <div>
                                <Label>Select Claim</Label>
                                <Select
                                    value={selectedClaim}
                                    onValueChange={(v) => {
                                        setSelectedClaim(v);
                                        const nota = Array.isArray(notas)
                                            ? notas.find(
                                                  (n) =>
                                                      n.nota_type === "Claim" &&
                                                      n.reference_id === v &&
                                                      n.status === "PAID",
                                              )
                                            : null;
                                        setRecoveryAmount(
                                            nota ? String(nota.amount) : "",
                                        );
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select paid claim" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {paidClaims.map((c) => (
                                            <SelectItem
                                                key={c.claim_no}
                                                value={c.claim_no}
                                            >
                                                {c.claim_no} -{" "}
                                                {c.nama_tertanggung}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Recovery Amount</Label>
                                <Input
                                    type="text"
                                    value={
                                        recoveryAmount
                                            ? formatRupiahAdaptive(
                                                  toNumber(recoveryAmount),
                                              )
                                            : ""
                                    }
                                    onChange={(e) => {
                                        const parsed = toNumber(e.target.value);
                                        setRecoveryAmount(
                                            parsed ? String(parsed) : "",
                                        );
                                    }}
                                />
                            </div>
                            <div>
                                <Label>Recovery Date</Label>
                                <Input
                                    type="date"
                                    value={recoveryDate}
                                    onChange={(e) =>
                                        setRecoveryDate(e.target.value)
                                    }
                                />
                            </div>
                            <div>
                                <Label>Remarks</Label>
                                <Input
                                    value={remarks}
                                    onChange={(e) =>
                                        setRemarks(e.target.value)
                                    }
                                    placeholder="Optional notes"
                                />
                            </div>
                            {previewError && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {previewError}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </>
                    )}

                    {step === 2 && (
                        <>
                            {previewError ? (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {previewError}
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert className="bg-blue-50 border-blue-200">
                                    <AlertCircle className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-700">
                                        Review the subrogation details below
                                        then confirm to create.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex gap-3 flex-wrap">
                                {[
                                    {
                                        label: "Claim",
                                        value: selectedClaim || "-",
                                    },
                                    {
                                        label: "Debtor",
                                        value:
                                            selectedClaimObj?.nama_tertanggung ||
                                            "-",
                                    },
                                    {
                                        label: "Recovery Amount",
                                        value: formatRupiahAdaptive(
                                            toNumber(recoveryAmount) || 0,
                                        ),
                                    },
                                    {
                                        label: "Recovery Date",
                                        value: recoveryDate
                                            ? new Date(
                                                  recoveryDate,
                                              ).toLocaleDateString("id-ID")
                                            : "-",
                                    },
                                    {
                                        label: "Remarks",
                                        value: remarks || "-",
                                    },
                                ].map(({ label, value }) => (
                                    <div
                                        key={label}
                                        className="bg-gray-50 rounded-lg px-4 py-2"
                                    >
                                        <p className="text-xs text-gray-500">
                                            {label}
                                        </p>
                                        <p className="text-sm font-medium mt-1">
                                            {value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {canShowActions && (
                    <DialogFooter>
                        <Button variant="outline" onClick={resetAndClose}>
                            Cancel
                        </Button>
                        {step === 2 && (
                            <Button
                                variant="outline"
                                onClick={() => setStep(1)}
                            >
                                ← Back
                            </Button>
                        )}
                        {step === 1 && (
                            <Button onClick={handlePreview}>
                                Preview Data →
                            </Button>
                        )}
                        {step === 2 && (
                            <div
                                className={`inline-block ${processing ? "hover:cursor-not-allowed" : ""}`}
                            >
                                <Button
                                    onClick={handleCreate}
                                    disabled={processing}
                                    className={`bg-green-600 text-white ${processing ? "opacity-60" : "hover:bg-green-700"}`}
                                >
                                    {processing ? "Creating..." : "Create"}
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
