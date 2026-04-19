export const NOTA_PAGE_SIZE = 10;

export const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const nearlyEqual = (a, b) => Math.abs(a - b) < 0.0001;

/** Pure function — note: original had closure bug referencing outer `debtors` */
export function getNotaAmount(nota, debtors = []) {
    try {
        if (!nota) return 0;
        if (nota.nota_type === "Batch" && nota.reference_id) {
            return debtors
                .filter((d) => d.batch_id === nota.reference_id)
                .reduce((s, d) => s + toNumber(d.net_premi), 0);
        }
        return toNumber(nota.amount);
    } catch {
        return toNumber(nota.amount);
    }
}

export const DEFAULT_NOTA_FILTER = { contract: "all", notaType: "Batch", status: "all" };
export const DEFAULT_RECON_FILTER = { contract: "all", status: "all", hasException: "all" };
export const DEFAULT_DNCN_FILTER = { contract: "all", noteType: "all", status: "all" };

export const normalizeRole = (role = "") => String(role).trim().toLowerCase();
export const BRINS_ACTION_ROLES = ["maker-brins-role", "checker-brins-role", "approver-brins-role"];
export const isBrinsRole = (roles = []) =>
    (Array.isArray(roles) ? roles : [])
        .map(normalizeRole)
        .some((r) => BRINS_ACTION_ROLES.includes(r));

export const normalizeNotaStatus = (status) => {
    if (!status) return "UNPAID";
    const statusMap = { UNPAID: "UNPAID", PAID: "PAID" };
    return statusMap[status] || status;
};

export const getNextStatus = (currentStatus) => {
    const norm = normalizeNotaStatus(currentStatus);
    const workflow = ["UNPAID", "PAID"];
    const idx = workflow.indexOf(norm);
    return idx >= 0 && idx < workflow.length - 1 ? workflow[idx + 1] : null;
};
