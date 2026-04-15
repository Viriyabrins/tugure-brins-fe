import { useState, useEffect } from "react";
import keycloakService from "@/services/keycloakService";
import { DEFAULT_DOC_CLAIM_FILTER } from "../utils/documentClaimConstants";
import { documentClaimService } from "../services/documentClaimService";

export function useDocumentClaimData() {
    const [batches, setBatches] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState("");
    const [filters, setFilters] = useState(DEFAULT_DOC_CLAIM_FILTER);

    useEffect(() => {
        try {
            const info = keycloakService.getCurrentUserInfo();
            if (info) setUserEmail(info.email);
        } catch {}
        reload();
    }, []);

    const reload = async () => {
        setLoading(true);
        try {
            const data = await documentClaimService.loadData();
            setBatches(data.batches);
            setDocuments(data.documents);
            setContracts(data.contracts);
        } catch {
            setBatches([]); setDocuments([]); setContracts([]);
        }
        setLoading(false);
    };

    const getBatchDocuments = (batchId) => documents.filter((d) => d.batch_id === batchId);

    const filteredBatches = batches.filter((b) => {
        if (filters.contract !== "all" && b.contract_id !== filters.contract) return false;
        if (filters.batch && !b.batch_id.includes(filters.batch)) return false;
        if (filters.startDate && b.created_date < filters.startDate) return false;
        if (filters.endDate && b.created_date > filters.endDate) return false;
        const batchDocs = getBatchDocuments(b.batch_id);
        if (filters.status !== "all" && !batchDocs.some((d) => d.status === filters.status)) return false;
        if (filters.version !== "all" && !batchDocs.some((d) => d.version === parseInt(filters.version))) return false;
        return true;
    });

    return { batches, documents, contracts, loading, filters, setFilters, filteredBatches, getBatchDocuments, userEmail, reload };
}
