import { useState, useEffect } from "react";
import { SC_PAGE_SIZE, DEFAULT_TEMPLATE_FILTER, DEFAULT_SLA_FILTER, DEFAULT_NOTIFICATION_SETTING } from "../utils/systemConfigConstants";
import { systemConfigService } from "../services/systemConfigService";

export function useSystemConfigData() {
    const [user, setUser] = useState(null);
    const [userRoles, setUserRoles] = useState([]);
    const [keycloakUserId, setKeycloakUserId] = useState(null);
    const [isUserLoaded, setIsUserLoaded] = useState(false);

    const [systemConfigs, setSystemConfigs] = useState([]);
    const [emailTemplates, setEmailTemplates] = useState([]);
    const [totalTemplates, setTotalTemplates] = useState(0);
    const [notificationSettings, setNotificationSettings] = useState([]);
    const [totalSettings, setTotalSettings] = useState(0);
    const [slaRules, setSlaRules] = useState([]);
    const [totalSlaRules, setTotalSlaRules] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [totalNotifications, setTotalNotifications] = useState(0);
    const [loading, setLoading] = useState(true);

    const [currentSetting, setCurrentSetting] = useState(DEFAULT_NOTIFICATION_SETTING);

    const [templatePage, setTemplatePage] = useState(1);
    const [settingsPage, setSettingsPage] = useState(1);
    const [slaPage, setSlaPage] = useState(1);
    const [notifPage, setNotifPage] = useState(1);
    const [templateFilters, setTemplateFilters] = useState(DEFAULT_TEMPLATE_FILTER);
    const [slaFilters, setSlaFilters] = useState(DEFAULT_SLA_FILTER);

    useEffect(() => {
        (async () => {
            try {
                const result = await systemConfigService.loadUser();
                if (result) {
                    const { userInfo, roles, actor } = result;
                    setUserRoles(roles);
                    setKeycloakUserId(userInfo.id);
                    try {
                        const existing = await systemConfigService.getMyNotificationSettings(userInfo.id);
                        if (existing) {
                            setCurrentSetting(existing);
                        } else {
                            setCurrentSetting((prev) => ({ ...prev, full_name: userInfo.name || "", notification_email: userInfo.email || "", user_email: userInfo.email || "", user_role: actor?.user_role || "" }));
                        }
                    } catch (e) {
                        setCurrentSetting((prev) => ({ ...prev, full_name: userInfo.name || "", notification_email: userInfo.email || "", user_email: userInfo.email || "", user_role: actor?.user_role || "" }));
                    }
                    setUser({ id: userInfo.id, email: userInfo.email, full_name: userInfo.name, role: actor?.user_role || "" });
                }
            } catch (e) { console.error("Failed to load user:", e); }
            setIsUserLoaded(true);
        })();
        loadSystemConfigs();
    }, []);

    // Reload data loaders on page/filter changes
    useEffect(() => {
        if (isUserLoaded) loadNotifications(notifPage, userRoles);
    }, [notifPage, userRoles, isUserLoaded]);

    useEffect(() => { loadTemplates(templatePage, templateFilters); }, [templatePage, templateFilters.object_type]);
    useEffect(() => { loadSettings(settingsPage); }, [settingsPage]);
    useEffect(() => { loadSlaRules(slaPage, slaFilters); }, [slaPage, slaFilters.ruleName, slaFilters.triggerCondition, slaFilters.status]);

    // Reset pages on filter changes
    useEffect(() => { setTemplatePage(1); }, [templateFilters.object_type]);
    useEffect(() => { setSlaPage(1); }, [slaFilters.ruleName, slaFilters.triggerCondition, slaFilters.status]);

    const loadSystemConfigs = async () => {
        try { const data = await systemConfigService.loadSystemConfigs(); setSystemConfigs(data || []); setLoading(false); } catch (e) { console.error(e); setLoading(false); }
    };

    const loadNotifications = async (page = notifPage, roles = userRoles) => {
        try { const { data, total } = await systemConfigService.loadNotifications(page, SC_PAGE_SIZE, roles); setNotifications(data); setTotalNotifications(total); } catch (e) { console.error(e); }
    };

    const loadTemplates = async (page = templatePage, filters = templateFilters) => {
        try { const { data, total } = await systemConfigService.loadTemplates(page, SC_PAGE_SIZE, filters); setEmailTemplates(data); setTotalTemplates(total); } catch (e) { console.error(e); }
    };

    const loadSettings = async (page = settingsPage) => {
        try { const { data, total } = await systemConfigService.loadSettings(page, SC_PAGE_SIZE); setNotificationSettings(data); setTotalSettings(total); } catch (e) { console.error(e); }
    };

    const loadSlaRules = async (page = slaPage, filters = slaFilters) => {
        try { const { data, total } = await systemConfigService.loadSlaRules(page, SC_PAGE_SIZE, filters); setSlaRules(data); setTotalSlaRules(total); } catch (e) { console.error(e); }
    };

    const reloadAll = async () => {
        setLoading(true);
        await loadSystemConfigs();
        await Promise.all([loadNotifications(), loadTemplates(), loadSettings(), loadSlaRules()]);
        setLoading(false);
    };

    // Toggle notification preference for a specific channel
    const toggleNotificationChannel = (notificationType, channel) => {
        if (channel === "email") {
            setCurrentSetting(prev => ({ ...prev, [`email_${notificationType}`]: !prev[`email_${notificationType}`] }));
        } else if (channel === "inapp") {
            setCurrentSetting(prev => ({ ...prev, [`inapp_${notificationType}`]: !prev[`inapp_${notificationType}`] }));
        }
    };

    // Pagination helpers
    const tpl = { from: totalTemplates === 0 ? 0 : (templatePage - 1) * SC_PAGE_SIZE + 1, to: Math.min(totalTemplates, templatePage * SC_PAGE_SIZE), total: totalTemplates, page: templatePage, totalPages: Math.max(1, Math.ceil(totalTemplates / SC_PAGE_SIZE)) };
    const stg = { from: totalSettings === 0 ? 0 : (settingsPage - 1) * SC_PAGE_SIZE + 1, to: Math.min(totalSettings, settingsPage * SC_PAGE_SIZE), total: totalSettings, page: settingsPage, totalPages: Math.max(1, Math.ceil(totalSettings / SC_PAGE_SIZE)) };
    const sla = { from: totalSlaRules === 0 ? 0 : (slaPage - 1) * SC_PAGE_SIZE + 1, to: Math.min(totalSlaRules, slaPage * SC_PAGE_SIZE), total: totalSlaRules, page: slaPage, totalPages: Math.max(1, Math.ceil(totalSlaRules / SC_PAGE_SIZE)) };

    return {
        user, userRoles, keycloakUserId, loading,
        systemConfigs, emailTemplates, notificationSettings, slaRules,
        notifications, totalNotifications,
        currentSetting, setCurrentSetting, toggleNotificationChannel,
        templatePage, setTemplatePage, settingsPage, setSettingsPage,
        slaPage, setSlaPage, notifPage, setNotifPage,
        templateFilters, setTemplateFilters, slaFilters, setSlaFilters,
        tplPagination: tpl, stgPagination: stg, slaPagination: sla,
        loadTemplates, loadSettings, loadSlaRules, loadNotifications,
        loadSystemConfigs, reloadAll,
    };
}
