import { backend } from "@/api/backendClient";
import { getExcelDate, toNumber } from "@/shared/utils/dataTransform";
import { CLAIM_PAGE_SIZE } from "../utils/claimConstants";

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
     * Also creates the corresponding audit log + notification.
     * batch_id and contract_id are taken from the claim object (auto-populated from matched debtor).
     */
    async uploadClaim(claim, claimNo, user, isBrinsUser) {
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
                batch_id: claim.batch_id || "",
                nomor_peserta: claim.nomor_peserta,
                status: "SUBMITTED",
                version_no: 1,
                source_filename: claim.source_filename || null,
            });

            await claimService._audit(
                "CLAIM_CREATED",
                "CLAIM",
                "Claim",
                claimNo,
                {
                    batch_id: claim.batch_id,
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
                batch_id: claim.batch_id || "",
                nomor_peserta: claim.nomor_peserta,
                status: "SUBMITTED",
                version_no: 1,
                source_filename: claim.source_filename || null,
            });

            await claimService._audit(
                "CLAIM_CREATED",
                "CLAIM",
                "Claim",
                claimNo,
                {
                    batch_id: claim.batch_id,
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

    /** Returns Nota records for a given contract. */
    async checkNotaPayment(contractId) {
        const notas = await backend.list("Nota");
        return notas.filter(
            (n) => n.reference_id === contractId && n.nota_type === "Batch",
        );
    },

    /** Returns the highest existing sequence number for claim IDs with the given prefix. */
    async getNextClaimSequence(prefix) {
        try {
            return await backend.getNextClaimSequence(prefix);
        } catch (_) { return 0; }
    },

    /** Sends a bulk-upload notification. */
    async notifyBulkUpload(uploaded, contractId, userEmail, isBrinsUser) {
        await backend.create("Notification", {
            title: isBrinsUser ? "Bulk Recovery Upload" : "Bulk Claim Upload",
            message: `${uploaded} ${isBrinsUser ? "recoveries" : "claims"} uploaded for contract ${contractId}`,
            type: "INFO",
            module: "CLAIM",
            reference_id: contractId,
            target_role: "tugure-checker-role",
        });
    },

    /** Writes an audit log for a blocked submission attempt. */
    async auditBlockedSubmission(contractId, userEmail, userRole) {
        await backend.create("AuditLog", {
            action: "BLOCKED_CLAIM_SUBMISSION",
            module: "CLAIM",
            entity_type: "Claim",
            entity_id: contractId,
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
