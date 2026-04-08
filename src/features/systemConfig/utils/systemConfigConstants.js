export const SC_PAGE_SIZE = 10;

export const DEFAULT_TEMPLATE_FILTER = { object_type: "all" };

export const DEFAULT_SLA_FILTER = { ruleName: "", triggerCondition: "all", status: "all" };

export const DEFAULT_NOTIFICATION_SETTING = {
    full_name: "", notification_email: "", whatsapp_number: "",
    email_enabled: true, whatsapp_enabled: false,
    notify_contract_status: true, notify_batch_status: true, notify_record_status: true,
    notify_nota_status: true, notify_claim_status: true, notify_subrogation_status: true,
    notify_bordero_status: true, notify_invoice_status: true, notify_payment_received: true,
    notify_approval_required: true, notify_document_verification: true, notify_debit_credit_note: true,
};

export const NOTIFICATION_TYPE_CONFIG = [
    { key: "notify_contract_status", label: "Master Contract Status", description: "Draft → Pending Approvals → Active/Rejected", color: "slate" },
    { key: "notify_batch_status", label: "Batch Status", description: "Uploaded → Validated → Matched → Approved → Paid → Closed", color: "blue" },
    { key: "notify_record_status", label: "Record Status", description: "Accepted → Revised → Rejected", color: "indigo" },
    { key: "notify_nota_status", label: "Nota Status", description: "Draft → Issued → Confirmed → Paid", color: "purple" },
    { key: "notify_bordero_status", label: "Bordero Status", description: "Generated → Under Review → Final", color: "violet" },
    { key: "notify_invoice_status", label: "Invoice Status", description: "Issued → Partially Paid → Paid", color: "fuchsia" },
    { key: "notify_claim_status", label: "Claim Status", description: "Draft → Checked → Doc Verified → Invoiced → Paid", color: "pink" },
    { key: "notify_subrogation_status", label: "Subrogation Status", description: "Draft → Invoiced → Paid/Closed", color: "orange" },
    { key: "notify_debit_credit_note", label: "Debit/Credit Note", description: "Draft → Under Review → Approved/Rejected → Acknowledged", color: "amber" },
    { key: "notify_payment_received", label: "Payment Received", description: "Payment confirmations and matching", color: "green" },
    { key: "notify_approval_required", label: "Approval Required", description: "Actions requiring your approval", color: "yellow" },
    { key: "notify_document_verification", label: "Document Verification", description: "Document upload and verification updates", color: "teal" },
];

export const KNOWN_ROLES = ["maker-brins-role", "checker-brins-role", "approver-brins-role", "checker-tugure-role", "approver-tugure-role", "admin", "admin-brins-role"];
