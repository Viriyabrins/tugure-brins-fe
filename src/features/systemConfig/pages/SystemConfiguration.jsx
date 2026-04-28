import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Settings, Bell, Mail, MessageSquare, CheckCircle2, RefreshCw, Loader2,
    Plus, Edit, Trash2, AlertCircle,
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import FilterTab from "@/components/common/FilterTab";
import {
    DEFAULT_TEMPLATE_FILTER,
    DEFAULT_SLA_FILTER,
    EMAIL_TEMPLATE_ADMIN_ROLES,
    EMAIL_TEMPLATE_RECIPIENT_OPTIONS,
    NOTIFICATION_TYPE_CONFIG,
    WORKFLOW_ACTION_OPTIONS,
    WORKFLOW_AUDIENCE_OPTIONS,
    WORKFLOW_TEMPLATE_OBJECT_TYPES,
    WORKFLOW_TEMPLATE_VARIABLES,
} from "../utils/systemConfigConstants";
import { systemConfigService } from "../services/systemConfigService";
import { useSystemConfigData } from "../hooks/useSystemConfigData";

const DEFAULT_WORKFLOW_TEMPLATE = {
    template_scope: "WORKFLOW",
    object_type: "Debtor",
    recipient_role: "BRINS",
    status_from: "",
    status_to: "SUBMITTED",
    workflow_action: "UPLOAD",
    workflow_audience: "UPLOADER",
    email_subject: "",
    email_body: "",
    is_active: true,
};

const WORKFLOW_STATUS_MAP = {
    UPLOAD: "SUBMITTED",
    CHECK_BRINS: "CHECKED_BRINS",
    APPROVE_BRINS: "APPROVED_BRINS",
    CHECK_TUGURE: "CHECKED_TUGURE",
    APPROVE_FINAL: "APPROVED",
    REVISION: "REVISION",
};

const WORKFLOW_ACTION_LABELS = Object.fromEntries(WORKFLOW_ACTION_OPTIONS.map((option) => [option.value, option.label]));
const WORKFLOW_AUDIENCE_LABELS = Object.fromEntries(WORKFLOW_AUDIENCE_OPTIONS.map((option) => [option.value, option.label]));

