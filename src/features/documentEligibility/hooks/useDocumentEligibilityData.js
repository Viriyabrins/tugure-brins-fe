import { useState, useEffect } from "react";
import keycloakService from "@/services/keycloakService";
import { DEFAULT_DOC_ELIGIBILITY_FILTER } from "../utils/documentEligibilityConstants";
import { documentEligibilityService } from "../services/documentEligibilityService";

export function useDocumentEligibilityData() {
    const [batches, setBatches] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState("");
    const [filters, setFilters] = useState(DEFAULT_DOC_ELIGIBILITY_FILTER);
    const [selectedDocs, setSelectedDocs] = useState([]);

    useEffect(() => {
        try { const info = keycloakService.getCurrentUserInfo(); if (info) setUserEmail(info.email); } catch {}
        reload();
    }, []);

    const reload = async () => {
        setLoading(true);
        try {
            const data = await documentEligibilityService.loadData();
            setBatches(data.batches); setDebtors(data.debtors); setDocuments(data.documents); setContracts(data.contracts);
        } catch { setBatches([]); setDebtors([]); setDocuments([]); setContracts([]); }
        setLoading(false);
    };

    const getBatchDocuments = (batchId) => documents.filter((d) => d.batch_id === batchId);

    const filteredBatches = batches.filter((b) => {
        if (filters.contract !== "all" && b.contract_id !== filters.contract) return false;
        if (filters.batch && !b.batch_id.toLowerCase().includes(filters.batch.toLowerCase())) return false;
        if (filters.batchStatus !== "all" && b.status !== filters.batchStatus) return false;
        if (filters.startDate && b.created_date < filters.startDate) return false;
        if (filters.endDate && b.created_date > filters.endDate) return false;
        const batchDocs = getBatchDocuments(b.batch_id);
        if (filters.docStatus !== "all") {
            if (batchDocs.length === 0) return false;
            if (!batchDocs.some((d) => d.status === filters.docStatus)) return false;
        }
        if (filters.version !== "all" && !batchDocs.some((d) => d.version === parseInt(filters.version))) return false;
        return true;
    });

    const toggleDocSelection = (docId) =>
        setSelectedDocs((prev) => prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]);

    return { batches, debtors, documents, contracts, loading, filters, setFilters, filteredBatches, getBatchDocuments, selectedDocs, setSelectedDocs, toggleDocSelection, userEmail, reload };
}
