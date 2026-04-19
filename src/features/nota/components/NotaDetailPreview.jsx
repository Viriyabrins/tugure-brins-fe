import React from "react";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatRupiahAdaptive } from "@/utils/currency";

function parseNumberSafe(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return isNaN(value) || !isFinite(value) ? 0 : value;
    const cleaned = value.toString().trim().replace(/,/g, "").replace(/[^\d.-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) || !isFinite(num) ? 0 : num;
}

function fmt(val) {
    const n = typeof val === "number" ? val : parseNumberSafe(val);
    const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `(${s})` : s;
}

function fmtDate(d) {
    if (!d) return "-";
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

export default function NotaDetailPreview({ nota, contract }) {
    if (!nota) return null;

    const kindText = nota.reference_id || nota.contract_id || "AUTO FACULTATIVE CREDIT COMMERCIAL";
    const periodStart = fmtDate(contract?.contract_start_date);
    const periodEnd = fmtDate(contract?.contract_end_date);

    const netDueDisplayValue = nota.nota_type === "Claim"
        ? -Math.abs(parseNumberSafe(nota.net_due))
        : parseNumberSafe(nota.net_due);

    return (
        <div className="space-y-4">
            {/* General Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="border rounded p-2">
                    <div className="font-medium text-gray-500 text-xs">User Nota Number</div>
                    <div className="font-mono font-semibold break-words">{nota.user_nota_number || <span className="text-gray-400 italic">Not assigned</span>}</div>
                </div>
                <div className="border rounded p-2">
                    <div className="font-medium text-gray-500 text-xs">System Nota Number</div>
                    <div className="font-mono font-semibold break-words">{nota.nota_number}</div>
                </div>
                <div className="border rounded p-2">
                    <div className="font-medium text-gray-500 text-xs">Nota Type</div>
                    <div><Badge variant="outline">{nota.nota_type}</Badge></div>
                </div>
                <div className="border rounded p-2">
                    <div className="font-medium text-gray-500 text-xs">Status</div>
                    <div><StatusBadge status={nota.status} /></div>
                </div>
                <div className="border rounded p-2">
                    <div className="font-medium text-gray-500 text-xs">Kind of Treaty</div>
                    <div className="break-words">{kindText}</div>
                </div>
                <div className="border rounded p-2">
                    <div className="font-medium text-gray-500 text-xs">Reference ID</div>
                    <div className="break-words">{nota.reference_id || "-"}</div>
                </div>
                <div className="border rounded p-2">
                    <div className="font-medium text-gray-500 text-xs">Contract ID</div>
                    <div className="break-words">{nota.contract_id || "-"}</div>
                </div>
                {contract && (
                    <div className="border rounded p-2 col-span-1 md:col-span-2">
                        <div className="font-medium text-gray-500 text-xs">Contract Period</div>
                        <div>{periodStart} &mdash; {periodEnd}</div>
                    </div>
                )}
            </div>

            {/* Financial Summary */}
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Financial Summary (IDR)
                </div>
                <div className="divide-y">
                    <div className="grid grid-cols-2 px-3 py-2 text-sm">
                        <span className="text-gray-600">Premium</span>
                        <span className="text-right font-medium">{fmt(nota.premium)}</span>
                    </div>
                    <div className="grid grid-cols-2 px-3 py-2 text-sm">
                        <span className="text-gray-600">Commission</span>
                        <span className="text-right font-medium">{fmt(-Math.abs(parseNumberSafe(nota.commission)))}</span>
                    </div>
                    <div className="grid grid-cols-2 px-3 py-2 text-sm">
                        <span className="text-gray-600">Claim</span>
                        <span className="text-right font-medium">{fmt(nota.claim)}</span>
                    </div>
                    <div className="grid grid-cols-2 px-3 py-2 text-sm">
                        <span className="text-gray-600">Total</span>
                        <span className="text-right font-medium">{fmt(nota.total)}</span>
                    </div>
                    <div className="grid grid-cols-2 px-3 py-2 text-sm bg-blue-50 font-semibold">
                        <span className="text-blue-700">Net Due</span>
                        <span className="text-right text-blue-700">{fmt(netDueDisplayValue)}</span>
                    </div>
                </div>
            </div>

            {/* Payment Info (if available) */}
            {(nota.total_actual_paid !== undefined && nota.total_actual_paid !== null) && (
                <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Payment Information
                    </div>
                    <div className="divide-y">
                        <div className="grid grid-cols-2 px-3 py-2 text-sm">
                            <span className="text-gray-600">Amount</span>
                            <span className="text-right font-medium">{formatRupiahAdaptive(nota.amount)}</span>
                        </div>
                        <div className="grid grid-cols-2 px-3 py-2 text-sm">
                            <span className="text-gray-600">Total Actual Paid</span>
                            <span className="text-right font-medium text-green-600">{formatRupiahAdaptive(nota.total_actual_paid)}</span>
                        </div>
                        {nota.reconciliation_status && (
                            <div className="grid grid-cols-2 px-3 py-2 text-sm">
                                <span className="text-gray-600">Reconciliation Status</span>
                                <span className="text-right"><StatusBadge status={nota.reconciliation_status} /></span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
