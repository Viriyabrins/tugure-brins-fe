import { useState, useEffect, useRef } from "react";
import { debtorReviewService } from "../services/debtorReviewService";
import { DEFAULT_DR_FILTER, DR_PAGE_SIZE, hasTugureActionRole, hasRole } from "../utils/debtorReviewConstants";

export function useDebtorReviewData() {
    const [user, setUser] = useState(null);
    const [tokenRoles, setTokenRoles] = useState([]);
    const [auditActor, setAuditActor] = useState(null);

    const [debtors, setDebtors] = useState([]);
    const [totalDebtors, setTotalDebtors] = useState(0);
    const [contracts, setContracts] = useState([]);

    const [pendingCount, setPendingCount] = useState(0);
    const [checkedTugureCount, setCheckedTugureCount] = useState(0);
    const [approvedCount, setApprovedCount] = useState(0);
    const [revisionCount, setRevisionCount] = useState(0);
    const [totalPlafond, setTotalPlafond] = useState(0);

    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(DEFAULT_DR_FILTER);
    const [page, setPage] = useState(1);
    const [sortColumn, setSortColumn] = useState(null);
    const [sortOrder, setSortOrder] = useState(null);

    const isFirstFilterEffect = useRef(true);
    const isFirstPageEffect = useRef(true);

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

    // Reset page and reload on filter change (skip initial mount)
    useEffect(() => {
        if (isFirstFilterEffect.current) { isFirstFilterEffect.current = false; return; }
        setPage(1);
        loadDebtors(1);
    }, [filters.contract, filters.batch, filters.startDate, filters.endDate, filters.submitStatus, filters.status]);

    // Reload when page or sort changes (skip initial mount)
    useEffect(() => {
        if (isFirstPageEffect.current) { isFirstPageEffect.current = false; return; }
        loadDebtors(page);
    }, [page, sortColumn, sortOrder]);

    async function loadUser() {
        try {
            const { default: keycloakService } = await import("@/services/keycloakService");
            const userInfo = keycloakService.getCurrentUserInfo();
            if (!userInfo) return;
            const roles = keycloakService.getRoles();
            const actor = keycloakService.getAuditActor();
            setAuditActor(actor);
            setTokenRoles(Array.isArray(roles) ? roles : []);
            const role = actor?.user_role || (Array.isArray(roles) && roles.length > 0 ? roles[0].trim().toLowerCase() : "user");
            setUser({ id: userInfo.id, email: userInfo.email, full_name: userInfo.name, role });
        } catch (e) {
            console.error("Failed to load user:", e);
        }
    }

    async function loadData() {
        setLoading(true);
        try {
            const [contractData] = await Promise.all([debtorReviewService.listContracts()]);
            setContracts(contractData);
            await Promise.all([loadDebtors(1), refreshStatusCounts()]);
        } catch (e) {
            console.error("loadData failed:", e);
            setDebtors([]);
            setContracts([]);
        } finally {
            setLoading(false);
        }
    }

    async function loadDebtors(pageToLoad = page) {
        setLoading(true);
        try {
            const result = await debtorReviewService.listDebtors(filters, pageToLoad, DR_PAGE_SIZE, sortColumn, sortOrder);
            setDebtors(result.data);
            setTotalDebtors(result.total);
        } catch (e) {
            console.error("loadDebtors failed:", e);
            setDebtors([]);
            setTotalDebtors(0);
        } finally {
            setLoading(false);
        }
    }

    async function refreshStatusCounts() {
        try {
            const counts = await debtorReviewService.loadStatusCounts();
            setPendingCount(counts.pending);
            setCheckedTugureCount(counts.checkedTugure);
            setApprovedCount(counts.approved);
            setRevisionCount(counts.revision);
            setTotalPlafond(counts.totalPlafond);
        } catch (e) {
            console.warn("refreshStatusCounts failed:", e);
        }
    }

    function handleSort(column, order) {
        setSortColumn(column);
        setSortOrder(order);
    }

    return {
        user, tokenRoles, auditActor,
        debtors, totalDebtors, contracts,
        pendingCount, checkedTugureCount, approvedCount, revisionCount, totalPlafond,
        loading, filters, setFilters,
        page, setPage, sortColumn, sortOrder, handleSort,
        loadData, loadDebtors,
        canManageDebtorActions: hasTugureActionRole(tokenRoles),
        isCheckerTugure: hasRole(tokenRoles, "checker-tugure-role"),
        isApproverTugure: hasRole(tokenRoles, "approver-tugure-role"),
    };
}
