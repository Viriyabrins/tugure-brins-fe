CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "old_value" TEXT,
  "new_value" TEXT,
  "user_email" TEXT NOT NULL,
  "user_role" TEXT,
  "ip_address" TEXT,
  "reason" TEXT
);

CREATE TABLE "Batch" (
  "batch_id" TEXT NOT NULL PRIMARY KEY,
  "batch_month" INTEGER,
  "batch_year" INTEGER,
  "contract_id" TEXT NOT NULL,
  "total_records" INTEGER NOT NULL DEFAULT 0,
  "total_exposure" NUMERIC(25,2) NOT NULL DEFAULT 0,
  "total_premium" NUMERIC(25,2) NOT NULL DEFAULT 0,
  "final_exposure_amount" NUMERIC(25,2) NOT NULL DEFAULT 0,
  "final_premium_amount" NUMERIC(25,2) NOT NULL DEFAULT 0,
  "debtor_review_completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "batch_ready_for_nota" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" TEXT NOT NULL DEFAULT 'Uploaded',
  "operational_locked" BOOLEAN NOT NULL DEFAULT FALSE,
  "reopen_requested_by" TEXT,
  "reopen_requested_date" TIMESTAMP,
  "reopen_reason" TEXT,
  "reopen_impact" TEXT,
  "reopen_approved_by" TEXT,
  "reopen_approved_date" TIMESTAMP,
  "validated_by" TEXT,
  "validated_date" TIMESTAMP,
  "matched_by" TEXT,
  "matched_date" TIMESTAMP,
  "approved_by" TEXT,
  "approved_date" TIMESTAMP,
  "nota_issued_by" TEXT,
  "nota_issued_date" TIMESTAMP,
  "branch_confirmed_by" TEXT,
  "branch_confirmed_date" TIMESTAMP,
  "paid_by" TEXT,
  "paid_date" TIMESTAMP,
  "closed_by" TEXT,
  "closed_date" TIMESTAMP,
  "rejection_reason" TEXT
);

CREATE TABLE "Bordero" (
  "bordero_id" TEXT NOT NULL PRIMARY KEY,
  "contract_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "total_debtors" INTEGER,
  "total_exposure" NUMERIC(25,2),
  "total_premium" NUMERIC(25,2),
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "status" TEXT NOT NULL DEFAULT 'GENERATED',
  "reviewed_by" TEXT,
  "reviewed_date" TIMESTAMP,
  "finalized_by" TEXT,
  "finalized_date" TIMESTAMP
);

CREATE TABLE "Claim" (
  "claim_no" TEXT NOT NULL PRIMARY KEY,
  "policy_no" TEXT,
  "nomor_sertifikat" TEXT,
  "nama_tertanggung" TEXT NOT NULL,
  "no_ktp_npwp" TEXT,
  "no_fasilitas_kredit" TEXT,
  "bdo_premi" TEXT,
  "tanggal_realisasi_kredit" TIMESTAMP,
  "plafond" NUMERIC(25,2),
  "max_coverage" NUMERIC(25,2),
  "kol_debitur" TEXT,
  "dol" TIMESTAMP,
  "nilai_klaim" NUMERIC(25,2) NOT NULL,
  "share_tugure_percentage" NUMERIC(5,2),
  "share_tugure_amount" NUMERIC(25,2),
  "check_bdo_premi" BOOLEAN NOT NULL DEFAULT FALSE,
  "batch_id" TEXT,
  "version_no" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "debtor_id" TEXT,
  "contract_id" TEXT,
  "checked_by" TEXT,
  "checked_date" TIMESTAMP,
  "doc_verified_by" TEXT,
  "doc_verified_date" TIMESTAMP,
  "invoiced_by" TEXT,
  "invoiced_date" TIMESTAMP,
  "paid_by" TEXT,
  "paid_date" TIMESTAMP,
  "rejection_reason" TEXT,
  "reviewed_by" TEXT,
  "review_date" TIMESTAMP
);

CREATE TABLE "Contract" (
  "contract_number" TEXT NOT NULL PRIMARY KEY,
  "contract_name" TEXT NOT NULL,
  "cedant" TEXT NOT NULL DEFAULT 'BRINS',
  "reinsurer" TEXT NOT NULL DEFAULT 'TUGURE',
  "credit_type" TEXT NOT NULL,
  "coverage_percentage" NUMERIC(5,2),
  "premium_rate" NUMERIC(5,2),
  "start_date" TIMESTAMP,
  "end_date" TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'IDR'
);

