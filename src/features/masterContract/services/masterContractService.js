import { backend } from "@/api/backendClient";
import { sendNotificationEmail } from "@/components/utils/emailTemplateHelper";
import { ALL_ROLE_NAMES, extractBaseContractNo, toNullableString } from "../utils/masterContractConstants";

const _audit = async (action, entityId, oldValue, newValue, reason, auditActor, user) => {
    try {
        await backend.create("AuditLog", {
            action,
            module: "CONFIG",
            entity_type: "MasterContract",
            entity_id: entityId,
            old_value: JSON.stringify(oldValue),
            new_value: JSON.stringify(newValue),
            user_email: auditActor?.user_email || user?.email,
            user_role: auditActor?.user_role || user?.role,
            reason,
        });
    } catch (e) {
        console.warn("Failed to create audit log:", e);
    }
};

const _notify = async (title, message, type = "INFO") => {
    for (const role of ALL_ROLE_NAMES) {
        try {
            await backend.create("Notification", { title, message, type, module: "CONFIG", target_role: role });
        } catch (e) {
            console.warn("Failed to create notification:", e);
        }
    }
};

export const masterContractService = {
    async loadContracts(filters, page, pageSize) {
        const isRevision = String(filters?.status || "").toUpperCase() === "REVISION";
        const entity = isRevision ? "ContractRevise" : "MasterContract";
        const query = { page, limit: pageSize };
        if (filters) query.q = JSON.stringify(filters);
        const result = await backend.listPaginated(entity, query);
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async loadStats() {
        try {
            const result = await backend.listPaginated("MasterContract", { page: 1, limit: 0 });
            return Array.isArray(result.data) ? result.data : [];
        } catch (e) {
            console.error("Failed to load stats:", e);
            return [];
        }
    },

    async loadRevisionDiffs(selectedContract) {
        const ver = Number(selectedContract.version) || 0;
        if (ver < 2) return [];
        const base = extractBaseContractNo(selectedContract.contract_no || selectedContract.contract_no_from || "");
        try {
            const res = await backend.listPaginated("ContractRevise", { page: 1, limit: 1, q: JSON.stringify({ contractId: base }) });
            const prev = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;
            if (!prev) return [];
            const diffs = [];
            for (const k of Object.keys(selectedContract).filter((key) => key !== "id")) {
                const oldStr = prev[k] === null || prev[k] === undefined ? "" : String(prev[k]);
                const newStr = selectedContract[k] === null || selectedContract[k] === undefined ? "" : String(selectedContract[k]);
                if (oldStr !== newStr) diffs.push({ key: k, old: oldStr || "-", new: newStr || "-" });
            }
            return diffs;
        } catch (e) {
            console.error("Failed to load revision diffs:", e);
            return [];
        }
    },

    async checkBrins(contractIds, contracts, auditActor, user) {
        let count = 0;
        for (const contractId of contractIds) {
            const c = contracts.find((x) => (x.contract_id || x.id) === contractId);
            if (!c) continue;
            const status = String(c.contract_status || "");
            const approval = String(c.status_approval || "");
            if (status !== "Draft" && approval !== "SUBMITTED") continue;
            await backend.update("MasterContract", c.contract_id || c.id, { status_approval: "CHECKED_BRINS" });
            count++;
            await _audit("CONTRACT_CHECKED_BRINS", c.contract_id || c.id, { approval }, { approval: "CHECKED_BRINS" }, `Checker BRINS checked contract ${c.contract_no || c.contract_id}`, auditActor, user);
        }
        if (count > 0) {
            const brinsRoles = ["maker-brins-role", "checker-brins-role", "approver-brins-role"];
            for (const role of brinsRoles) {
                try { await backend.create("Notification", { title: "Contracts Checked by BRINS Checker", message: `${auditActor?.user_email || user?.email} checked ${count} contract(s). Awaiting BRINS Approver approval.`, type: "INFO", module: "CONFIG", target_role: role }); } catch (e) { console.warn(e); }
            }
            sendNotificationEmail({ targetGroup: "brins-approver", objectType: "Contract", statusTo: "CHECKED_BRINS", recipientRole: "BRINS", variables: { user_name: auditActor?.user_email || user?.email || "System", date: new Date().toLocaleDateString("id-ID"), count: String(count) }, fallbackSubject: "Contracts Checked", fallbackBody: "<p>{user_name} has checked {count} contract(s) on {date}.</p>" }).catch(console.error);
        }
        return count;
    },

    async approveBrins(contractIds, contracts, auditActor, user) {
        let count = 0;
        for (const contractId of contractIds) {
            const c = contracts.find((x) => (x.contract_id || x.id) === contractId);
            if (!c || (c.status_approval || "") !== "CHECKED_BRINS") continue;
            await backend.update("MasterContract", c.contract_id || c.id, { status_approval: "APPROVED_BRINS" });
            count++;
            await _audit("CONTRACT_APPROVED_BRINS", c.contract_id || c.id, { approval: "CHECKED_BRINS" }, { approval: "APPROVED_BRINS" }, `Approver BRINS approved contract ${c.contract_no || c.contract_id}`, auditActor, user);
        }
        if (count > 0) {
            await _notify("Contracts Approved by BRINS", `${auditActor?.user_email || user?.email} approved ${count} contract(s). Now available for Tugure review.`);
            sendNotificationEmail({ targetGroup: "tugure-checker", objectType: "Contract", statusTo: "APPROVED_BRINS", recipientRole: "TUGURE", variables: { user_name: auditActor?.user_email || user?.email || "System", date: new Date().toLocaleDateString("id-ID"), count: String(count) }, fallbackSubject: "Contracts Approved by BRINS", fallbackBody: "<p>{user_name} has approved {count} contract(s) on {date}.</p>" }).catch(console.error);
        }
        return count;
    },

    async checkTugure(contractIds, contracts, auditActor, user) {
        let count = 0;
        for (const contractId of contractIds) {
            const c = contracts.find((x) => (x.contract_id || x.id) === contractId);
            if (!c || (c.status_approval || "") !== "APPROVED_BRINS") continue;
            await backend.update("MasterContract", c.contract_id || c.id, { status_approval: "CHECKED_TUGURE" });
            count++;
            await _audit("CONTRACT_CHECKED_TUGURE", c.contract_id || c.id, { approval: "APPROVED_BRINS" }, { approval: "CHECKED_TUGURE" }, `Checker Tugure checked contract ${c.contract_no || c.contract_id}`, auditActor, user);
        }
        if (count > 0) {
            await _notify("Contracts Checked by Tugure", `${auditActor?.user_email || user?.email} checked ${count} contract(s). Awaiting Tugure Approver final decision.`);
            sendNotificationEmail({ targetGroup: "tugure-approver", objectType: "Contract", statusTo: "CHECKED_TUGURE", recipientRole: "TUGURE", variables: { user_name: auditActor?.user_email || user?.email || "System", date: new Date().toLocaleDateString("id-ID"), count: String(count) }, fallbackSubject: "Contracts Checked by Tugure", fallbackBody: "<p>{user_name} has checked {count} contract(s) on {date}.</p>" }).catch(console.error);
        }
        return count;
    },

    async approveTugure(contractIds, contracts, approvalAction, approvalRemarks, auditActor, user) {
        const newStatus = approvalAction === "REVISION" ? "REVISION" : "APPROVED";
        let count = 0;
        for (const contractId of contractIds) {
            const c = contracts.find((x) => (x.contract_id || x.id) === contractId);
            if (!c || (c.status_approval || "") !== "CHECKED_TUGURE") continue;
            const updateData = { status_approval: newStatus };
            if (newStatus === "APPROVED") { updateData.first_approved_by = auditActor?.user_email || user?.email; updateData.first_approved_date = new Date().toISOString(); }
            if (newStatus === "REVISION" && approvalRemarks) updateData.revision_reason = approvalRemarks;
            await backend.update("MasterContract", c.contract_id || c.id, updateData);
            count++;
            await _audit(`CONTRACT_${newStatus}`, c.contract_id || c.id, { approval: "CHECKED_TUGURE" }, { approval: newStatus, remarks: approvalRemarks }, approvalRemarks || `Approver Tugure ${newStatus.toLowerCase()} contract`, auditActor, user);
        }
        if (count > 0) {
            await _notify(newStatus === "APPROVED" ? "Contracts Approved (Final)" : "Contracts Marked for Revision", `${auditActor?.user_email || user?.email} ${newStatus === "APPROVED" ? "approved" : "marked for revision"} ${count} contract(s).`, newStatus === "REVISION" ? "WARNING" : "INFO");
            sendNotificationEmail({ targetGroup: newStatus === "REVISION" ? "brins-maker" : "tugure-approver", objectType: "Contract", statusTo: newStatus, recipientRole: newStatus === "REVISION" ? "BRINS" : "ALL", variables: { user_name: auditActor?.user_email || user?.email || "System", date: new Date().toLocaleDateString("id-ID"), count: String(count), reason: approvalRemarks || "No remarks" }, fallbackSubject: newStatus === "APPROVED" ? "Contracts Approved (Final)" : "Contracts Marked for Revision", fallbackBody: `<p>{user_name} ${newStatus === "APPROVED" ? "approved" : "marked for revision"} {count} contract(s) on {date}.</p><p>Remarks: {reason}</p>` }).catch(console.error);
        }
        return count;
    },

    async uploadContracts(payload) {
        return backend.uploadMasterContractsAtomic(payload);
    },

    async closeOrInvalidate(contract, actionType, remarks, auditActor, user) {
        const newStatus = actionType === "close" ? "Inactive" : "Archived";
        const contractId = contract.contract_id || contract.id;
        await backend.update("MasterContract", contractId, { effective_status: newStatus, remark: remarks });
        await _audit(`CONTRACT_${actionType.toUpperCase()}`, contractId, { status: contract.effective_status }, { status: newStatus }, remarks, auditActor, user);
    },
};
