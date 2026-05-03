export const SC_PAGE_SIZE = 10;

export const DEFAULT_TEMPLATE_FILTER = { object_type: "all" };

export const EMAIL_TEMPLATE_ADMIN_ROLES = ["admin-brins-role", "admin-tugure-role"];

export const WORKFLOW_TEMPLATE_OBJECT_TYPES = ["MasterContract", "Debtor", "Claim", "Subrogation"];

export const WORKFLOW_ACTION_OPTIONS = [
    { value: "UPLOAD", label: "Upload" },
    { value: "CHECK_BRINS", label: "Check BRINS" },
    { value: "APPROVE_BRINS", label: "Approve BRINS" },
    { value: "CHECK_TUGURE", label: "Check TUGURE" },
    { value: "APPROVE_FINAL", label: "Approve Final" },
    { value: "REVISION", label: "Revision" },
];

export const WORKFLOW_AUDIENCE_OPTIONS = [
    { value: "ACTOR_SELF", label: "Actor Self" },
    { value: "UPLOADER", label: "Uploader" },
    { value: "BRINS_CHECKERS", label: "BRINS Checkers" },
    { value: "BRINS_APPROVERS", label: "BRINS Approvers" },
    { value: "TUGURE_CHECKERS", label: "TUGURE Checkers" },
    { value: "TUGURE_APPROVERS", label: "TUGURE Approvers" },
    { value: "PRIOR_ACTORS", label: "Prior Actors" },
];

export const EMAIL_TEMPLATE_RECIPIENT_OPTIONS = ["BRINS", "TUGURE", "ADMIN", "ALL"];

export const WORKFLOW_TEMPLATE_VARIABLES = "{batch_id}, {actor_email}, {uploader_email}, {checker_email}, {checker_brins_email}, {approver_brins_email}, {checker_tugure_email}, {remarks}, {remarks_block}, {module_label}, {module_label_lower}, {record_count}, {record_count_text}, {actor_display}, {actor_display_lower}, {uploader_display}";

export const DEFAULT_SLA_FILTER = { ruleName: "", triggerCondition: "all", status: "all" };

export const NOTIFICATION_CATEGORIES = [
    {
        name: "Batch & Record Notifications",
        color: "blue",
        types: ["notify_batch_status", "notify_record_status", "notify_contract_status"],
    },
    {
        name: "Nota & Invoice Notifications",
        color: "purple",
        types: ["notify_nota_status", "notify_invoice_status", "notify_reconciliation_status"],
    },
    {
        name: "Claims & Payments",
        color: "pink",
        types: ["notify_claim_status", "notify_subrogation_status", "notify_payment_received", "notify_bordero_status"],
    },
    {
        name: "Approvals & Verification",
        color: "yellow",
        types: ["notify_approval_required", "notify_document_verification", "notify_debit_credit_note"],
    },
];

export const DEFAULT_NOTIFICATION_SETTING = {
    id: "", user_email: "", user_role: "",
    full_name: "", notification_email: "", whatsapp_number: "",
    email_enabled: true, whatsapp_enabled: false,
    // Legacy fields
    notify_contract_status: true, notify_batch_status: true, notify_record_status: true,
    notify_nota_status: true, notify_claim_status: true, notify_subrogation_status: true,
    notify_bordero_status: true, notify_invoice_status: true, notify_payment_received: true,
    notify_approval_required: true, notify_document_verification: true, notify_debit_credit_note: true, notify_reconciliation_status: true,
    // Email channel preferences
    email_notify_contract_status: true, email_notify_batch_status: true, email_notify_record_status: true,
    email_notify_nota_status: true, email_notify_claim_status: true, email_notify_subrogation_status: true,
    email_notify_bordero_status: true, email_notify_invoice_status: true, email_notify_payment_received: true,
    email_notify_approval_required: true, email_notify_document_verification: true, email_notify_debit_credit_note: true, email_notify_reconciliation_status: true,
    // In-app notification preferences
    inapp_notify_contract_status: true, inapp_notify_batch_status: true, inapp_notify_record_status: true,
    inapp_notify_nota_status: true, inapp_notify_claim_status: true, inapp_notify_subrogation_status: true,
    inapp_notify_bordero_status: true, inapp_notify_invoice_status: true, inapp_notify_payment_received: true,
    inapp_notify_approval_required: true, inapp_notify_document_verification: true, inapp_notify_debit_credit_note: true, inapp_notify_reconciliation_status: true,
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

export const KNOWN_ROLES = ["maker-brins-role", "checker-brins-role", "approver-brins-role", "checker-tugure-role", "approver-tugure-role", "admin", "admin-brins-role", "admin-tugure-role"];
