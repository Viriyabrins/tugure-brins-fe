export const CLAIM_PAGE_SIZE = 10;

export const DEFAULT_CLAIM_FILTER = {
    contract: "all",
    batch: "all",
    claimStatus: "all",
};

export const normalizeRole = (role = "") => String(role).trim().toLowerCase();

export const canCheckBrinsClaim = (roles = []) =>
    (Array.isArray(roles) ? roles : []).map(normalizeRole).some((r) => r === "checker-brins-role");

export const canApproveBrinsClaim = (roles = []) =>
    (Array.isArray(roles) ? roles : []).map(normalizeRole).some((r) => r === "approver-brins-role");

export const canCheckTugureClaim = (roles = []) =>
    (Array.isArray(roles) ? roles : []).map(normalizeRole).some((r) => r === "checker-tugure-role");

export const canApproveTugureClaim = (roles = []) =>
    (Array.isArray(roles) ? roles : []).map(normalizeRole).some((r) => r === "approver-tugure-role");

// Legacy aliases kept for backwards compat
export const canCheckClaim = canCheckTugureClaim;
export const canApproveClaim = canApproveTugureClaim;
