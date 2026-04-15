import { useState, useEffect, useRef } from "react";
import { debtorService } from "../services/debtorService";
import { DEFAULT_DEBTOR_FILTER, DEBTOR_PAGE_SIZE } from "../utils/debtorConstants";

export function useDebtorData() {
    const [user, setUser] = useState(null);
    const [auditActor, setAuditActor] = useState(null);
    const [userRoles, setUserRoles] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [totalDebtors, setTotalDebtors] = useState(0);
    const [pageLoading, setPageLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [filters, setFilters] = useState(DEFAULT_DEBTOR_FILTER);
    const [page, setPage] = useState(1);
    const [sortColumn, setSortColumn] = useState(null);
    const [sortOrder, setSortOrder] = useState(null);
    const [error, setError] = useState("");

    const isFirstPageEffect = useRef(true);

    const canShowActionButtons = userRoles.some(
        (r) => String(r || "").trim().toLowerCase() === "maker-brins-role",
    );
    const isCheckerBrins = userRoles.some(
        (r) => String(r || "").trim().toLowerCase() === "checker-brins-role",
    );
    const isApproverBrins = userRoles.some(
        (r) => String(r || "").trim().toLowerCase() === "approver-brins-role",
    );
    const activeContracts = contracts.filter(
        (c) => c.status === "Active" || c.effective_status === "APPROVED",
    );

    async function loadUser() {
        try {
            const { default: keycloakService } = await import("@/services/keycloakService");
            const info = keycloakService.getCurrentUserInfo();
            if (info) {
                const roles = keycloakService.getRoles();
                const roleList = Array.isArray(roles) ? roles : [];
                const normalized = roleList.map((r) => String(r || "").trim().toLowerCase()).filter(Boolean);
                const actor = keycloakService.getAuditActor();
                setUserRoles(roleList);
                setAuditActor(actor || null);
                let role = "USER";
                if (normalized.includes("admin")) role = "admin";
                else if (normalized.includes("approver-brins-role")) role = "approver";
                else if (normalized.includes("checker-brins-role")) role = "checker";
                else if (normalized.includes("maker-brins-role")) role = "maker";
                setUser({ id: info.id, email: info.email, full_name: info.name, role });
            }
        } catch (e) {
            console.error("Failed to load user:", e);
        }
    }

    async function loadInitialData() {
        setPageLoading(true);
        setError("");
        try {
            const [contractsData, batchesData] = await Promise.all([
                debtorService.listContracts(),
                debtorService.listBatches(),
            ]);
            setContracts(Array.isArray(contractsData) ? contractsData : []);
            setBatches(Array.isArray(batchesData) ? batchesData : []);
        } catch (e) {
            console.error("Failed to load initial data:", e);
            setError("Failed to load data. Please refresh the page.");
        } finally {
            setPageLoading(false);
        }
    }

    async function loadDebtors(pageToLoad = page, activeFilters = filters) {
        setTableLoading(true);
        try {
            const result = await debtorService.listPaginated(
                activeFilters,
                pageToLoad,
                DEBTOR_PAGE_SIZE,
                sortColumn,
                sortOrder,
            );
            setDebtors(Array.isArray(result.data) ? result.data : []);
            setTotalDebtors(Number(result.pagination?.total) || 0);
        } catch (e) {
            console.error("Error loading debtors:", e);
            setDebtors([]);
            setTotalDebtors(0);
        } finally {
            setTableLoading(false);
        }
    }

    function handleSort(column, order) {
        setSortColumn(column);
        setSortOrder(order);
    }

    useEffect(() => {
        loadUser();
        loadInitialData();
    }, []);

    useEffect(() => {
        const total = totalDebtors;
        const totalPages = Math.max(1, Math.ceil(total / DEBTOR_PAGE_SIZE));
        if (page > totalPages) setPage(totalPages);
    }, [totalDebtors]);

    useEffect(() => {
        if (page !== 1) {
            setPage(1);
            return;
        }
        loadDebtors(1, filters);
    }, [filters.contract, filters.batch, filters.submitStatus, filters.name]);

    useEffect(() => {
        if (isFirstPageEffect.current) {
            isFirstPageEffect.current = false;
            return;
        }
        loadDebtors(page, filters);
    }, [page, sortColumn, sortOrder]);

    return {
        user, auditActor, userRoles,
        contracts, batches, debtors, totalDebtors,
        pageLoading, tableLoading,
        filters, setFilters,
        page, setPage,
        sortColumn, sortOrder, handleSort,
        error, setError,
        loadDebtors, loadInitialData,
        canShowActionButtons, isCheckerBrins, isApproverBrins, activeContracts,
    };
}
