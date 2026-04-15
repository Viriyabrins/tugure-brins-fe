import { backend } from "@/api/backendClient";

/** Builds a deduplication key from policy_no + nomor_peserta. */
export const claimKey = (r) =>
    `${String(r.policy_no || "").trim().toLowerCase()}||${String(r.nomor_peserta || "").trim().toLowerCase()}`;

/**
 * Validates a single parsed row against the batch's debtor list.
 * Returns the matched debtor and any validation issues found.
 */
export function validateClaimRow(row, batchDebtors) {
    const issues = [];
    const debtor = batchDebtors.find(
        (d) =>
            String(d.nomor_peserta || "").trim() ===
                String(row.nomor_peserta || "").trim() &&
            String(d.policy_no || "").trim() ===
                String(row.policy_no || "").trim(),
    );
    if (!debtor) {
        issues.push(
            `Debtor not found: participant number "${row.nomor_peserta}" and policy number "${row.policy_no}" do not exist in the selected batch — check your source file for correct participant and policy numbers`,
        );
    }
    return { debtor, issues };
}

/**
 * Flags duplicate rows within the uploaded file (same policy_no + nomor_peserta).
 * Mutates `item.validation_remarks` on affected rows and returns error records.
 */
export function validateFileInternalDuplicates(parsed) {
    const errors = [];
    const fileMap = {};
    for (const p of parsed) {
        const k = claimKey(p);
        if (!fileMap[k]) fileMap[k] = [];
        fileMap[k].push(p);
    }
    for (const group of Object.values(fileMap)) {
        if (group.length > 1) {
            for (const item of group) {
                const issue =
                    "Duplicate in uploaded file (policy number & participant)";
                errors.push({
                    row: item.excelRow,
                    participant: item.nomor_peserta || "Unknown",
                    issues: [issue],
                });
                item.validation_remarks = [item.validation_remarks, issue]
                    .filter(Boolean)
                    .join("; ");
            }
        }
    }
    return errors;
}

/**
 * Fetches existing claims and flags rows that are already present in the batch.
 * Mutates `item.validation_remarks` on affected rows and returns error records.
 */
export async function validateBatchDuplicates(parsed, batchId) {
    const errors = [];
    try {
        const claimResult = await backend.listPaginated("Claim", {
            limit: 9999,
        });
        const existingKeys = new Set(
            (claimResult?.data || [])
                .filter((c) => c.batch_id === batchId)
                .map((c) => claimKey(c)),
        );
        for (const item of parsed) {
            if (existingKeys.has(claimKey(item))) {
                const issue =
                    "Duplicate with existing claim in selected batch (policy number & participant)";
                errors.push({
                    row: item.excelRow,
                    participant: item.nomor_peserta || "Unknown",
                    issues: [issue],
                });
                item.validation_remarks = [item.validation_remarks, issue]
                    .filter(Boolean)
                    .join("; ");
            }
        }
    } catch (err) {
        console.warn("Batch duplicate check failed:", err);
    }
    return errors;
}

/**
 * Converts a list of validation errors into one human-readable summary string.
 */
export function buildValidationSummary(errors) {
    if (!Array.isArray(errors) || errors.length === 0) return "";
    const counts = {
        debtorNotFound: 0,
        duplicateInFile: 0,
        duplicateInBatch: 0,
        other: 0,
    };
    for (const e of errors) {
        for (const issue of e.issues) {
            const txt = String(issue || "").toLowerCase();
            if (txt.includes("debtor not found")) counts.debtorNotFound++;
            else if (txt.includes("duplicate in uploaded file"))
                counts.duplicateInFile++;
            else if (txt.includes("duplicate with existing claim"))
                counts.duplicateInBatch++;
            else counts.other++;
        }
    }
    const parts = [];
    if (counts.debtorNotFound)
        parts.push(
            `${counts.debtorNotFound} row(s) have policy number and/or participant ID that do NOT exist in the batch's debtor list — verify the correct participant and policy numbers are used`,
        );
    if (counts.duplicateInFile)
        parts.push(
            `${counts.duplicateInFile} rows are duplicated within the uploaded file`,
        );
    if (counts.duplicateInBatch)
        parts.push(
            `${counts.duplicateInBatch} rows are already claimed in the selected batch`,
        );
    if (counts.other) parts.push(`${counts.other} rows have other data issues`);
    return `Found ${errors.length} rows with validation issues: ${parts.join("; ")}. Please fix the source file and re-upload, or click Back to adjust. Click 'View details' for row-level information.`;
}