export default function SystemConfiguration() {
    const data = useSystemConfigData();
    const {
        user, userRoles, keycloakUserId, loading, systemConfigs,
        emailTemplates, notificationSettings, slaRules,
        currentSetting, setCurrentSetting,
        templatePage, setTemplatePage, settingsPage, setSettingsPage,
        slaPage, setSlaPage, notifPage, setNotifPage,
        templateFilters, setTemplateFilters, slaFilters, setSlaFilters,
        tplPagination, stgPagination, slaPagination,
        loadTemplates, loadSettings, loadSlaRules, loadSystemConfigs, reloadAll,
    } = data;

    const [activeTab, setActiveTab] = useState("email-templates");
    const [showTemplateDialog, setShowTemplateDialog] = useState(false);
    const [showRuleDialog, setShowRuleDialog] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedRule, setSelectedRule] = useState(null);
    const [editingConfig, setEditingConfig] = useState(null);
    const [configKey, setConfigKey] = useState("");
    const [configValue, setConfigValue] = useState("");
    const [configDescription, setConfigDescription] = useState("");
    const [configIsActive, setConfigIsActive] = useState(true);
    const [selectedSettings, setSelectedSettings] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const normalizedRoles = (Array.isArray(userRoles) ? userRoles : []).map((role) => String(role || "").trim().toLowerCase());
    const canManageTemplates = EMAIL_TEMPLATE_ADMIN_ROLES.some((role) => normalizedRoles.includes(role));

    const handleSaveUserSettings = async () => {
        if (!keycloakUserId) return;
        setProcessing(true);
        try {
            const payload = { ...currentSetting, keycloak_user_id: keycloakUserId, user_email: currentSetting.user_email || currentSetting.notification_email || "", user_role: currentSetting.user_role || "" };
            delete payload.id;
            const result = await systemConfigService.upsertMyNotificationSettings(payload);
            if (result) setCurrentSetting(result);
            setSuccessMessage("Settings saved successfully");
            loadSettings(settingsPage);
        } catch (e) { console.error(e); }
        setProcessing(false);
    };

    const handleSaveTemplate = async () => {
        if (!selectedTemplate || !canManageTemplates) return;
        setProcessing(true);
        try {
            const payload = {
                ...selectedTemplate,
                template_scope: "WORKFLOW",
                status_to: WORKFLOW_STATUS_MAP[selectedTemplate.workflow_action] || selectedTemplate.status_to || "",
                status_from: "",
                workflow_action: selectedTemplate.workflow_action || "UPLOAD",
                workflow_audience: selectedTemplate.workflow_audience || "UPLOADER",
            };
            await systemConfigService.saveTemplate(payload);
            await loadTemplates(templatePage, templateFilters);
            setShowTemplateDialog(false); setSelectedTemplate(null);
            setSuccessMessage(selectedTemplate.id ? "Email template updated successfully" : "Email template created successfully");
        } catch (e) { console.error(e); setSuccessMessage("Failed to save template"); }
        setProcessing(false);
    };

    const handleDeleteTemplate = async (row) => {
        if (!canManageTemplates) return;
        if (!window.confirm("Delete this template?")) return;
        try {
            await systemConfigService.deleteTemplate(row.id);
            setSuccessMessage("Template deleted");
            loadTemplates(templatePage, templateFilters);
        } catch (e) { setSuccessMessage("Template already deleted or not found"); }
    };

    const openNewTemplateDialog = () => {
        setSelectedTemplate({ ...DEFAULT_WORKFLOW_TEMPLATE });
        setShowTemplateDialog(true);
    };

    const handleSaveConfig = async () => {
        setProcessing(true);
        try {
            const typeMap = { rules: "ELIGIBILITY_RULE", thresholds: "FINANCIAL_THRESHOLD", approval: "APPROVAL_MATRIX" };
            await systemConfigService.saveConfig(editingConfig, { config_type: typeMap[activeTab] || "ELIGIBILITY_RULE", config_key: configKey, config_value: configValue, description: configDescription, is_active: configIsActive, effective_date: new Date().toISOString().split("T")[0], status: "APPROVED" });
            setSuccessMessage("Configuration saved successfully"); setShowDialog(false);
            setConfigKey(""); setConfigValue(""); setConfigDescription(""); setConfigIsActive(true); setEditingConfig(null);
            const refreshed = await systemConfigService.loadSystemConfigs(); loadSystemConfigs();
        } catch (e) { console.error(e); }
        setProcessing(false);
    };

    const handleSaveRule = async () => {
        setProcessing(true);
        try {
            await systemConfigService.saveRule(selectedRule);
            await loadSlaRules(slaPage, slaFilters);
            setShowRuleDialog(false);
            setSuccessMessage("SLA rule saved successfully");
        } catch (e) { console.error(e); }
        setProcessing(false);
    };

    const handleDeleteSettings = async () => {
        if (!selectedSettings.length) return;
        setProcessing(true);
        try {
            await systemConfigService.deleteSettings(selectedSettings);
            setSuccessMessage(`Deleted ${selectedSettings.length} settings`);
            setSelectedSettings([]);
            loadSettings(settingsPage);
        } catch (e) { console.error(e); }
        setProcessing(false);
    };

    const emailTemplateColumns = [
        { header: "Object Type", cell: (row) => <span>{row.object_type}</span> },
        {
            header: "Workflow",
            cell: (row) => (
                <div className="space-y-1">
                    <p className="font-medium text-sm">{WORKFLOW_ACTION_LABELS[row.workflow_action] || row.workflow_action}</p>
                    <p className="text-xs text-gray-500">{WORKFLOW_AUDIENCE_LABELS[row.workflow_audience] || row.workflow_audience}</p>
                </div>
            ),
        },
        { header: "Recipient", cell: (row) => <Badge variant="outline">{row.recipient_role}</Badge> },
        { header: "Subject", cell: (row) => <span className="text-sm">{row.email_subject}</span> },
        { header: "Status", cell: (row) => <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${row.is_active ? "bg-green-500" : "bg-gray-300"}`} /><span className="text-sm">{row.is_active ? "Active" : "Inactive"}</span></div> },
        {
            header: "Actions",
            cell: (row) => (
                canManageTemplates ? (
                    <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTemplate({ ...row, template_scope: "WORKFLOW" }); setShowTemplateDialog(true); }}><Edit className="w-4 h-4" /></Button>
                        <Button type="button" variant="ghost" size="sm" onClick={async (e) => { e.stopPropagation(); await handleDeleteTemplate(row); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                ) : (
                    <span className="text-xs text-gray-400">Admin only</span>
                )
            ),
        },
    ];

    const settingsColumns = [
        {
            header: <Checkbox checked={selectedSettings.length === notificationSettings.length && notificationSettings.length > 0} onCheckedChange={(checked) => setSelectedSettings(checked ? notificationSettings.map((s) => s.id) : [])} />,
            cell: (row) => <Checkbox checked={selectedSettings.includes(row.id)} onCheckedChange={() => setSelectedSettings(selectedSettings.includes(row.id) ? selectedSettings.filter((id) => id !== row.id) : [...selectedSettings, row.id])} />,
            width: "50px",
        },
        { header: "User", cell: (row) => <div><p className="font-medium">{row.full_name || "No Name"}</p><StatusBadge status={row.user_role} className="mt-1" /></div> },
        { header: "Contact", cell: (row) => <div className="space-y-1"><div className="flex items-center gap-2"><Mail className={`w-4 h-4 ${row.email_enabled ? "text-green-600" : "text-gray-400"}`} /><span className="text-sm">{row.notification_email || "-"}</span></div><div className="flex items-center gap-2"><MessageSquare className={`w-4 h-4 ${row.whatsapp_enabled ? "text-green-600" : "text-gray-400"}`} /><span className="text-sm">{row.whatsapp_number || "-"}</span></div></div> },
        {
            header: "Active Notifications",
            cell: (row) => (
                <div className="flex flex-wrap gap-1">
                    {row.notify_batch_status && <Badge variant="outline" className="text-xs bg-blue-50">Batch</Badge>}
                    {row.notify_record_status && <Badge variant="outline" className="text-xs bg-indigo-50">Record</Badge>}
                    {row.notify_nota_status && <Badge variant="outline" className="text-xs bg-purple-50">Nota</Badge>}
                    {row.notify_bordero_status && <Badge variant="outline" className="text-xs bg-violet-50">Bordero</Badge>}
                    {row.notify_invoice_status && <Badge variant="outline" className="text-xs bg-fuchsia-50">Invoice</Badge>}
                    {row.notify_claim_status && <Badge variant="outline" className="text-xs bg-pink-50">Claim</Badge>}
                    {row.notify_subrogation_status && <Badge variant="outline" className="text-xs bg-orange-50">Subrogation</Badge>}
                    {row.notify_debit_credit_note && <Badge variant="outline" className="text-xs bg-amber-50">DN/CN</Badge>}
                    {row.notify_contract_status && <Badge variant="outline" className="text-xs bg-slate-50">Contract</Badge>}
                    {row.notify_payment_received && <Badge variant="outline" className="text-xs bg-green-50">Payment</Badge>}
                    {row.notify_approval_required && <Badge variant="outline" className="text-xs bg-yellow-50">Approval</Badge>}
                    {row.notify_document_verification && <Badge variant="outline" className="text-xs bg-teal-50">Document</Badge>}
                </div>
            ),
        },
        { header: "Actions", cell: (row) => <Button variant="ghost" size="sm" onClick={() => { setCurrentSetting(row); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Edit className="w-4 h-4" /></Button> },
    ];

    const slaColumns = [
        { header: "Rule Name", cell: (row) => <div><p className="font-medium">{row.rule_name}</p><div className="flex items-center gap-2 mt-1"><Badge variant="outline" className="text-xs">{row.entity_type}</Badge><Badge className={`text-xs ${row.priority === "CRITICAL" ? "bg-red-500" : row.priority === "HIGH" ? "bg-orange-500" : row.priority === "MEDIUM" ? "bg-yellow-500" : "bg-blue-500"}`}>{row.priority}</Badge></div></div> },
        { header: "Trigger Condition", cell: (row) => <div><p className="text-sm font-medium">{row.trigger_condition.replace(/_/g, " ")}</p>{row.status_value && <p className="text-xs text-gray-500">Status: {row.status_value}</p>}{row.duration_value && <p className="text-xs text-gray-500">Duration: {row.duration_value} {row.duration_unit?.toLowerCase()}</p>}</div> },
        { header: "Notification", cell: (row) => <div className="space-y-1"><Badge variant="outline">{row.notification_type}</Badge><p className="text-xs text-gray-500">To: {row.recipient_role}</p>{row.is_recurring && <Badge variant="outline" className="bg-orange-50 text-xs">Recurring: {row.recurrence_interval}h</Badge>}</div> },
        { header: "Status", cell: (row) => <div className="space-y-1"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${row.is_active ? "bg-green-500" : "bg-gray-300"}`} /><span className="text-sm">{row.is_active ? "Active" : "Inactive"}</span></div>{row.trigger_count > 0 && <p className="text-xs text-gray-500">Triggered: {row.trigger_count}x</p>}</div> },
        {
            header: "Actions",
            cell: (row) => (
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedRule(row); setShowRuleDialog(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={async () => { if (window.confirm("Delete this rule?")) { try { await systemConfigService.deleteRule(row.id); setSuccessMessage("Rule deleted"); loadSlaRules(slaPage, slaFilters); } catch (e) { setSuccessMessage("Rule already deleted or not found"); } } }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="System Configuration"
                subtitle="Manage notifications, settings, and system rules"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "System Configuration" }]}
                actions={<Button variant="outline" onClick={reloadAll}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>}
            />

            {successMessage && <Alert className="bg-green-50 border-green-200"><CheckCircle2 className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-700">{successMessage}</AlertDescription></Alert>}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-fit grid-cols-3">
                    <TabsTrigger value="email-templates"><Mail className="w-4 h-4 mr-2" />Email Templates</TabsTrigger>
                    <TabsTrigger value="notif-engine"><Settings className="w-4 h-4 mr-2" />Notif Engine</TabsTrigger>
                    <TabsTrigger value="notification-rules"><AlertCircle className="w-4 h-4 mr-2" />Notification by Rules</TabsTrigger>
                </TabsList>

                {/* ── Email Templates ─────────────────────────────────── */}
                <TabsContent value="email-templates" className="mt-4 space-y-6">
                    <FilterTab filters={templateFilters} onFilterChange={setTemplateFilters} defaultFilters={DEFAULT_TEMPLATE_FILTER}
                        filterConfig={[
                            { key: "object_type", label: "Object Type", options: [{ value: "all", label: "All Object Types" }, { value: "MasterContract", label: "Master Contract" }, { value: "Debtor", label: "Debtor" }, { value: "Claim", label: "Claim" }, { value: "Subrogation", label: "Subrogation" }] },
                        ]}
                    />
                    {!canManageTemplates && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>Only users with <code>admin-brins-role</code> or <code>admin-tugure-role</code> can create, edit, or delete email templates.</AlertDescription>
                        </Alert>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" disabled={!canManageTemplates} onClick={() => openNewTemplateDialog()}>
                            <Plus className="w-4 h-4 mr-2" />Add Template
                        </Button>
                    </div>
                    <DataTable columns={emailTemplateColumns} data={emailTemplates} isLoading={loading} pagination={tplPagination} onPageChange={setTemplatePage} />
                </TabsContent>

                {/* ── Notif Engine ─────────────────────────────────────── */}
                <TabsContent value="notif-engine" className="mt-4 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>My Notification Preferences</CardTitle><p className="text-sm text-gray-500">Configure your personal notification settings</p></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="space-y-4">
                                    <div><Label>Full Name</Label><Input type="text" value={currentSetting.full_name} onChange={(e) => setCurrentSetting({ ...currentSetting, full_name: e.target.value })} placeholder="Your full name" className="mt-1" /></div>
                                    <div><Label>Email for Notifications</Label><Input type="email" value={currentSetting.notification_email} onChange={(e) => setCurrentSetting({ ...currentSetting, notification_email: e.target.value })} placeholder="your.email@example.com" className="mt-1" /></div>
                                    <div><Label>WhatsApp Number</Label><Input type="tel" value={currentSetting.whatsapp_number} onChange={(e) => setCurrentSetting({ ...currentSetting, whatsapp_number: e.target.value })} placeholder="+62812345678" className="mt-1" /></div>
                                    <div className="flex items-center justify-between pt-4 border-t"><Label>Enable Email Notifications</Label><Switch checked={currentSetting.email_enabled} onCheckedChange={(c) => setCurrentSetting({ ...currentSetting, email_enabled: c })} /></div>
                                    <div className="flex items-center justify-between"><Label>Enable WhatsApp Notifications</Label><Switch checked={currentSetting.whatsapp_enabled} onCheckedChange={(c) => setCurrentSetting({ ...currentSetting, whatsapp_enabled: c })} /></div>
                                    <Button onClick={handleSaveUserSettings} disabled={processing} className="w-full bg-blue-600 hover:bg-blue-700">
                                        {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Save My Settings</>}
                                    </Button>
                                </div>
                                <div className="lg:col-span-2 space-y-3">
                                    <Label className="text-base font-semibold">Notification Types</Label>
                                    <p className="text-sm text-gray-500 mb-4">Select which workflow notifications you want to receive</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {NOTIFICATION_TYPE_CONFIG.map(({ key, label, description, color }) => (
                                            <div key={key} className={`flex items-start justify-between p-3 bg-${color}-50 border border-${color}-100 rounded-lg`}>
                                                <div className="flex-1 pr-3"><Label className="font-medium text-sm">{label}</Label><p className="text-xs text-gray-500 mt-0.5">{description}</p></div>
                                                <Switch checked={currentSetting[key]} onCheckedChange={(c) => setCurrentSetting({ ...currentSetting, [key]: c })} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div><CardTitle>All User Notification Settings</CardTitle><p className="text-sm text-gray-500 mt-1">Manage notification preferences for all users</p></div>
                                {selectedSettings.length > 0 && <Button variant="destructive" size="sm" onClick={handleDeleteSettings} disabled={processing}><Trash2 className="w-4 h-4 mr-2" />Delete ({selectedSettings.length})</Button>}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <DataTable columns={settingsColumns} data={notificationSettings} isLoading={loading} emptyMessage="No notification settings found" pagination={stgPagination} onPageChange={setSettingsPage} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Notification by Rules ────────────────────────────── */}
                <TabsContent value="notification-rules" className="mt-4 space-y-6">
                    <FilterTab filters={slaFilters} onFilterChange={setSlaFilters} defaultFilters={DEFAULT_SLA_FILTER}
                        filterConfig={[
                            { key: "ruleName", placeholder: "Search rules by name", label: "Rule Name", type: "input", inputType: "text" },
                            { key: "triggerCondition", label: "Condition", options: [{ value: "all", label: "All Conditions" }, { value: "STATUS_DURATION", label: "Status Duration" }, { value: "CREATED_DURATION", label: "Created Duration" }, { value: "DUE_DATE_APPROACHING", label: "Due Date Approaching" }, { value: "DUE_DATE_PASSED", label: "Due Date Passed" }] },
                            { key: "status", label: "Status", options: [{ value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
                        ]}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => { setSelectedRule({ rule_name: "", entity_type: "Debtor", trigger_condition: "STATUS_DURATION", status_value: "DRAFT", duration_value: 48, duration_unit: "HOURS", notification_type: "BOTH", recipient_role: "BRINS", email_subject: "", email_body: "", priority: "MEDIUM", is_active: true, is_recurring: false }); setShowRuleDialog(true); }}>
                            <Plus className="w-4 h-4 mr-2" />Add Rule
                        </Button>
                    </div>
                    <DataTable columns={slaColumns} data={slaRules} isLoading={loading} pagination={slaPagination} onPageChange={setSlaPage} emptyMessage="No SLA rules configured. Click 'Add Rule' to create automatic notifications." />
                    <Card className="bg-gray-50">
                        <CardHeader><CardTitle className="text-base">Example Use Cases</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {[["📋 Debtor Pending SLA", "IF Debtor status = 'PENDING' for more than 48 hours, THEN send email reminder to TUGURE"], ["⏰ Claim Review SLA", "IF Claim status = 'Draft' for more than 7 days, THEN send HIGH priority notification to TUGURE"], ["💰 Invoice Due Date Alert", "IF Invoice due_date approaching (3 days before), THEN send reminder to BRINS"], ["🔄 Payment Overdue", "IF Invoice due_date passed AND status != 'PAID', THEN send CRITICAL alert every 24h to BRINS"]].map(([title, desc]) => (
                                <div key={title} className="p-3 bg-white rounded-lg border"><p className="text-sm font-medium">{title}</p><p className="text-xs text-gray-600 mt-1">{desc}</p></div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ── SLA Rule Dialog ──────────────────────────────────────── */}
            <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{selectedRule?.id ? "Edit SLA Rule" : "Add SLA Rule"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Rule Name *</Label><Input value={selectedRule?.rule_name || ""} onChange={(e) => setSelectedRule({ ...selectedRule, rule_name: e.target.value })} placeholder="e.g., Debtor Pending 48h Alert" /></div>
                            <div>
                                <Label>Entity Type *</Label>
                                <select value={selectedRule?.entity_type || "Debtor"} onChange={(e) => setSelectedRule({ ...selectedRule, entity_type: e.target.value })} className="w-full border rounded-md px-3 py-2">
                                    {["MasterContract", "Debtor", "Batch", "Claim", "Subrogation", "Nota", "DebitCreditNote", "Invoice", "Payment", "PaymentIntent", "Document"].map((v) => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Trigger Condition *</Label>
                                <select value={selectedRule?.trigger_condition || "STATUS_DURATION"} onChange={(e) => setSelectedRule({ ...selectedRule, trigger_condition: e.target.value })} className="w-full border rounded-md px-3 py-2">
                                    <option value="STATUS_DURATION">Status Duration</option>
                                    <option value="CREATED_DURATION">Created Duration</option>
                                    <option value="UPDATED_DURATION">Updated Duration</option>
                                    <option value="DUE_DATE_APPROACHING">Due Date Approaching</option>
                                    <option value="DUE_DATE_PASSED">Due Date Passed</option>
                                </select>
                            </div>
                            <div>
                                <Label>Priority *</Label>
                                <select value={selectedRule?.priority || "MEDIUM"} onChange={(e) => setSelectedRule({ ...selectedRule, priority: e.target.value })} className="w-full border rounded-md px-3 py-2">
                                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        {selectedRule?.trigger_condition === "STATUS_DURATION" && <div><Label>Status Value *</Label><Input value={selectedRule?.status_value || ""} onChange={(e) => setSelectedRule({ ...selectedRule, status_value: e.target.value })} placeholder="e.g., PENDING, DRAFT" /></div>}
                        {selectedRule?.trigger_condition?.includes("DURATION") && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2"><Label>Duration Value *</Label><Input type="number" value={selectedRule?.duration_value || ""} onChange={(e) => setSelectedRule({ ...selectedRule, duration_value: parseInt(e.target.value) })} placeholder="e.g., 48" /></div>
                                <div>
                                    <Label>Unit *</Label>
                                    <select value={selectedRule?.duration_unit || "HOURS"} onChange={(e) => setSelectedRule({ ...selectedRule, duration_unit: e.target.value })} className="w-full border rounded-md px-3 py-2">
                                        <option value="HOURS">Hours</option><option value="DAYS">Days</option>
                                    </select>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Notification Type *</Label>
                                <select value={selectedRule?.notification_type || "BOTH"} onChange={(e) => setSelectedRule({ ...selectedRule, notification_type: e.target.value })} className="w-full border rounded-md px-3 py-2">
                                    <option value="EMAIL">Email Only</option><option value="SYSTEM">System Only</option><option value="BOTH">Both</option>
                                </select>
                            </div>
                            <div>
                                <Label>Recipient Role *</Label>
                                <select value={selectedRule?.recipient_role || "BRINS"} onChange={(e) => setSelectedRule({ ...selectedRule, recipient_role: e.target.value })} className="w-full border rounded-md px-3 py-2">
                                    {["BRINS", "TUGURE", "ADMIN", "ALL"].map((v) => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        <div><Label>Email Subject *</Label><Input value={selectedRule?.email_subject || ""} onChange={(e) => setSelectedRule({ ...selectedRule, email_subject: e.target.value })} placeholder="e.g., [SLA Alert] {entity_type} {entity_id} - {status}" /></div>
                        <div><Label>Email Body *</Label><Textarea value={selectedRule?.email_body || ""} onChange={(e) => setSelectedRule({ ...selectedRule, email_body: e.target.value })} rows={5} /><p className="text-xs text-gray-500 mt-1">Variables: {"{entity_id}, {entity_type}, {status}, {duration}, {date}"}</p></div>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div className="flex items-center justify-between"><Label>Active Rule</Label><Switch checked={selectedRule?.is_active !== false} onCheckedChange={(c) => setSelectedRule({ ...selectedRule, is_active: c })} /></div>
                            <div className="flex items-center justify-between"><Label>Recurring</Label><Switch checked={selectedRule?.is_recurring || false} onCheckedChange={(c) => setSelectedRule({ ...selectedRule, is_recurring: c })} /></div>
                        </div>
                        {selectedRule?.is_recurring && <div><Label>Recurrence Interval (hours)</Label><Input type="number" value={selectedRule?.recurrence_interval || 24} onChange={(e) => setSelectedRule({ ...selectedRule, recurrence_interval: parseInt(e.target.value) })} /></div>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRuleDialog(false)}>Cancel</Button>
                        <Button onClick={handleSaveRule} disabled={processing || !selectedRule?.rule_name || !selectedRule?.email_subject} className="bg-blue-600 hover:bg-blue-700">
                            {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Save Rule</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Email Template Dialog ────────────────────────────────── */}
            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>{selectedTemplate?.id ? "Edit Workflow Email Template" : "Add Workflow Email Template"}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Object Type</Label>
                                <select value={selectedTemplate?.object_type || "Debtor"} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, object_type: e.target.value })} className="w-full border rounded px-3 py-2">
                                    {WORKFLOW_TEMPLATE_OBJECT_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div>
                                <Label>Recipient Role</Label>
                                <select value={selectedTemplate?.recipient_role || "BRINS"} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, recipient_role: e.target.value })} className="w-full border rounded px-3 py-2">
                                    {EMAIL_TEMPLATE_RECIPIENT_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Workflow Action</Label>
                                <select
                                    value={selectedTemplate?.workflow_action || "UPLOAD"}
                                    onChange={(e) => setSelectedTemplate({
                                        ...selectedTemplate,
                                        workflow_action: e.target.value,
                                        status_to: WORKFLOW_STATUS_MAP[e.target.value] || "",
                                    })}
                                    className="w-full border rounded px-3 py-2"
                                >
                                    {WORKFLOW_ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <Label>Workflow Audience</Label>
                                <select value={selectedTemplate?.workflow_audience || "UPLOADER"} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, workflow_audience: e.target.value })} className="w-full border rounded px-3 py-2">
                                    {WORKFLOW_AUDIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div><Label>Email Subject</Label><Input value={selectedTemplate?.email_subject || ""} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, email_subject: e.target.value })} placeholder="Use variables: {batch_id}, {user_name}, {date}, etc" /></div>
                        <div>
                            <Label>Email Body</Label>
                            <Textarea value={selectedTemplate?.email_body || ""} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, email_body: e.target.value })} rows={8} />
                            <p className="text-xs text-gray-500 mt-1">Variables: {WORKFLOW_TEMPLATE_VARIABLES}</p>
                        </div>
                        <div className="flex items-center gap-2"><input type="checkbox" checked={selectedTemplate?.is_active !== false} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, is_active: e.target.checked })} className="rounded" /><Label>Active</Label></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
                        <Button onClick={handleSaveTemplate} disabled={processing || !canManageTemplates}>Save Template</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
