export const MONTHS = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
];

export const DEFAULT_RECAP_FILTER = { month: "all", batchId: "" };
export const DEFAULT_TSI_FILTER = { year: "all" };

export function aggregateDebtorsByBatch(debtors = []) {
    const map = {};
    for (const d of debtors) {
        const bid = d.batch_id || "Unknown";
        if (!map[bid]) map[bid] = { batch_id: bid, count: 0, plafon: 0, nominal_premi: 0, net_premi: 0, komisi: 0, nominal_komisi_broker: 0 };
        map[bid].count += 1;
        map[bid].plafon += parseFloat(d.plafon) || 0;
        map[bid].nominal_premi += parseFloat(d.nominal_premi) || 0;
        map[bid].net_premi += parseFloat(d.net_premi) || 0;
        map[bid].komisi += parseFloat(d.ric_amount) || 0;
        map[bid].nominal_komisi_broker += parseFloat(d.bf_amount) || 0;
    }
    return Object.values(map);
}
