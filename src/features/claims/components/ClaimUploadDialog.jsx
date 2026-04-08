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

function DialogStepper({ step, isBrinsUser }) {
    return (
        <div className="flex mt-3">
            {[
                {
                    num: 1,
                    label: `Upload ${isBrinsUser ? "Recoveries" : "Claims"}`,
                },
                {
                    num: 2,
                    label: `${isBrinsUser ? "Recovery" : "Claim"} Preview`,
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
 * Two-step upload dialog: (1) pick batch & file → (2) preview rows before submit.
 *
 * Props:
 *   open               {boolean}
 *   onClose            {() => void}
 *   batches            {Array}
 *   isBrinsUser        {boolean}
 *   parsedClaims       {Array}        — populated by useClaimUpload after step 1
 *   validationRemarks  {Array}        — validation error objects
 *   dialogError        {string}
 *   previewValidationError {string}
 *   processing         {boolean}
 *   onPreview          {(file, batchId) => Promise<void>}   — triggers file parse
 *   onUpload           {(batchId) => Promise<void>}          — triggers bulk submit
 */
export function ClaimUploadDialog({
    open,
    onClose,
    batches,
    isBrinsUser,
    parsedClaims,
    validationRemarks,
    dialogError,
    previewValidationError,
    processing,
    onPreview,
    onUpload,
}) {
    const [step, setStep] = useState(1);
    const [selectedBatch, setSelectedBatch] = useState("");
    const [uploadFile, setUploadFile] = useState(null);
    const [showValidationDetails, setShowValidationDetails] = useState(false);

    const handleClose = () => {
        setStep(1);
        setSelectedBatch("");
        setUploadFile(null);
        setShowValidationDetails(false);
        onClose();
    };

    const handlePreview = async () => {
        if (!uploadFile || !selectedBatch) return;
        await onPreview(uploadFile, selectedBatch);
        setStep(2);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
            <DialogContent
                className="max-w-4xl w-full"
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
                            ? isBrinsUser
                                ? "Upload Recoveries"
                                : "Upload Claims"
                            : isBrinsUser
                              ? "Recovery Preview"
                              : "Claim Preview"}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 1
                            ? "Pilih batch lalu upload file CSV/Excel. Preview terlebih dahulu sebelum submit."
                            : isBrinsUser
                              ? "Periksa data sebelum mengunggah recovery ke sistem."
                              : "Periksa data sebelum mengunggah klaim ke sistem."}
                    </DialogDescription>
                    <DialogStepper step={step} isBrinsUser={isBrinsUser} />
                </DialogHeader>

                <div className="py-4 space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
                    {step === 1 && (
                        <>
                            <div>
                                <Label>Select Batch *</Label>
                                <Select
                                    value={selectedBatch}
                                    onValueChange={setSelectedBatch}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select batch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.isArray(batches) &&
                                            batches.map((b) => (
                                                <SelectItem
                                                    key={b.id}
                                                    value={b.id}
                                                >
                                                    {b.batch_id} (
                                                    {b.batch_month || ""}/
                                                    {b.batch_year || ""})
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Upload File</Label>
                                <Input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) setUploadFile(f);
                                    }}
                                    disabled={!selectedBatch}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Excel atau CSV format
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
                                        {parsedClaims.length}
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-lg px-4 py-2">
                                    <p className="text-xs text-gray-500">
                                        Batch
                                    </p>
                                    <p className="text-sm font-medium mt-1">
                                        {selectedBatch}
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
                                                    setShowValidationDetails(
                                                        true,
                                                    )
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
                                        Below is a preview of claims that will
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
                                                "nomor_peserta",
                                                "policy_no",
                                                "nama_tertanggung",
                                                "nomor_sertifikat",
                                                "nilai_klaim",
                                                "share_tugure_percentage",
                                                "share_tugure_amount",
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
                                        {parsedClaims.map((row, i) => (
                                            <tr
                                                key={i}
                                                className="hover:bg-gray-50 border-b border-gray-100"
                                            >
                                                <td className="p-2 text-gray-400 whitespace-nowrap">
                                                    {i + 1}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.nomor_peserta ?? "-"}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.policy_no ?? "-"}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.nama_tertanggung ??
                                                        "-"}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.nomor_sertifikat ??
                                                        "-"}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    Rp{" "}
                                                    {(
                                                        Number(
                                                            row.nilai_klaim,
                                                        ) || 0
                                                    ).toLocaleString("id-ID")}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.share_tugure_percentage ??
                                                        "-"}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {row.share_tugure_amount ??
                                                        "-"}
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
                                            Validation details (row,
                                            participant, issues)
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
                                                        Participant
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
                                                                {v.participant}
                                                            </td>
                                                            <td className="p-2">
                                                                {Array.isArray(
                                                                    v.issues,
                                                                )
                                                                    ? v.issues.join(
                                                                          "; ",
                                                                      )
                                                                    : String(
                                                                          v.issues,
                                                                      )}
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
                                processing || !uploadFile || !selectedBatch
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
                                onClick={() => onUpload(selectedBatch)}
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
                                    : `Upload ${parsedClaims.length} ${isBrinsUser ? "Recoveries" : "Claims"}`}
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
