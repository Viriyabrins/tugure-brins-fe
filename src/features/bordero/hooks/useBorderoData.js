import { useState, useEffect, useRef } from "react";
import { borderoService } from "../services/borderoService";
import { BORDERO_PAGE_SIZE, DEFAULT_BORDERO_FILTER } from "../utils/borderoConstants";

const mkPagination = (page, total, pageSize) => ({
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    from: total === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(total, page * pageSize),
});

export function useBorderoData(filters) {
    const [loading, setLoading] = useState(true);
    const [debtors, setDebtors] = useState([]);
    const [totalDebtors, setTotalDebtors] = useState(0);
    const [borderos, setBorderos] = useState([]);
    const [totalBorderos, setTotalBorderos] = useState(0);
    const [claims, setClaims] = useState([]);
    const [totalClaims, setTotalClaims] = useState(0);
    const [subrogations, setSubrogations] = useState([]);
    const [borderoDebtors, setBorderoDebtors] = useState([]);
    const [totalBorderoDebtors, setTotalBorderoDebtors] = useState(0);
    const [borderoDebtorsLoading, setBorderoDebtorsLoading] = useState(false);

    const [debtorPage, setDebtorPage] = useState(1);
    const [borderoPage, setBorderoPage] = useState(1);
    const [claimPage, setClaimPage] = useState(1);
    const [borderoDebtorsPage, setBorderoDebtorsPage] = useState(1);

    const isFirstDebtorPage = useRef(true);
    const isFirstBorderoPage = useRef(true);
    const isFirstClaimPage = useRef(true);
    const isFirstBorderoDebtorsPage = useRef(true);

    const loadDebtors = async (page, f) => {
        setLoading(true);
        try {
            const r = await borderoService.loadDebtors(page, f);
            setDebtors(r.data); setTotalDebtors(r.total);
        } catch (e) { console.error(e); setDebtors([]); setTotalDebtors(0); }
        setLoading(false);
    };

    const loadBorderos = async (page, f) => {
        try {
            const r = await borderoService.loadBorderos(page, f);
            setBorderos(r.data); setTotalBorderos(r.total);
        } catch (e) { console.error(e); setBorderos([]); setTotalBorderos(0); }
    };

    const loadClaims = async (page, f) => {
        try {
            const r = await borderoService.loadClaims(page, f);
            setClaims(r.data); setTotalClaims(r.total);
        } catch (e) { console.error(e); setClaims([]); setTotalClaims(0); }
    };

    const loadSubrogations = async () => {
        try { setSubrogations(await borderoService.loadSubrogations()); } catch (e) { setSubrogations([]); }
    };

    const loadBorderoDebtors = async (borderoId, page) => {
        setBorderoDebtorsLoading(true);
        try {
            const r = await borderoService.loadBorderoDebtors(borderoId, page);
            setBorderoDebtors(r.data); setTotalBorderoDebtors(r.total);
        } catch (e) { setBorderoDebtors([]); setTotalBorderoDebtors(0); }
        setBorderoDebtorsLoading(false);
    };

    const reloadAll = () => {
        loadDebtors(debtorPage, filters);
        loadBorderos(borderoPage, filters);
        loadClaims(claimPage, filters);
        loadSubrogations();
    };

    useEffect(() => { reloadAll(); }, []);

    // Debtor filter effect
    useEffect(() => {
        if (debtorPage !== 1) { setDebtorPage(1); return; }
        loadDebtors(1, filters);
    }, [filters.contract, filters.batch, filters.branch_desc, filters.region_desc, filters.submitStatus, filters.startDate, filters.endDate]);

    useEffect(() => {
        if (isFirstDebtorPage.current) { isFirstDebtorPage.current = false; return; }
        loadDebtors(debtorPage, filters);
    }, [debtorPage]);

    // Bordero filter effect
    useEffect(() => {
        if (borderoPage !== 1) { setBorderoPage(1); return; }
        loadBorderos(1, filters);
    }, [filters.period]);

    useEffect(() => {
        if (isFirstBorderoPage.current) { isFirstBorderoPage.current = false; return; }
        loadBorderos(borderoPage, filters);
    }, [borderoPage]);

    // Claim filter effect
    useEffect(() => {
        if (claimPage !== 1) { setClaimPage(1); return; }
        loadClaims(1, filters);
    }, [filters.claimStatus, filters.startDate, filters.endDate]);

    useEffect(() => {
        if (isFirstClaimPage.current) { isFirstClaimPage.current = false; return; }
        loadClaims(claimPage, filters);
    }, [claimPage]);

    useEffect(() => {
        if (isFirstBorderoDebtorsPage.current) { isFirstBorderoDebtorsPage.current = false; return; }
    }, [borderoDebtorsPage]);

    const filteredSubrogations = subrogations.filter((s) => {
        if (filters.subrogationStatus !== "all" && s.status !== filters.subrogationStatus) return false;
        if (filters.startDate && s.created_date < filters.startDate) return false;
        if (filters.endDate && s.created_date > filters.endDate) return false;
        return true;
    });

    return {
        loading,
        debtors, totalDebtors, debtorPage, setDebtorPage,
        borderos, totalBorderos, borderoPage, setBorderoPage,
        claims, totalClaims, claimPage, setClaimPage,
        subrogations, filteredSubrogations,
        borderoDebtors, totalBorderoDebtors, borderoDebtorsPage, setBorderoDebtorsPage, borderoDebtorsLoading,
        loadBorderos, loadBorderoDebtors, loadDebtors, reloadAll,
        debtorPagination: mkPagination(debtorPage, totalDebtors, BORDERO_PAGE_SIZE),
        borderoPagination: mkPagination(borderoPage, totalBorderos, BORDERO_PAGE_SIZE),
        claimPagination: mkPagination(claimPage, totalClaims, BORDERO_PAGE_SIZE),
        borderoDebtorsPagination: mkPagination(borderoDebtorsPage, totalBorderoDebtors, BORDERO_PAGE_SIZE),
    };
}
