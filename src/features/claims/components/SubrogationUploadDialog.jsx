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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

function DialogStepper({ step }) {
    return (
        <div className="flex mt-3">
            {[
                {
                    num: 1,
                    label: "Upload Subrogations",
                },
                {
                    num: 2,
                    label: "Subrogation Preview",
                },
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
 * Two-step upload dialog: (1) pick subrogation file → (2) preview subrogations before submit.
 *
 * Props:
 *   open               {boolean}
 *   onClose            {() => void}
 *   parsedSubrogations {Array}        — populated by useSubrogationUpload after step 1
 *   validationRemarks  {Array}        — validation error objects
 *   dialogError        {string}
 *   previewValidationError {string}
 *   processing         {boolean}
 *   onPreview          {(file) => Promise<void>}   — triggers file parse
 *   onUpload           {() => Promise<void>}       — triggers bulk submit
 */
export function SubrogationUploadDialog({
    open,
    onClose,
    parsedSubrogations,
    validationRemarks,
    dialogError,
    previewValidationError,
    processing,
    onPreview,
    onUpload,
}) {
    const [step, setStep] = useState(1);
    const [uploadFile, setUploadFile] = useState(null);
    const [showValidationDetails, setShowValidationDetails] = useState(false);

    const handleClose = () => {
        setStep(1);
        setUploadFile(null);
        setShowValidationDetails(false);
        onClose();
    };

    const handlePreview = async () => {
        if (!uploadFile) return;
        await onPreview(uploadFile);
        setStep(2);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
            <DialogContent
                className="max-w-6xl w-full"
                style={{
                    maxHeight: "90vh",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                <DialogHeader className="shrink-0">
                    <DialogTitle>
                        {step === 1
                            ? "Upload Subrogations"
                            : "Subrogation Preview"}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 1
                            ? "Upload Excel file containing subrogation data. Preview before submitting."
                            : "Review subrogation data before uploading to the system."}
                    </DialogDescription>
                    <DialogStepper step={step} />
                </DialogHeader>

                <div className="py-4 space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
                    {step === 1 && (
                        <>
                            <div>
                                <Label>Upload Subrogation File *</Label>
                                <Input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) setUploadFile(f);
                                    }}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Excel atau CSV format dengan kolom subrogation
                                </p>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="flex gap-3 flex-wrap">
                                <div className="bg-gray-50 rounded-lg px-4 py-2">
                                    <p className="text-xs text-gray-500">
                                        Total Rows
                                    </p>
                                    <p className="text-xl font-medium">
                                        {parsedSubrogations.length}
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-lg px-4 py-2">
                                    <p className="text-xs text-gray-500">
                                        File
                                    </p>
                                    <p className="text-sm font-medium mt-1">
                                        {uploadFile?.name}
                                    </p>
                                </div>
                            </div>

                            {dialogError ? (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {dialogError}
                                    </AlertDescription>
                                </Alert>
                            ) : validationRemarks.length > 0 ? (
                                <Alert className="bg-red-50 border-red-200">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-700">
                                        {previewValidationError ||
                                            `Found ${validationRemarks.length} rows with validation issues.`}
                                        <div className="mt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setShowValidationDetails(true)
                                                }
                                            >
                                                View details
                                            </Button>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert className="bg-blue-50 border-blue-200">
                                    <AlertCircle className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-700">
                                        Below is a preview of subrogations that will
                                        be uploaded. Review before confirming.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div
                                style={{
                                    overflowX: "auto",
                                    overflowY: "auto",
                                    maxHeight: "340px",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "8px",
                                    width: "100%",
                                }}
                            >
                                <table
                                    className="text-xs"
                                    style={{
                                        minWidth: "max-content",
                                        borderCollapse: "collapse",
                                    }}
                                >
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            {[
                                                "#",
                                                "claim_no",
                                                "policy_no",
                                                "cedant_remarks",
                                                "contract_id",
                                                "subrogation_amount",
                                                "dol_date",
                                                "bdo_claim_date",
                                            ].map((k) => (
                                                <th
                                                    key={k}
                                                    className="text-left p-2 font-medium text-gray-500 border-b whitespace-nowrap"
                                                    style={{
                                                        minWidth:
                                                            k === "#"
                                                                ? "36px"
                                                                : "140px",
                                                    }}
                                                >
                                                    {k === "#"
                                                        ? "#"
                                                        : k.replace(/_/g, " ")}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedSubrogations.map((row, i) => (
                                            <tr
                                                key={i}
                                                className="hover:bg-gray-50 border-b border-gray-100"
                                            >
                                                <td className="p-2 text-gray-400 whitespace-nowrap">
                                                    {i + 1}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.claim_no ?? "-"}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.policy_no ?? "-"}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.cedant_remarks ?? "-"}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.contract_id ?? "-"}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    Rp{" "}
                                                    {(
                                                        Number(
                                                            row.subrogation_amount,
                                                        ) || 0
                                                    ).toLocaleString("id-ID")}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.dol_date ?? "-"}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.bdo_claim_date ?? "-"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {showValidationDetails &&
                                validationRemarks.length > 0 && (
                                    <div
                                        className="mt-3 p-3 border rounded bg-white"
                                        style={{
                                            maxHeight: "220px",
                                            overflowY: "auto",
                                        }}
                                    >
                                        <p className="text-sm font-medium mb-2">
                                            Validation details (row, field, issues)
                                        </p>
                                        <table
                                            className="w-full text-xs"
                                            style={{ borderCollapse: "collapse" }}
                                        >
                                            <thead>
                                                <tr className="text-left text-gray-500">
                                                    <th
                                                        className="p-2"
                                                        style={{ width: "64px" }}
                                                    >
                                                        Row
                                                    </th>
                                                    <th
                                                        className="p-2"
                                                        style={{ minWidth: "160px" }}
                                                    >
                                                        Field
                                                    </th>
                                                    <th className="p-2">
                                                        Issues
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {validationRemarks.map(
                                                    (v, idx) => (
                                                        <tr
                                                            key={idx}
                                                            className="border-t border-gray-100"
                                                        >
                                                            <td className="p-2 whitespace-nowrap">
                                                                {v.row}
                                                            </td>
                                                            <td className="p-2 whitespace-nowrap">
                                                                {v.field}
                                                            </td>
                                                            <td className="p-2">
                                                                {v.expected}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
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
                        <Button
                            onClick={handlePreview}
                            disabled={
                                processing || !uploadFile
                            }
                        >
                            {processing ? "Processing..." : "Preview Data →"}
                        </Button>
                    )}
                    {step === 2 && (
                        <div
                            className={`inline-block ${
                                processing || validationRemarks.length > 0
                                    ? "hover:cursor-not-allowed"
                                    : ""
                            }`}
                        >
                            <Button
                                onClick={() => onUpload()}
                                disabled={
                                    processing || validationRemarks.length > 0
                                }
                                className={`bg-green-600 text-white ${
                                    processing || validationRemarks.length > 0
                                        ? "opacity-60"
                                        : "hover:bg-green-700"
                                }`}
                            >
                                {processing
                                    ? "Uploading..."
                                    : `Upload ${parsedSubrogations.length} Subrogations`}
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}