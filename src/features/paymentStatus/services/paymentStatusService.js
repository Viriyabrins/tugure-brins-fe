import { backend } from "@/api/backendClient";

export async function loadData() {
    const [invoiceData, paymentData, contractData] = await Promise.all([
        backend.list("Invoice"),
        backend.list("Payment"),
        backend.list("Contract"),
    ]);
    return {
        invoices: invoiceData || [],
        payments: paymentData || [],
        contracts: contractData || [],
    };
}
