import { useState, useEffect } from "react";
import { DEFAULT_PAYMENT_INTENT_FILTER, canMakePaymentIntent } from "../utils/paymentIntentConstants";
import { paymentIntentService } from "../services/paymentIntentService";

export function usePaymentIntentData() {
    const [notas, setNotas] = useState([]);
    const [paymentIntents, setPaymentIntents] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userRoles, setUserRoles] = useState([]);
    const [userEmail, setUserEmail] = useState("");
    const [userRole, setUserRole] = useState("USER");
    const [filters, setFilters] = useState(DEFAULT_PAYMENT_INTENT_FILTER);
    const [selectedIntents, setSelectedIntents] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const { default: ks } = await import("@/services/keycloakService");
                const info = ks.getCurrentUserInfo();
                if (info) {
                    const roles = ks.getRoles();
                    const roleList = Array.isArray(roles) ? roles : [];
                    const norm = roleList.map((r) => String(r || "").trim().toLowerCase()).filter(Boolean);
                    setUserRoles(roleList);
                    setUserEmail(info.email);
                    let role = "USER";
                    if (norm.includes("admin")) role = "admin";
                    else if (norm.includes("approver-brins-role")) role = "approver";
                    else if (norm.includes("checker-brins-role")) role = "checker";
                    else if (norm.includes("maker-brins-role")) role = "maker";
                    setUserRole(role);
                }
            } catch {}
        })();
        reload();
    }, []);

    const reload = async () => {
        setLoading(true);
        try {
            const data = await paymentIntentService.loadData();
            setNotas(data.notas);
            setPaymentIntents(data.paymentIntents);
            setContracts(data.contracts);
        } catch {
            setNotas([]); setPaymentIntents([]); setContracts([]);
        }
        setLoading(false);
    };

    const filteredIntents = paymentIntents.filter((p) => {
        if (filters.contract !== "all" && p.contract_id !== filters.contract) return false;
        if (filters.status !== "all" && p.status !== filters.status) return false;
        if (filters.notaType !== "all") {
            const nota = notas.find((n) => n.id === p.invoice_id || n.nota_number === p.invoice_id);
            if (!nota || nota.nota_type !== filters.notaType) return false;
        }
        return true;
    });

    const toggleIntentSelection = (id) =>
        setSelectedIntents((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

    const toggleAllSelection = (checked) =>
        setSelectedIntents(checked ? filteredIntents.map((p) => p.intent_id || p.id) : []);

    return {
        notas, paymentIntents, contracts, loading,
        filters, setFilters,
        filteredIntents,
        selectedIntents, setSelectedIntents, toggleIntentSelection, toggleAllSelection,
        userRoles, userEmail, userRole,
        canShowActionButtons: canMakePaymentIntent(userRoles),
        reload,
    };
}
