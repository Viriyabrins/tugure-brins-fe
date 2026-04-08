import { useState, useEffect, useMemo } from "react";
import { DEFAULT_RECAP_FILTER, DEFAULT_TSI_FILTER } from "../utils/recapSummaryConstants";
import { recapSummaryService } from "../services/recapSummaryService";

export function useRecapSummaryData() {
    const [loading, setLoading] = useState(true);
    const [batches, setBatches] = useState([]);
    const [claims, setClaims] = useState([]);
    const [allDebtors, setAllDebtors] = useState([]);
    const [filters, setFilters] = useState(DEFAULT_RECAP_FILTER);
    const [tsiFilters, setTsiFilters] = useState(DEFAULT_TSI_FILTER);

    useEffect(() => { reload(); }, []);

    const reload = async () => {
        setLoading(true);
        try {
            const data = await recapSummaryService.loadData();
            setBatches(data.batches); setClaims(data.claims); setAllDebtors(data.debtors);
        } catch { setBatches([]); setClaims([]); setAllDebtors([]); }
        setLoading(false);
    };

    const recapRows = useMemo(() =>
        batches.map((b) => {
            const batchClaims = claims.filter((c) => c.batch_id === b.batch_id);
            const premium = parseFloat(b.total_premium) || 0;
            const comm = parseFloat(b.commission) || 0;
            return { id: b.batch_id, batch_id: b.batch_id, batch_month: b.batch_month, batch_year: b.batch_year, total_debtors: b.total_records || 0, premium_idr: premium, comm_idr: comm, total_idr: premium - comm, total_claim: batchClaims.length, claim_idr: batchClaims.reduce((s, c) => s + (parseFloat(c.share_tugure_amount) || 0), 0) };
        }),
        [batches, claims],
    );

    const tsiYearOptions = useMemo(() => {
        const years = new Set();
        for (const d of allDebtors) if (d.tanggal_akhir_covering) years.add(new Date(d.tanggal_akhir_covering).getFullYear());
        return [...years].sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) }));
    }, [allDebtors]);

    const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

    const yearFilteredDebtors = useMemo(() => {
        if (tsiFilters.year === "all") return allDebtors;
        const yr = Number(tsiFilters.year);
        return allDebtors.filter((d) => d.tanggal_akhir_covering && new Date(d.tanggal_akhir_covering).getFullYear() === yr);
    }, [allDebtors, tsiFilters.year]);

    const activeDebtors = useMemo(() => yearFilteredDebtors.filter((d) => d.tanggal_akhir_covering && new Date(d.tanggal_akhir_covering) >= today), [yearFilteredDebtors, today]);
    const nonActiveDebtors = useMemo(() => yearFilteredDebtors.filter((d) => !d.tanggal_akhir_covering || new Date(d.tanggal_akhir_covering) < today), [yearFilteredDebtors, today]);

    const filteredRows = useMemo(() =>
        recapRows.filter((row) => {
            if (filters.month !== "all" && String(row.batch_month) !== String(filters.month)) return false;
            if (filters.batchId && !row.batch_id.toLowerCase().includes(filters.batchId.toLowerCase())) return false;
            return true;
        }),
        [recapRows, filters],
    );

    const grandTotal = useMemo(() => ({
        total_debtors: filteredRows.reduce((s, r) => s + r.total_debtors, 0),
        premium_idr: filteredRows.reduce((s, r) => s + r.premium_idr, 0),
        comm_idr: filteredRows.reduce((s, r) => s + r.comm_idr, 0),
        total_idr: filteredRows.reduce((s, r) => s + r.total_idr, 0),
        total_claim: filteredRows.reduce((s, r) => s + r.total_claim, 0),
        claim_idr: filteredRows.reduce((s, r) => s + r.claim_idr, 0),
    }), [filteredRows]);

    return {
        loading, filters, setFilters, tsiFilters, setTsiFilters,
        filteredRows, grandTotal, tsiYearOptions,
        yearFilteredDebtors, activeDebtors, nonActiveDebtors,
        reload,
    };
}
