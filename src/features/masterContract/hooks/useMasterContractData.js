import { useState, useEffect, useRef } from "react";
import { DEFAULT_MC_FILTER, MC_PAGE_SIZE, hasBrinsUploadRole, normalizeRoleStr } from "../utils/masterContractConstants";
import { masterContractService } from "../services/masterContractService";

export function useMasterContractData() {
    const [user, setUser] = useState(null);
    const [tokenRoles, setTokenRoles] = useState([]);
    const [auditActor, setAuditActor] = useState(null);
    const [contracts, setContracts] = useState([]);
    const [total, setTotal] = useState(0);
    const [statsContracts, setStatsContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(DEFAULT_MC_FILTER);
    const [page, setPage] = useState(1);

    const isFirstPageEffect = useRef(true);

    useEffect(() => {
        (async () => {
            try {
                const { default: keycloakService } = await import("@/services/keycloakService");
                const userInfo = keycloakService.getCurrentUserInfo();
                if (userInfo) {
                    const roles = keycloakService.getRoles();
                    const actor = keycloakService.getAuditActor();
                    setAuditActor(actor);
                    setTokenRoles(Array.isArray(roles) ? roles : []);
                    const role = actor?.user_role || (Array.isArray(roles) && roles.length > 0 ? normalizeRoleStr(roles[0]) : "user");
                    setUser({ id: userInfo.id, email: userInfo.email, full_name: userInfo.name, role });
                }
            } catch (e) {
                console.error("Failed to load user:", e);
            }
        })();
        loadStats();
        loadContracts(1, filters);
    }, []);

    // Reset page on filter change
    useEffect(() => {
        if (page !== 1) { setPage(1); return; }
        loadContracts(1, filters);
    }, [filters.status, filters.contractId, filters.productType, filters.creditType, filters.startDate, filters.endDate]);

    // Reload on page change
    useEffect(() => {
        if (isFirstPageEffect.current) { isFirstPageEffect.current = false; return; }
        loadContracts(page, filters);
    }, [page]);

    const loadContracts = async (pageToLoad = page, activeFilters = filters) => {
        setLoading(true);
        try {
            const result = await masterContractService.loadContracts(activeFilters, pageToLoad, MC_PAGE_SIZE);
            setContracts(result.data);
            setTotal(result.total);
        } catch (e) {
            console.error("Failed to load contracts:", e);
            setContracts([]);
            setTotal(0);
        }
        setLoading(false);
    };

    const loadStats = async () => {
        const stats = await masterContractService.loadStats();
        setStatsContracts(stats);
    };

    const reload = () => { loadContracts(page, filters); loadStats(); };

    const normalizedRoles = (Array.isArray(tokenRoles) ? tokenRoles : []).map(normalizeRoleStr);

    return {
        user, tokenRoles, auditActor,
        contracts, total, statsContracts, loading,
        filters, setFilters, page, setPage,
        loadContracts, loadStats, reload,
        canManageUploadTemplate: hasBrinsUploadRole(tokenRoles),
        isCheckerBrins: normalizedRoles.includes("checker-brins-role"),
        isApproverBrins: normalizedRoles.includes("approver-brins-role"),
        isCheckerTugure: normalizedRoles.includes("checker-tugure-role"),
        isApproverTugure: normalizedRoles.includes("approver-tugure-role"),
    };
}
