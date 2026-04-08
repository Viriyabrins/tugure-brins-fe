import { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import { CLAIM_PAGE_SIZE } from "../utils/claimConstants";

/**
 * Manages all data-fetching for the Claims page.
 * Automatically reloads the claims list when `filters` or `page` changes.
 *
 * Usage:
 *   const { claims, batches, loading, error, claimPage, setClaimPage, totalClaims, loadAll } = useClaimData(filters);
 */
export function useClaimData(filters) {
    const [claims, setClaims] = useState([]);
    const [subrogations, setSubrogations] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [batches, setBatches] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [allClaimsForTrend, setAllClaimsForTrend] = useState([]);
    const [notas, setNotas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [claimPage, setClaimPage] = useState(1);
    const [totalClaims, setTotalClaims] = useState(0);

    async function loadClaims(page) {
        try {
            const result = await backend.listPaginated("Claim", {
                page,
                limit: CLAIM_PAGE_SIZE,
                q: JSON.stringify(filters),
            });
            setClaims(Array.isArray(result.data) ? result.data : []);
            setTotalClaims(Number(result.pagination?.total) || 0);
        } catch (err) {
            console.error("Failed to load claims:", err);
        }
    }

    async function loadAll() {
        setLoading(true);
        setError("");
        try {
            const [
                claimData,
                subrogationData,
                debtorData,
                batchData,
                contractData,
                allClaimData,
                notaData,
            ] = await Promise.all([
                backend.listPaginated("Claim", {
                    page: 1,
                    limit: CLAIM_PAGE_SIZE,
                    q: JSON.stringify(filters),
                }),
                backend.list("Subrogation"),
                backend.list("Debtor"),
                backend.list("Batch"),
                backend.list("Contract"),
                backend.list("Claim"),
                backend.list("Nota"),
            ]);

            const claimArr = claimData?.data || claimData;
            setClaims(Array.isArray(claimArr) ? claimArr : []);
            setTotalClaims(Number(claimData?.pagination?.total) || 0);
            setClaimPage(1);
            setSubrogations(
                Array.isArray(subrogationData) ? subrogationData : [],
            );
            setDebtors(Array.isArray(debtorData) ? debtorData : []);
            setBatches(Array.isArray(batchData) ? batchData : []);
            setContracts(Array.isArray(contractData) ? contractData : []);
            setAllClaimsForTrend(
                Array.isArray(allClaimData) ? allClaimData : [],
            );
            setNotas(Array.isArray(notaData) ? notaData : []);
        } catch (err) {
            console.error("Failed to load claim data:", err);
            setError("Failed to load data. Please refresh the page.");
            setClaims([]);
            setSubrogations([]);
            setDebtors([]);
            setBatches([]);
            setContracts([]);
            setNotas([]);
        } finally {
            setLoading(false);
        }
    }

    // Reset page to 1 when filters change
    useEffect(() => {
        setClaimPage(1);
    }, [
        filters.contract,
        filters.batch,
        filters.claimStatus,
        filters.subrogationStatus,
    ]);

    // Reload claims list when page or filters change
    useEffect(() => {
        loadClaims(claimPage);
    }, [
        claimPage,
        filters.contract,
        filters.batch,
        filters.claimStatus,
        filters.subrogationStatus,
    ]);

    return {
        claims,
        subrogations,
        debtors,
        batches,
        contracts,
        allClaimsForTrend,
        notas,
        loading,
        error,
        claimPage,
        setClaimPage,
        totalClaims,
        loadAll,
        loadClaims,
    };
}
