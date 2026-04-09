import { backend } from "@/api/backendClient";
import { getExcelDate, toNumber } from "@/shared/utils/dataTransform";
import { CLAIM_PAGE_SIZE } from "../utils/claimConstants";
import { sendNotificationEmail } from "@/components/utils/emailTemplateHelper";

/**
 * All API calls and business logic for the Claims feature.
 * UI components and hooks should call this service rather than backend directly.
 */
export const claimService = {
    /** Fetch a paginated list of claims with optional filters. */
    async listPaginated(filters = {}, page = 1, pageSize = CLAIM_PAGE_SIZE) {
        return backend.listPaginated("Claim", {
            page,
            limit: pageSize,
            q: JSON.stringify(filters),
        });
    },

    /** Fetch all claims (used for trend analysis). */
    async listAll() {
        return backend.list("Claim");
    },

    /**
     * Creates a single Claim (Tugure flow) or Subrogation (Brins recovery flow).
     * Also creates the corresponding Subrogation + audit log + notification.
     */
    async uploadClaim(claim, claimNo, batch, user, isBrinsUser) {
        const tanggalRealisasiISO = getExcelDate(
            claim.tanggal_realisasi_kredit,
        );
        const dolISO = getExcelDate(claim.dol);

        if (isBrinsUser) {
            await backend.create("Claim", {
                claim_no: claimNo,
                policy_no: claim.policy_no,
                nomor_sertifikat: claim.nomor_sertifikat,
                nama_tertanggung: claim.nama_tertanggung,
                no_ktp_npwp: claim.no_ktp_npwp,
                no_fasilitas_kredit: claim.no_fasilitas_kredit,
                bdo_premi: claim.bdo_premi,
                tanggal_realisasi_kredit: tanggalRealisasiISO,
                plafond: claim.plafond,
                max_coverage: claim.max_coverage,
                kol_debitur: claim.kol_debitur,
                dol: dolISO,
                nilai_klaim: claim.nilai_klaim,
                share_tugure_percentage: claim.share_tugure_percentage,
                share_tugure_amount: claim.share_tugure_amount,
                check_bdo_premi: claim.check_bdo_premi,
                debtor_id: claim.debtor_id || "",
                contract_id: claim.contract_id || "",
                batch_id: batch.batch_id,
                nomor_peserta: claim.nomor_peserta,
                status: "SUBMITTED",
                version_no: 1,
            });

            await claimService._audit(
                "CLAIM_CREATED",
                "CLAIM",
                "Claim",
                claimNo,
                {
                    batch_id: batch.batch_id,
                    nilai_klaim: claim.nilai_klaim,
                },
                user,
                "Bulk recovery upload (BRINS)",
            );
        } else {
            await backend.create("Claim", {
                claim_no: claimNo,
                policy_no: claim.policy_no,
                nomor_sertifikat: claim.nomor_sertifikat,
                nama_tertanggung: claim.nama_tertanggung,
                no_ktp_npwp: claim.no_ktp_npwp,
                no_fasilitas_kredit: claim.no_fasilitas_kredit,
                bdo_premi: claim.bdo_premi,
                tanggal_realisasi_kredit: tanggalRealisasiISO,
                plafond: claim.plafond,
                max_coverage: claim.max_coverage,
                kol_debitur: claim.kol_debitur,
                dol: dolISO,
                nilai_klaim: claim.nilai_klaim,
                share_tugure_percentage: claim.share_tugure_percentage,
                share_tugure_amount: claim.share_tugure_amount,
                check_bdo_premi: claim.check_bdo_premi,
                debtor_id: claim.debtor_id || "",
                contract_id: claim.contract_id || "",
                batch_id: batch.batch_id,
                nomor_peserta: claim.nomor_peserta,
                status: "SUBMITTED",
                version_no: 1,
            });

            await claimService._audit(
                "CLAIM_CREATED",
                "CLAIM",
                "Claim",
                claimNo,
                {
                    batch_id: batch.batch_id,
                    nilai_klaim: claim.nilai_klaim,
                },
                user,
                "Bulk upload from file",
            );
        }
    },

    /** Creates a manual Subrogation entry. Returns the new subrogation_id. */
    async createSubrogation(data, user) {
        const subrogationId = `SUB-${Date.now()}`;
        await backend.create("Subrogation", {
            subrogation_id: subrogationId,
            claim_id: data.claimId,
            debtor_id: data.debtorId,
            recovery_amount: toNumber(data.recoveryAmount),
            recovery_date: getExcelDate(data.recoveryDate),
            status: "SUBMITTED",
            remarks: data.remarks || "",
        });
        await claimService._audit(
            "SUBROGATION_CREATED",
            "SUBROGATION",
            "Subrogation",
            subrogationId,
            { claim_id: data.claimId, recovery_amount: data.recoveryAmount },
            user,
            "Manual subrogation creation",
        );
        await claimService._notify(
            "New Subrogation Created",
            `Subrogation ${subrogationId} created for claim ${data.claimId}`,
            "SUBROGATION",
            subrogationId,
            "TUGURE",
        );
        return subrogationId;
    },

    /** Returns Nota records for a given batch. */
    async checkNotaPayment(batchId) {
        const notas = await backend.list("Nota");
        return notas.filter(
            (n) => n.reference_id === batchId && n.nota_type === "Batch",
        );
    },

    /** Returns the highest existing sequence number for claim IDs with the given prefix. */
    async getNextClaimSequence(prefix) {
        let maxSeq = 0;
        try {
            const result = await backend.listPaginated("Claim", {
                limit: 9999,
            });
            for (const c of result?.data || []) {
                if (c.claim_no?.startsWith(prefix)) {
                    const seq = parseInt(
                        c.claim_no.replace(prefix, ""),
                        10,
                    );
                    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                }
            }
        } catch (_) { }
        return maxSeq;
    },

    /** Sends a bulk-upload notification + background email. */
    async notifyBulkUpload(uploaded, batchId, userEmail, isBrinsUser) {
        await backend.create("Notification", {
            title: isBrinsUser ? "Bulk Recovery Upload" : "Bulk Claim Upload",
            message: `${uploaded} ${isBrinsUser ? "recoveries" : "claims"} uploaded for batch ${batchId}`,
            type: "INFO",
            module: "CLAIM",
            reference_id: batchId,
            target_role: "tugure-checker-role",
        });
        sendNotificationEmail({
            targetGroup: "tugure-checker",
            objectType: "Record",
            statusTo: "SUBMITTED",
            recipientRole: "TUGURE",
            variables: {
                claim_count: String(uploaded),
                action_by: userEmail,
                batch_id: batchId,
            },
            fallbackSubject: isBrinsUser
                ? "New Recoveries Submitted"
                : "New Claims Submitted",
            fallbackBody: `${uploaded} ${isBrinsUser ? "recoveries" : "claims"} have been submitted by ${userEmail} for batch ${batchId} and await checking.`,
        }).catch((e) => console.error("Background email fail:", e));
    },

    /** Writes an audit log for a blocked submission attempt. */
    async auditBlockedSubmission(batchId, userEmail, userRole) {
        await backend.create("AuditLog", {
            action: "BLOCKED_CLAIM_SUBMISSION",
            module: "CLAIM",
            entity_type: "Batch",
            entity_id: batchId,
            old_value: "{}",
            new_value: JSON.stringify({ blocked_reason: "Nota not PAID" }),
            user_email: userEmail,
            user_role: userRole,
            reason: "Attempted claim submission before Nota payment",
        });
    },

    /** Internal: write an audit log (failures are swallowed as warnings). */
    async _audit(action, module, entityType, entityId, newValue, user, reason) {
        try {
            await backend.create("AuditLog", {
                action,
                module,
                entity_type: entityType,
                entity_id: entityId,
                old_value: "{}",
                new_value: JSON.stringify(newValue),
                user_email: user?.email,
                user_role: user?.role,
                reason,
            });
        } catch (e) {
            console.warn(`Audit log failed [${action}]:`, e);
        }
    },

    /** Internal: create a notification (failures are swallowed as warnings). */
    async _notify(title, message, module, referenceId, targetRole) {
        try {
            await backend.create("Notification", {
                title,
                message,
                type: "INFO",
                module,
                reference_id: referenceId,
                target_role: targetRole,
            });
        } catch (e) {
            console.warn("Notification creation failed:", e);
        }
    },
};
