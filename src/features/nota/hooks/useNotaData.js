import { useState, useEffect, useRef, useMemo } from "react";
import { notaService } from "../services/notaService";
import {
    NOTA_PAGE_SIZE,
    DEFAULT_NOTA_FILTER,
    toNumber, nearlyEqual,
    isBrinsRole, normalizeRole,
} from "../utils/notaConstants";

export function useNotaData() {
    const [user, setUser] = useState(null);
    const [tokenRoles, setTokenRoles] = useState([]);
    const [auditActor, setAuditActor] = useState(null);

    const [notas, setNotas] = useState([]);
    const [totalNotas, setTotalNotas] = useState(0);
    const [notaPage, setNotaPage] = useState(1);
    const [batches, setBatches] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [payments, setPayments] = useState([]);
    const [paymentIntents, setPaymentIntents] = useState([]);
    const [dnCnRecords, setDnCnRecords] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [subrogations, setSubrogations] = useState([]);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState(DEFAULT_NOTA_FILTER);

    const isFirstNotaPageEffect = useRef(true);

    const canManageNotaActions = isBrinsRole(tokenRoles);

    async function loadUser() {
        try {
            const { default: keycloakService } = await import("@/services/keycloakService");
            const userInfo = keycloakService.getCurrentUserInfo();
            if (userInfo) {
                const roles = keycloakService.getRoles();
                const actor = keycloakService.getAuditActor();
                setAuditActor(actor);
                const rolesArray = Array.isArray(roles) ? roles : typeof roles === "string" ? [roles] : [];
                setTokenRoles(rolesArray);
                const role = actor?.user_role || (rolesArray.length > 0 ? normalizeRole(rolesArray[0]) : "user");
                setUser({ id: userInfo.id, email: userInfo.email, full_name: userInfo.name, role });
            }
        } catch (e) {
            console.error("Failed to load user:", e);
        }
    }

    async function loadNotas(pageToLoad = notaPage, activeFilters = filters) {
        try {
            const result = await notaService.listNotasPaginated(pageToLoad, NOTA_PAGE_SIZE, activeFilters);
            const data = Array.isArray(result.data) ? result.data : [];
            setNotas(data);
            setTotalNotas(Number(result.pagination?.total) || 0);
            return data;
        } catch (e) {
            console.error("Error loading notas:", e);
            setNotas([]);
            setTotalNotas(0);
            return [];
        }
    }

    async function loadData() {
        setLoading(true);
        try {
            const [notaData, rest] = await Promise.all([
                loadNotas(1, filters),
                notaService.listAll(),
            ]);

            const { batches: rawBatches, contracts: c, payments: p, paymentIntents: pi, dnCnRecords: dn, debtors: deb, subrogations: sub } = rest;

            // Batch review sync: compute final amounts from approved debtors
            const updatedBatches = rawBatches.map((batch) => {
                const batchDebtors = deb.filter((d) => d.batch_id === batch.batch_id);
                if (!batchDebtors.length) return batch;

                const approved = batchDebtors.filter((d) => (d.status || "").toUpperCase() === "APPROVED");
                const allApproved = batchDebtors.length > 0 && approved.length === batchDebtors.length;
                const finalExposure = approved.reduce((s, d) => s + toNumber(d.plafon), 0);
                const finalPremium = approved.reduce((s, d) => s + toNumber(d.net_premi), 0);

                return {
                    ...batch,
                    debtor_review_completed: allApproved,
                    batch_ready_for_nota: allApproved,
                    final_exposure_amount: finalExposure,
                    final_premium_amount: finalPremium,
                };
            });

            setNotas(notaData);
            setBatches(updatedBatches);
            setContracts(c);
            setPayments(p);
            setPaymentIntents(pi);
            setDnCnRecords(dn);
            setDebtors(deb);
            setSubrogations(sub);
        } catch (e) {
            console.error("Failed to load data:", e);
            setNotas([]); setTotalNotas(0); setBatches([]); setContracts([]);
            setPayments([]); setPaymentIntents([]); setDnCnRecords([]); setDebtors([]);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

    useEffect(() => {
        if (isFirstNotaPageEffect.current) {
            isFirstNotaPageEffect.current = false;
            return;
        }
        loadNotas(notaPage, filters);
    }, [notaPage]);

    // Reconciliation items (derived)
    const reconciliationItems = useMemo(() => notas.map((nota) => {
        const relatedPayments = payments.filter(
            (p) => (p.invoice_id === nota.id || p.invoice_id === nota.nota_number) && p.is_actual_payment,
        );
        const paymentReceived = relatedPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const totalActualPaid = nota.total_actual_paid !== undefined && nota.total_actual_paid !== null
            ? nota.total_actual_paid
            : paymentReceived;
        const difference = (nota.amount || 0) - (totalActualPaid || 0);
        const relatedIntents = paymentIntents.filter((pi) => pi.invoice_id === nota.id || pi.invoice_id === nota.nota_number);
        const totalPlanned = relatedIntents.reduce((s, pi) => s + (pi.planned_amount || 0), 0);
        return {
            ...nota,
            total_actual_paid: totalActualPaid,
            payment_received: paymentReceived,
            total_planned: totalPlanned,
            difference,
            has_exception: Math.abs(difference) > 1000 && nota.status !== "PAID",
            payment_count: relatedPayments.length,
            intent_count: relatedIntents.length,
        };
    }), [notas, payments, paymentIntents]);

    // Exception items (derived)
    const exceptionItems = useMemo(() => reconciliationItems.filter((r) => {
        const diff = r.difference || 0;
        const recon = (r.reconciliation_status || "").toUpperCase();
        return diff > 0 && recon !== "MATCHED";
    }), [reconciliationItems]);

    return {
        user, tokenRoles, auditActor,
        notas, totalNotas, notaPage, setNotaPage,
        batches, contracts, payments, paymentIntents, dnCnRecords, debtors, subrogations,
        loading, filters, setFilters,
        canManageNotaActions,
        reconciliationItems, exceptionItems,
        loadData, loadNotas,
    };
}
