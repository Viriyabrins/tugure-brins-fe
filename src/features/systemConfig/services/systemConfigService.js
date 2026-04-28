import { backend } from "@/api/backendClient";
import { KNOWN_ROLES } from "../utils/systemConfigConstants";

export const systemConfigService = {
    async loadUser() {
        const { default: keycloakService } = await import("@/services/keycloakService");
        const userInfo = keycloakService.getCurrentUserInfo();
        if (!userInfo) return null;
        const roles = keycloakService.getRoles();
        const actor = keycloakService.getAuditActor();
        return { userInfo, roles: Array.isArray(roles) ? roles : [], actor };
    },

    async getMyNotificationSettings(keycloakUserId) {
        return backend.getMyNotificationSettings(keycloakUserId);
    },

    async upsertMyNotificationSettings(payload) {
        return backend.upsertMyNotificationSettings(payload);
    },

    async loadNotifications(page, pageSize, roles = []) {
        let targetRoles = ["ALL"];
        const normalizedRoles = roles.map((r) => String(r || "").trim().toLowerCase()).filter((r) => KNOWN_ROLES.includes(r));
        if (normalizedRoles.length > 0) targetRoles = [...targetRoles, ...normalizedRoles];
        const result = await backend.listNotifications({ unread: "true", page, limit: pageSize, target_role: targetRoles.join(",") });
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async loadTemplates(page, pageSize, filters) {
        const result = await backend.listPaginated("EmailTemplate", { page, limit: pageSize, q: JSON.stringify({ ...filters, template_scope: "WORKFLOW" }) });
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async loadSettings(page, pageSize) {
        const result = await backend.listPaginated("NotificationSetting", { page, limit: pageSize });
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async loadSlaRules(page, pageSize, filters) {
        const result = await backend.listPaginated("SlaRule", { page, limit: pageSize, q: JSON.stringify(filters) });
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async loadSystemConfigs() {
        return backend.list("SystemConfig");
    },

    async saveRule(rule) {
        if (rule.id) return backend.update("SlaRule", rule.id, rule);
        return backend.create("SlaRule", { ...rule, trigger_count: 0 });
    },

    async deleteRule(ruleId) {
        return backend.delete("SlaRule", ruleId);
    },

    async saveTemplate(template) {
        const payload = { ...template, template_scope: "WORKFLOW", status_from: "", status_to: template.status_to || "" };
        if (payload.id) return backend.update("EmailTemplate", payload.id, payload);
        return backend.create("EmailTemplate", payload);
    },

    async deleteTemplate(templateId) {
        return backend.delete("EmailTemplate", templateId);
    },

    async saveConfig(editingConfig, configData) {
        if (editingConfig) return backend.update("SystemConfig", editingConfig.id, configData);
        return backend.create("SystemConfig", configData);
    },

    async markNotificationRead(notifId) {
        return backend.updateNotification(notifId, { is_read: true });
    },

    async deleteSettings(ids) {
        for (const id of ids) await backend.delete("NotificationSetting", id);
    },
};
