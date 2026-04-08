export const DEFAULT_BATCH_FILTER = {
    contract: "all",
    batch: "",
    status: "all",
    startDate: "",
    endDate: "",
};

export const BATCH_WORKFLOW = {
    Uploaded: "Validated",
    Validated: "Matched",
    Matched: "Approved",
    Approved: "Nota Issued",
    "Nota Issued": "Branch Confirmed",
    "Branch Confirmed": "Paid",
    Paid: "Closed",
};

export const BATCH_ACTION_LABELS = {
    Uploaded: "Validate",
    Validated: "Match",
    Matched: "Approve",
    Approved: "Generate Nota",
    "Nota Issued": "Confirm",
    "Branch Confirmed": "Mark Paid",
    Paid: "Close",
};

export const BATCH_STATUS_FIELDS = {
    Validated: { by: "validated_by", date: "validated_date" },
    Matched: { by: "matched_by", date: "matched_date" },
    Approved: { by: "approved_by", date: "approved_date" },
    "Nota Issued": { by: "nota_issued_by", date: "nota_issued_date" },
    "Branch Confirmed": { by: "branch_confirmed_by", date: "branch_confirmed_date" },
    Paid: { by: "paid_by", date: "paid_date" },
    Closed: { by: "closed_by", date: "closed_date" },
};

export const BATCH_FILTER_STATUSES = [
    "Uploaded", "Validated", "Matched", "Approved",
    "Nota Issued", "Branch Confirmed", "Paid", "Closed", "Revision",
];

export const getNextStatus = (current) => BATCH_WORKFLOW[current] ?? null;
export const getActionLabel = (status) => BATCH_ACTION_LABELS[status] ?? "Process";
export const getStatusField = (status) => BATCH_STATUS_FIELDS[status] ?? { by: "processed_by", date: "processed_date" };

export function computeBatchReviewSync(batches, debtors) {
    return batches.map((batch) => {
        const batchDebtors = debtors.filter((d) => d.batch_id === batch.batch_id);
        if (batchDebtors.length === 0) return { batch, needsUpdate: false, updatePayload: null };

        const reviewedDebtors = batchDebtors.filter(
            (d) => d.status === "APPROVED" || d.status === "REVISION" || d.validation_remarks || d.remark_premi
        );
        const approvedDebtors = batchDebtors.filter((d) => d.status === "APPROVED");
        const allReviewed = reviewedDebtors.length === batchDebtors.length;
        const hasApproved = approvedDebtors.length > 0;
        const reviewCompleted = allReviewed;
        const readyForNota = allReviewed && hasApproved;

        const finalExposureAmount = approvedDebtors.reduce((sum, d) => sum + (Number(d.plafon) || 0), 0);
        const finalPremiumAmount = approvedDebtors.reduce((sum, d) => sum + (Number(d.net_premi) || 0), 0);

        const needsUpdate =
            Boolean(batch.debtor_review_completed) !== reviewCompleted ||
            Boolean(batch.batch_ready_for_nota) !== readyForNota ||
            (Number(batch.final_exposure_amount) || 0) !== finalExposureAmount ||
            (Number(batch.final_premium_amount) || 0) !== finalPremiumAmount;

        const updatedBatch = { ...batch, debtor_review_completed: reviewCompleted, batch_ready_for_nota: readyForNota, final_exposure_amount: finalExposureAmount, final_premium_amount: finalPremiumAmount };
        return { batch: updatedBatch, needsUpdate, updatePayload: { debtor_review_completed: reviewCompleted, batch_ready_for_nota: readyForNota, final_exposure_amount: finalExposureAmount, final_premium_amount: finalPremiumAmount } };
    });
}
