import { backend } from "@/api/backendClient";

/** Builds a deduplication key from policy_no + nomor_peserta. */
export const claimKey = (r) =>
    `${String(r.policy_no || "").trim().toLowerCase()}||${String(r.nomor_peserta || "").trim().toLowerCase()}`;

/**
 * Validates a single parsed row against the debtor list.
 * Returns the matched debtor and any validation issues found.
 */
export function validateClaimRow(row, allDebtors) {
    const issues = [];
    const debtor = allDebtors.find(
        (d) =>
            String(d.nomor_peserta || "").trim() ===
                String(row.nomor_peserta || "").trim() &&
            String(d.policy_no || "").trim() ===
                String(row.policy_no || "").trim(),
    );
    if (!debtor) {
        issues.push(
            `Debtor not found: participant number "${row.nomor_peserta}" and policy number "${row.policy_no}" do not exist in debtors — check your source file for correct participant and policy numbers`,
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
 * Fetches existing claims and flags rows that already exist.
 * Mutates `item.validation_remarks` on affected rows and returns error records.
 */
export async function validateExistingDuplicates(parsed) {
    const errors = [];
    try {
        const claimResult = await backend.listPaginated("Claim", {
            limit: 9999,
        });
        const existingKeys = new Set(
            (claimResult?.data || []).map((c) => claimKey(c)),
        );
        for (const item of parsed) {
            if (existingKeys.has(claimKey(item))) {
                const issue =
                    "Duplicate with existing claim (policy number & participant)";
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
        console.warn("Duplicate check failed:", err);
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
        missingClaimNo: 0,
        duplicateClaimNo: 0,
        existingClaimNo: 0,
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
            else if (txt.includes("missing claim_no")) counts.missingClaimNo++;
            else if (txt.includes("duplicate claim_no")) counts.duplicateClaimNo++;
            else if (txt.includes("already exists in the database")) counts.existingClaimNo++;
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
    if (counts.missingClaimNo)
        parts.push(
            `${counts.missingClaimNo} row(s) are missing a claim_no — every row must have a claim number`,
        );
    if (counts.duplicateClaimNo)
        parts.push(
            `${counts.duplicateClaimNo} row(s) have duplicate claim_no values within the uploaded file`,
        );
    if (counts.existingClaimNo)
        parts.push(
            `${counts.existingClaimNo} row(s) have a claim_no that already exists in the database`,
        );
    if (counts.other) parts.push(`${counts.other} rows have other data issues`);
    return `Found ${errors.length} rows with validation issues: ${parts.join("; ")}. Please fix the source file and re-upload, or click Back to adjust. Click 'View details' for row-level information.`;
}

/**
 * Validates that every row has a non-empty claim_no, that claim_no values are
 * unique within the uploaded file, and that none already exist in the database.
 * Mutates `item.validation_remarks` on affected rows and returns error records.
 */
export async function validateClaimNos(parsed) {
    const errors = [];
    
    // Debug: log what claim_no values we received
    console.log(
        "[validateClaimNos] Validating",
        parsed.length,
        "rows. claim_no values:",
        parsed.map((r) => ({ excelRow: r.excelRow, claim_no: r.claim_no })),
    );

    // 1. Check every row has a non-empty claim_no
    for (const item of parsed) {
        const claimNo = String(item.claim_no || "").trim();
        if (!claimNo) {
            const issue = "Missing claim_no — every row must have a claim number";
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

    // 2. Check for duplicate claim_no within the file
    const fileMap = {};
    for (const item of parsed) {
        const claimNo = String(item.claim_no || "").trim();
        if (!claimNo) continue;
        if (!fileMap[claimNo]) fileMap[claimNo] = [];
        fileMap[claimNo].push(item);
    }
    for (const group of Object.values(fileMap)) {
        if (group.length > 1) {
            for (const item of group) {
                const issue = `Duplicate claim_no "${item.claim_no}" in uploaded file`;
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

    // 3. Check claim_no doesn't already exist in the database
    try {
        const claimResult = await backend.listPaginated("Claim", {
            limit: 9999,
        });
        const existingClaimNos = new Set(
            (claimResult?.data || []).map((c) => String(c.claim_no || "").trim()),
        );
        for (const item of parsed) {
            const claimNo = String(item.claim_no || "").trim();
            if (claimNo && existingClaimNos.has(claimNo)) {
                const issue = `claim_no "${claimNo}" already exists in the database`;
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
        console.warn("claim_no duplicate check failed:", err);
    }

    console.log("[validateClaimNos] Found", errors.length, "validation errors:", errors);
    return errors;
}
