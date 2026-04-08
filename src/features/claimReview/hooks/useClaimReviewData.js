import { useState, useEffect, useRef } from "react";
import { claimReviewService } from "../services/claimReviewService";
import { DEFAULT_CLAIM_FILTER, CLAIM_PAGE_SIZE, canCheckClaim, canApproveClaim, normalizeRole } from "../utils/claimReviewConstants";

export function useClaimReviewData() {
    const [user, setUser] = useState(null);
    const [tokenRoles, setTokenRoles] = useState([]);
    const [auditActor, setAuditActor] = useState(null);

    const [claims, setClaims] = useState([]);
    const [totalClaims, setTotalClaims] = useState(0);
    const [subrogations, setSubrogations] = useState([]);
    const [notas, setNotas] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [batches, setBatches] = useState([]);

    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(DEFAULT_CLAIM_FILTER);
    const [claimPage, setClaimPage] = useState(1);

    const isFirstMount = useRef(true);
    const prevFilters = useRef(filters);

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

    // Reset page on filter change; reload claims
    useEffect(() => {
        if (isFirstMount.current) { isFirstMount.current = false; return; }
        setClaimPage(1);
    }, [filters.contract, filters.batch, filters.claimStatus]);

    useEffect(() => {
        loadClaims(claimPage);
    }, [claimPage, filters.contract, filters.batch, filters.claimStatus]);

    async function loadUser() {
        try {
            const { default: keycloakService } = await import("@/services/keycloakService");
            const userInfo = keycloakService.getCurrentUserInfo();
            if (!userInfo) return;
            const roles = keycloakService.getRoles();
            const actor = keycloakService.getAuditActor();
            setAuditActor(actor);
            setTokenRoles(Array.isArray(roles) ? roles : []);
            const role = actor?.user_role || (Array.isArray(roles) && roles.length > 0 ? normalizeRole(roles[0]) : "user");
            setUser({ id: userInfo.id, email: userInfo.email, full_name: userInfo.name, role });
        } catch (e) { console.error("Failed to load user:", e); }
    }

    async function loadData() {
        setLoading(true);
        try {
            const [claimsResult, allData] = await Promise.all([
                claimReviewService.listClaimsPaginated(filters, 1, CLAIM_PAGE_SIZE),
                claimReviewService.listAll(),
            ]);
            setClaims(claimsResult.data);
            setTotalClaims(claimsResult.total);
            setClaimPage(1);
            setSubrogations(allData.subrogations);
            setNotas(allData.notas);
            setContracts(allData.contracts);
            setDebtors(allData.debtors);
            setBatches(allData.batches);
        } catch (e) {
            console.error("loadData failed:", e);
            setClaims([]); setSubrogations([]); setNotas([]); setContracts([]); setDebtors([]); setBatches([]);
        } finally {
            setLoading(false);
        }
    }

    async function loadClaims(pageToLoad = claimPage) {
        try {
            const result = await claimReviewService.listClaimsPaginated(filters, pageToLoad, CLAIM_PAGE_SIZE);
            setClaims(result.data);
            setTotalClaims(result.total);
        } catch (e) { console.error("loadClaims failed:", e); }
    }

    return {
        user, tokenRoles, auditActor,
        claims, totalClaims, subrogations, notas, contracts, debtors, batches,
        loading, filters, setFilters, claimPage, setClaimPage,
        loadData, loadClaims,
        canCheck: canCheckClaim(tokenRoles),
        canApprove: canApproveClaim(tokenRoles),
    };
}
