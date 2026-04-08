import { backend } from "@/api/backendClient";

export const paymentIntentService = {
    async loadData() {
        const [notaData, intentData, contractData] = await Promise.all([
            backend.list("Nota"),
            backend.list("PaymentIntent"),
            backend.list("Contract"),
        ]);
        const allNotas = Array.isArray(notaData) ? notaData : [];
        return {
            notas: allNotas.filter((n) => n.status === "Issued" || n.status === "Confirmed"),
            paymentIntents: Array.isArray(intentData) ? intentData : [],
            contracts: Array.isArray(contractData) ? contractData : [],
        };
    },

    async createIntent({ nota, paymentType, plannedAmount, plannedDate, remarks, userEmail, userRole }) {
        if (nota.status !== "Issued" && nota.status !== "Confirmed") {
            await backend.create("AuditLog", { action: "BLOCKED_PAYMENT_INTENT", module: "PAYMENT", entity_type: "PaymentIntent", entity_id: nota.nota_number, old_value: "{}", new_value: JSON.stringify({ blocked_reason: `Current status: ${nota.status}` }), user_email: userEmail, user_role: userRole, reason: `Attempted to create Payment Intent before Nota Issued (current status: ${nota.status})` });
            return { blocked: true, status: nota.status };
        }

        const intentId = `PI-${nota.nota_number}-${Date.now()}`;
        const plannedDateISO = new Date(`${plannedDate}T00:00:00.000Z`).toISOString();

        await backend.create("PaymentIntent", { intent_id: intentId, invoice_id: nota.id || nota.nota_number, contract_id: nota.contract_id, payment_type: paymentType, planned_amount: parseFloat(plannedAmount), planned_date: plannedDateISO, remarks, status: "Issued" });
        await backend.create("Notification", { title: "Payment Intent Created (Planning Only)", message: `Payment Intent ${intentId} created for Nota ${nota.nota_number}. This is PLANNING ONLY - actual payment must be recorded in Reconciliation.`, type: "INFO", module: "PAYMENT", reference_id: intentId, target_role: "BRINS" });
        await backend.create("AuditLog", { action: "PAYMENT_INTENT_CREATED", module: "PAYMENT", entity_type: "PaymentIntent", entity_id: intentId, old_value: "{}", new_value: JSON.stringify({ planned_amount: parseFloat(plannedAmount), planned_date: plannedDateISO, note: "PLANNING ONLY" }), user_email: userEmail, user_role: userRole });

        return { blocked: false, intentId };
    },

    async submitIntent(intent) {
        const id = intent.intent_id || intent.id;
        await backend.update("PaymentIntent", id, { status: "SUBMITTED" });
        await backend.create("Notification", { title: "Payment Intent Submitted", message: `Payment Intent ${intent.intent_id} submitted for approval`, type: "ACTION_REQUIRED", module: "PAYMENT", reference_id: intent.intent_id, target_role: "TUGURE" });
    },

    async approveIntent(intent) {
        const id = intent.intent_id || intent.id;
        await backend.update("PaymentIntent", id, { status: "APPROVED" });
        await backend.create("Notification", { title: "Payment Intent Approved", message: `Payment Intent ${intent.intent_id} approved`, type: "INFO", module: "PAYMENT", reference_id: intent.intent_id, target_role: "BRINS" });
    },

    async rejectIntent(intent) {
        const id = intent.intent_id || intent.id;
        await backend.update("PaymentIntent", id, { status: "REJECTED" });
        await backend.create("Notification", { title: "Payment Intent Rejected", message: `Payment Intent ${intent.intent_id} rejected`, type: "WARNING", module: "PAYMENT", reference_id: intent.intent_id, target_role: "BRINS" });
    },
};
