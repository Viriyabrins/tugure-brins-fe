export const PAYMENT_STATUS_OPTIONS = [
    { value: "all", label: "All Status" },
    { value: "ISSUED", label: "Issued" },
    { value: "PARTIALLY_PAID", label: "Partially Paid" },
    { value: "PAID", label: "Paid" },
    { value: "OVERDUE", label: "Overdue" },
];

export function formatCurrency(value) {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    return value.toLocaleString();
}
