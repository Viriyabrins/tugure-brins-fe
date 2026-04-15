export const DEFAULT_AUDIT_FILTER = {
    module: "all",
    user: "",
    action: "",
};

export const AUDIT_MODULES = [
    { value: "all", label: "All Modules" },
    { value: "AUTH", label: "Authentication" },
    { value: "DEBTOR", label: "Debtor" },
    { value: "BORDERO", label: "Bordero" },
    { value: "PAYMENT", label: "Payment" },
    { value: "RECONCILIATION", label: "Reconciliation" },
    { value: "CLAIM", label: "Claim" },
    { value: "CONFIG", label: "Configuration" },
];

export function getActionColor(action) {
    if (action?.includes("CREATE") || action?.includes("SUBMIT"))
        return "bg-blue-100 text-blue-700 border-blue-200";
    if (action?.includes("APPROVE") || action?.includes("SUCCESS"))
        return "bg-green-100 text-green-700 border-green-200";
    if (action?.includes("DEBTOR_REVISION"))
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
    if (action?.includes("REJECT") || action?.includes("DELETE"))
        return "bg-red-100 text-red-700 border-red-200";
    if (action?.includes("UPDATE") || action?.includes("MATCH"))
        return "bg-orange-100 text-orange-700 border-orange-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
}
