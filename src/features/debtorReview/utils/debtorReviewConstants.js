export const DR_PAGE_SIZE = 10;

export const DEFAULT_DR_FILTER = {
    contract: "all",
    batch: "",
    submitStatus: "all",
    status: "all",
    startDate: "",
    endDate: "",
};

export const normalizeRole = (role = "") => String(role).trim().toLowerCase();

export const TUGURE_ACTION_ROLES = ["checker-tugure-role", "approver-tugure-role"];
export const BRINS_ACTION_ROLES = ["maker-brins-role", "checker-brins-role", "approver-brins-role"];
export const ALL_ROLES = [
    "maker-brins-role", "checker-brins-role", "approver-brins-role",
    "checker-tugure-role", "approver-tugure-role",
];

export const hasTugureActionRole = (roles = []) =>
    (Array.isArray(roles) ? roles : []).map(normalizeRole).some((r) => TUGURE_ACTION_ROLES.includes(r));

export const hasRole = (roles = [], targetRole) =>
    (Array.isArray(roles) ? roles : []).map(normalizeRole).includes(targetRole);
