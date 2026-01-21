-- AlterTable
ALTER TABLE "AuditLog" RENAME CONSTRAINT "AuditLog_pkey" TO "auditlog_pkey";

-- AlterTable
ALTER TABLE "Batch" RENAME CONSTRAINT "Batch_pkey" TO "batch_pkey";

-- AlterTable
ALTER TABLE "Bordero" RENAME CONSTRAINT "Bordero_pkey" TO "bordero_pkey";

-- AlterTable
ALTER TABLE "Claim" RENAME CONSTRAINT "Claim_pkey" TO "claim_pkey";

-- AlterTable
ALTER TABLE "Contract" RENAME CONSTRAINT "Contract_pkey" TO "contract_pkey";

-- AlterTable
ALTER TABLE "DebitCreditNote" RENAME CONSTRAINT "DebitCreditNote_pkey" TO "debitcreditnote_pkey";

-- AlterTable
ALTER TABLE "Debtor" RENAME CONSTRAINT "Debtor_pkey" TO "debtor_pkey";

-- AlterTable
ALTER TABLE "Document" RENAME CONSTRAINT "Document_pkey" TO "document_pkey";

-- AlterTable
ALTER TABLE "EmailTemplate" RENAME CONSTRAINT "EmailTemplate_pkey" TO "emailtemplate_pkey";

-- AlterTable
ALTER TABLE "Invoice" RENAME CONSTRAINT "Invoice_pkey" TO "invoice_pkey";

-- AlterTable
ALTER TABLE "MasterContract" RENAME CONSTRAINT "MasterContract_pkey" TO "mastercontract_pkey";

-- AlterTable
ALTER TABLE "Nota" RENAME CONSTRAINT "Nota_pkey" TO "nota_pkey";

-- AlterTable
ALTER TABLE "Notification" RENAME CONSTRAINT "Notification_pkey" TO "notification_pkey";

-- AlterTable
ALTER TABLE "NotificationSetting" RENAME CONSTRAINT "NotificationSetting_pkey" TO "notificationsetting_pkey";

-- AlterTable
ALTER TABLE "Payment" RENAME CONSTRAINT "Payment_pkey" TO "payment_pkey";

-- AlterTable
ALTER TABLE "PaymentIntent" RENAME CONSTRAINT "PaymentIntent_pkey" TO "paymentintent_pkey";

-- AlterTable
ALTER TABLE "Reconciliation" RENAME CONSTRAINT "Reconciliation_pkey" TO "reconciliation_pkey";

-- AlterTable
ALTER TABLE "Record" RENAME CONSTRAINT "Record_pkey" TO "record_pkey";

-- AlterTable
ALTER TABLE "SlaRule" RENAME CONSTRAINT "SlaRule_pkey" TO "slarule_pkey";

-- AlterTable
ALTER TABLE "Subrogation" RENAME CONSTRAINT "Subrogation_pkey" TO "subrogation_pkey";

-- AlterTable
ALTER TABLE "SystemConfig" RENAME CONSTRAINT "SystemConfig_pkey" TO "systemconfig_pkey";
