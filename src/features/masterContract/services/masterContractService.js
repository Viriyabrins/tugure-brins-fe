import { backend } from "@/api/backendClient";
import { extractBaseContractNo } from "../utils/masterContractConstants";

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
            await backend.processMasterContractWorkflowAction(c.contract_id || c.id, {
                action: "CHECK_BRINS",
                actorEmail: auditActor?.user_email || user?.email,
                actorRole: auditActor?.user_role || user?.role,
            });
            count++;
        }
        return count;
    },

    async approveBrins(contractIds, contracts, auditActor, user) {
        let count = 0;
        for (const contractId of contractIds) {
            const c = contracts.find((x) => (x.contract_id || x.id) === contractId);
            if (!c || (c.status_approval || "") !== "CHECKED_BRINS") continue;
            await backend.processMasterContractWorkflowAction(c.contract_id || c.id, {
                action: "APPROVE_BRINS",
                actorEmail: auditActor?.user_email || user?.email,
                actorRole: auditActor?.user_role || user?.role,
            });
            count++;
        }
        return count;
    },

    async checkTugure(contractIds, contracts, auditActor, user) {
        let count = 0;
        for (const contractId of contractIds) {
            const c = contracts.find((x) => (x.contract_id || x.id) === contractId);
            if (!c || (c.status_approval || "") !== "APPROVED_BRINS") continue;
            await backend.processMasterContractWorkflowAction(c.contract_id || c.id, {
                action: "CHECK_TUGURE",
                actorEmail: auditActor?.user_email || user?.email,
                actorRole: auditActor?.user_role || user?.role,
            });
            count++;
        }
        return count;
    },

    async approveTugure(contractIds, contracts, approvalAction, approvalRemarks, auditActor, user) {
        const action = approvalAction === "REVISION" ? "REVISION" : "APPROVE";
        let count = 0;
        for (const contractId of contractIds) {
            const c = contracts.find((x) => (x.contract_id || x.id) === contractId);
            if (!c || (c.status_approval || "") !== "CHECKED_TUGURE") continue;
            await backend.processMasterContractWorkflowAction(c.contract_id || c.id, {
                action,
                remarks: approvalRemarks,
                actorEmail: auditActor?.user_email || user?.email,
                actorRole: auditActor?.user_role || user?.role,
            });
            count++;
        }
        return count;
    },

    async uploadContracts(payload) {
        return backend.uploadMasterContractsAtomic(payload);
    },

    async closeOrInvalidate(contract, actionType, remarks, auditActor, user) {
        const contractId = contract.contract_id || contract.id;
        return backend.closeMasterContract(contractId, { actionType, remarks });
    },
};