CREATE TABLE "DebitCreditNote" (
  "note_number" TEXT NOT NULL PRIMARY KEY,
  "note_type" TEXT NOT NULL,
  "original_nota_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "adjustment_amount" NUMERIC(25,2) NOT NULL,
  "reason_code" TEXT NOT NULL,
  "reason_description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "drafted_by" TEXT,
  "drafted_date" TIMESTAMP,
  "reviewed_by" TEXT,
  "reviewed_date" TIMESTAMP,
  "approved_by" TEXT,
  "approved_date" TIMESTAMP,
  "acknowledged_by" TEXT,
  "acknowledged_date" TIMESTAMP,
  "rejection_reason" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'IDR'
);

CREATE TABLE "Debtor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cover_id" INTEGER,
  "program_id" TEXT,
  "batch_id" TEXT NOT NULL,
  "nomor_rekening_pinjaman" TEXT,
  "nomor_peserta" TEXT NOT NULL,
  "loan_type" TEXT,
  "loan_type_desc" TEXT,
  "cif_rekening_pinjaman" TEXT,
  "jenis_pengajuan_desc" TEXT,
  "jenis_covering_desc" TEXT,
  "tanggal_mulai_covering" TIMESTAMP,
  "tanggal_akhir_covering" TIMESTAMP,
  "plafon" NUMERIC(25,2),
  "nominal_premi" NUMERIC(25,2),
  "premi_percentage" NUMERIC(5,2),
  "ric_percentage" NUMERIC(5,2),
  "bf_percentage" NUMERIC(5,2),
  "net_premi" NUMERIC(25,2),
  "unit_code" TEXT,
  "unit_desc" TEXT,
  "branch_desc" TEXT,
  "region_desc" TEXT,
  "nama_peserta" TEXT NOT NULL,
  "alamat_usaha" TEXT,
  "nomor_perjanjian_kredit" TEXT,
  "tanggal_terima" TIMESTAMP,
  "tanggal_validasi" TIMESTAMP,
  "teller_premium_date" TIMESTAMP,
  "status_aktif" INTEGER,
  "remark_premi" TEXT,
  "flag_restruktur" INTEGER,
  "kolektabilitas" INTEGER,
  "contract_id" TEXT,
  "version_no" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "is_locked" BOOLEAN NOT NULL DEFAULT FALSE,
  "rejection_reason" TEXT,
  "validation_remarks" TEXT
);

CREATE TABLE "Document" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "debtor_id" TEXT,
  "batch_id" TEXT,
  "claim_id" TEXT,
  "document_type" TEXT,
  "document_name" TEXT NOT NULL,
  "file_url" TEXT,
  "upload_date" TIMESTAMP,
  "expiry_date" TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "remarks" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "parent_document_id" TEXT,
  "uploaded_by" TEXT
);

