export function formatRupiah(value) {
    const num = Number(value) || 0;
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(num);
}

export function formatRupiahAdaptive(value, maxLength = 13) {
    const num = Number(value) || 0;
    const formatted = formatRupiah(num);
    if (formatted.length <= maxLength) return formatted;

    const abs = Math.abs(num);
    const units = [
        { value: 1e12, suffix: "T" }, // triliun
        { value: 1e9, suffix: "M" }, // miliar
        { value: 1e6, suffix: "jt" }, // juta
        { value: 1e3, suffix: "rb" }, // ribu
    ];

    for (const u of units) {
        if (abs >= u.value) {
            const n = abs / u.value;
            const shown = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
            const sign = num < 0 ? "-" : "";
            return `${sign}Rp ${shown} ${u.suffix}`;
        }
    }

    return formatted;
}

export default {
    formatRupiah,
    formatRupiahAdaptive,
};
