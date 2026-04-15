export const CLAIM_PAGE_SIZE = 10;

export const DEFAULT_CLAIM_FILTER = {
    contract: "all",
    batch: "all",
    claimStatus: "all",
};

export const normalizeRole = (role = "") => String(role).trim().toLowerCase();

export const canCheckClaim = (roles = []) =>
    (Array.isArray(roles) ? roles : []).map(normalizeRole).some((r) => r === "checker-tugure-role");

export const canApproveClaim = (roles = []) =>
    (Array.isArray(roles) ? roles : []).map(normalizeRole).some((r) => r === "approver-tugure-role");