CREATE TABLE "EmailTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "object_type" TEXT NOT NULL,
  "status_from" TEXT,
  "status_to" TEXT NOT NULL,
  "recipient_role" TEXT NOT NULL,
  "email_subject" TEXT NOT NULL,
  "email_body" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "Invoice" (
  "invoice_number" TEXT NOT NULL PRIMARY KEY,
  "bordero_id" TEXT,
  "contract_id" TEXT NOT NULL,
  "period" TEXT,
  "total_amount" NUMERIC(25,2) NOT NULL,
  "paid_amount" NUMERIC(25,2) NOT NULL DEFAULT 0,
  "outstanding_amount" NUMERIC(25,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "due_date" TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'ISSUED'
);

CREATE TABLE "MasterContract" (
  "contract_id" TEXT NOT NULL PRIMARY KEY,
  "policy_no" TEXT NOT NULL,
  "program_id" TEXT,
  "product_type" TEXT NOT NULL,
  "credit_type" TEXT NOT NULL,
  "loan_type" TEXT,
  "loan_type_desc" TEXT,
  "coverage_start_date" TIMESTAMP NOT NULL,
  "coverage_end_date" TIMESTAMP NOT NULL,
  "max_tenor_month" INTEGER,
  "max_plafond" NUMERIC(25,2),
  "share_tugure_percentage" NUMERIC(5,2),
  "premium_rate" NUMERIC(5,2),
  "ric_rate" NUMERIC(5,2),
  "bf_rate" NUMERIC(5,2),
  "allowed_kolektabilitas" TEXT,
  "allowed_region" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "remark" TEXT,
  "effective_status" TEXT NOT NULL DEFAULT 'Draft',
  "version" INTEGER NOT NULL DEFAULT 1,
  "parent_contract_id" TEXT,
  "effective_date" TIMESTAMP,
  "first_approved_by" TEXT,
  "first_approved_date" TIMESTAMP,
  "second_approved_by" TEXT,
  "second_approved_date" TIMESTAMP,
  "rejection_reason" TEXT
);

CREATE TABLE "Nota" (
  "nota_number" TEXT NOT NULL PRIMARY KEY,
  "nota_type" TEXT NOT NULL,
  "reference_id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "amount" NUMERIC(25,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "issued_by" TEXT,
  "issued_date" TIMESTAMP,
  "confirmed_by" TEXT,
  "confirmed_date" TIMESTAMP,
  "paid_date" TIMESTAMP,
  "payment_reference" TEXT,
  "total_actual_paid" NUMERIC(25,2) NOT NULL DEFAULT 0,
  "reconciliation_status" TEXT NOT NULL DEFAULT 'PENDING',
  "is_immutable" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'INFO',
  "module" TEXT,
  "reference_id" TEXT,
  "reference_type" TEXT,
  "target_role" TEXT NOT NULL,
  "target_user" TEXT,
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "action_url" TEXT
);

CREATE TABLE "NotificationSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "full_name" TEXT NOT NULL,
  "user_email" TEXT NOT NULL,
  "user_role" TEXT NOT NULL,
  "notification_email" TEXT,
  "whatsapp_number" TEXT,
  "email_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "notify_batch_status" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_record_status" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_nota_status" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_claim_status" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_subrogation_status" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_bordero_status" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_invoice_status" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_reconciliation_status" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_payment_received" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_approval_required" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_document_verification" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "Payment" (
  "payment_ref" TEXT NOT NULL PRIMARY KEY,
  "invoice_id" TEXT,
  "intent_id" TEXT,
  "contract_id" TEXT,
  "amount" NUMERIC(25,2) NOT NULL,
  "payment_date" TIMESTAMP NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "bank_reference" TEXT,
  "match_status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "exception_type" TEXT NOT NULL DEFAULT 'NONE',
  "matched_by" TEXT,
  "matched_date" TIMESTAMP,
  "is_actual_payment" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "PaymentIntent" (
  "intent_id" TEXT NOT NULL PRIMARY KEY,
  "invoice_id" TEXT NOT NULL,
  "contract_id" TEXT,
  "payment_type" TEXT NOT NULL DEFAULT 'FULL',
  "planned_amount" NUMERIC(25,2) NOT NULL,
  "planned_date" TIMESTAMP NOT NULL,
  "remarks" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT'
);

CREATE TABLE "Reconciliation" (
  "recon_id" TEXT NOT NULL PRIMARY KEY,
  "contract_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "total_invoiced" NUMERIC(25,2) NOT NULL,
  "total_paid" NUMERIC(25,2) NOT NULL,
  "difference" NUMERIC(25,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "closed_by" TEXT,
  "closed_date" TIMESTAMP,
  "remarks" TEXT
);

CREATE TABLE "Record" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batch_id" TEXT NOT NULL,
  "debtor_id" TEXT NOT NULL,
  "record_status" TEXT NOT NULL DEFAULT 'Accepted',
  "exposure_amount" NUMERIC(25,2),
  "premium_amount" NUMERIC(25,2),
  "revision_reason" TEXT,
  "revision_count" INTEGER NOT NULL DEFAULT 0,
  "accepted_by" TEXT,
  "accepted_date" TIMESTAMP,
  "rejected_by" TEXT,
  "rejected_date" TIMESTAMP,
  "rejection_reason" TEXT
);

CREATE TABLE "SlaRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rule_name" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "trigger_condition" TEXT NOT NULL,
  "status_value" TEXT,
  "duration_value" INTEGER,
  "duration_unit" TEXT NOT NULL DEFAULT 'HOURS',
  "notification_type" TEXT NOT NULL DEFAULT 'BOTH',
  "recipient_role" TEXT NOT NULL,
  "email_subject" TEXT,
  "email_body" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_recurring" BOOLEAN NOT NULL DEFAULT FALSE,
  "recurrence_interval" INTEGER,
  "last_triggered" TIMESTAMP,
  "trigger_count" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "Subrogation" (
  "subrogation_id" TEXT NOT NULL PRIMARY KEY,
  "claim_id" TEXT NOT NULL,
  "debtor_id" TEXT NOT NULL,
  "recovery_amount" NUMERIC(25,2) NOT NULL,
  "recovery_date" TIMESTAMP NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "invoiced_by" TEXT,
  "invoiced_date" TIMESTAMP,
  "closed_by" TEXT,
  "closed_date" TIMESTAMP,
  "remarks" TEXT
);

CREATE TABLE "SystemConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "config_type" TEXT NOT NULL,
  "config_key" TEXT NOT NULL,
  "config_value" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "effective_date" TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'APPROVED'
);
