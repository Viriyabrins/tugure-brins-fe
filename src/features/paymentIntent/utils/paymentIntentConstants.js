export const DEFAULT_PAYMENT_INTENT_FILTER = {
    contract: "all",
    notaType: "all",
    status: "all",
};

export const PAYMENT_TYPES = ["FULL", "PARTIAL", "INSTALMENT"];

export const PAYMENT_INTENT_STATUSES = ["Issued", "SUBMITTED", "APPROVED", "REJECTED"];

export const PAYMENT_INTENT_MAKER_ROLES = ["maker-brins-role", "checker-brins-role"];

export const canMakePaymentIntent = (roles = []) =>
    roles.some((r) => PAYMENT_INTENT_MAKER_ROLES.includes(String(r || "").trim().toLowerCase()));
