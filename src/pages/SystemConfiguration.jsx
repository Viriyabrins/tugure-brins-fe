import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Settings, Bell, Mail, MessageSquare, Shield, DollarSign, CheckCircle2, RefreshCw, Loader2, Plus, Edit, Trash2, Eye, User, TestTube, AlertCircle, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Filter, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { format } from 'date-fns';
import { backend } from '@/api/backendClient';
import FilterTab from '@/components/common/FilterTab';
import keycloakService from '@/services/keycloakService';
import NotificationList from '@/components/common/NotificationList';

const defaultTemplateFilter = {
  object_type: "all"
}

const defaultSlaFilter = {
  ruleName: "",
  triggerCondition: "all",
  status: "all",
}

export default function SystemConfiguration() {
  const [user, setUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [keycloakUserId, setKeycloakUserId] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [notificationSettings, setNotificationSettings] = useState([]);
  const [totalSettings, setTotalSettings] = useState(0);
  const [selectedSettings, setSelectedSettings] = useState([]);
  const [systemConfigs, setSystemConfigs] = useState([]);
  const [slaRules, setSlaRules] = useState([]);
  const [totalSlaRules, setTotalSlaRules] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('email-templates');
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [totalTemplates, setTotalTemplates] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [selectedRule, setSelectedRule] = useState(null);
  const [selectedRules, setSelectedRules] = useState([]);
  const [templateFilters, setTemplateFilters] = useState(defaultTemplateFilter);
  const [SlaFilters, setSlaFilters] = useState(defaultSlaFilter);
  const [ruleFilters, setRuleFilters] = useState(defaultSlaFilter);
  const [ruleSearchTerm, setRuleSearchTerm] = useState('');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showSettingDialog, setShowSettingDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  
  // Notifications Pagination (server-side)
  const [notifPage, setNotifPage] = useState(1);
  const notifPageSize = 10;
  const notifTotal = totalNotifications;
  const notifTotalPages = Math.max(1, Math.ceil(notifTotal / notifPageSize));
  const notifFrom = notifTotal === 0 ? 0 : (notifPage - 1) * notifPageSize + 1;
  const notifTo = Math.min(notifTotal, notifPage * notifPageSize);
  const pageNotifications = Array.isArray(notifications) ? notifications : [];
  
  // Email Template Pagination (server-side)
  const [templatePage, setTemplatePage] = useState(1);
  const templatePageSize = 10;
  const templateTotal = totalTemplates;
  const templateTotalPages = Math.max(1, Math.ceil(templateTotal / templatePageSize));
  const templateFrom = templateTotal === 0 ? 0 : (templatePage - 1) * templatePageSize + 1;
  const templateTo = Math.min(templateTotal, templatePage * templatePageSize);
  const pagedTemplates = Array.isArray(emailTemplates) ? emailTemplates : [];
  
  // Notification Settings Pagination (server-side)
  const [settingsPage, setSettingsPage] = useState(1);
  const settingsPageSize = 10;
  const settingsTotal = totalSettings;
  const settingsTotalPages = Math.max(1, Math.ceil(settingsTotal / settingsPageSize));
  const settingsFrom = settingsTotal === 0 ? 0 : (settingsPage - 1) * settingsPageSize + 1;
  const settingsTo = Math.min(settingsTotal, settingsPage * settingsPageSize);

  // SLA Rules Pagination (server-side)
  const [slaPage, setSlaPage] = useState(1);
  const slaPageSize = 10;
  const slaTotal = totalSlaRules;
  const slaTotalPages = Math.max(1, Math.ceil(slaTotal / slaPageSize));
  const slaFrom = slaTotal === 0 ? 0 : (slaPage - 1) * slaPageSize + 1;
  const slaTo = Math.min(slaTotal, slaPage * slaPageSize);
  const pagedSla = Array.isArray(slaRules) ? slaRules : [];


  // User notification setting
  const [currentSetting, setCurrentSetting] = useState({
    full_name: '',
    notification_email: '',
    whatsapp_number: '',
    email_enabled: true,
    whatsapp_enabled: false,
    notify_contract_status: true,
    notify_batch_status: true,
    notify_record_status: true,
    notify_nota_status: true,
    notify_claim_status: true,
    notify_subrogation_status: true,
    notify_bordero_status: true,
    notify_invoice_status: true,
    notify_payment_received: true,
    notify_approval_required: true,
    notify_document_verification: true,
    notify_debit_credit_note: true
  });

  // Config form
  const [configKey, setConfigKey] = useState('');
  const [configValue, setConfigValue] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadUser();
    backend.list('SystemConfig').then(configData => {
      setSystemConfigs(configData || []);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  // Keep page within bounds
  useEffect(() => {
    if (notifPage > notifTotalPages && notifTotalPages > 0) setNotifPage(notifTotalPages);
  }, [notifTotalPages, notifPage]);

  useEffect(() => {
    if (templatePage > templateTotalPages && templateTotalPages > 0) setTemplatePage(templateTotalPages);
  }, [templateTotalPages, templatePage]);

  useEffect(() => {
    if (settingsPage > settingsTotalPages && settingsTotalPages > 0) setSettingsPage(settingsTotalPages);
  }, [settingsTotalPages, settingsPage]);

  useEffect(() => {
    if (slaPage > slaTotalPages && slaTotalPages > 0) setSlaPage(slaTotalPages);
  }, [slaTotalPages, slaPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (templatePage !== 1) setTemplatePage(1);
  }, [templateFilters.object_type]);

  useEffect(() => {
    if (slaPage !== 1) setSlaPage(1);
  }, [SlaFilters.ruleName, SlaFilters.triggerCondition, SlaFilters.status]);

  // Reload when page or filters change
  useEffect(() => {
    if (isUserLoaded) {
      loadNotifications(notifPage, userRoles);
    }
  }, [notifPage, userRoles, isUserLoaded]);
  useEffect(() => { loadTemplates(templatePage); }, [templatePage, templateFilters.object_type]);
  useEffect(() => { loadSettings(settingsPage); }, [settingsPage]);
  useEffect(() => { loadSlaRules(slaPage); }, [slaPage, SlaFilters.ruleName, SlaFilters.triggerCondition, SlaFilters.status]);

  // Load User and their notification settings
  const loadUser = async () => {
    try {
      const { default: keycloakService } = await import('@/services/keycloakService');
      const userInfo = keycloakService.getCurrentUserInfo();
      if (userInfo) {
        const roles = keycloakService.getRoles();
        const roleList = Array.isArray(roles) ? roles : [];
        setUserRoles(roleList);
        setKeycloakUserId(userInfo.id);

        // Fetch existing notification settings for this user
        try {
          const existingSettings = await backend.getMyNotificationSettings(userInfo.id);
          if (existingSettings) {
            setCurrentSetting(existingSettings);
          } else {
            // Pre-fill from Keycloak token if no saved settings
            const actor = keycloakService.getAuditActor();
            setCurrentSetting(prev => ({
              ...prev,
              full_name: userInfo.name || '',
              notification_email: userInfo.email || '',
              user_email: userInfo.email || '',
              user_role: actor.user_role || '',
            }));
          }
        } catch (settingsError) {
          console.error('Failed to load user notification settings:', settingsError);
          // Still pre-fill from Keycloak on error
          const actor = keycloakService.getAuditActor();
          setCurrentSetting(prev => ({
            ...prev,
            full_name: userInfo.name || '',
            notification_email: userInfo.email || '',
            user_email: userInfo.email || '',
            user_role: actor.user_role || '',
          }));
        }

        setIsUserLoaded(true);
        return roleList;
      }
    } catch (error) {
      console.error("Failed to load user:", error);
    }
    setIsUserLoaded(true);
    return [];
  };

  // --- Dedicated paginated load functions ---

  const loadNotifications = async (pageToLoad = notifPage, roles = userRoles) => {
    try {
      let targetRoles = ["ALL"];
      if (roles && roles.length > 0) {
        const normalizedRoles = roles.map((r) => String(r || "").trim().toLowerCase());
        const knownRoles = ["maker-brins-role", "checker-brins-role", "approver-brins-role", "checker-tugure-role", "approver-tugure-role", "admin", "admin-brins-role"];
        const matchedRoles = normalizedRoles.filter(r => knownRoles.includes(r));
        if (matchedRoles.length > 0) {
          targetRoles = [...targetRoles, ...matchedRoles];
        }
      }

      const result = await backend.listNotifications({
        unread: 'true',
        page: pageToLoad,
        limit: notifPageSize,
        target_role: targetRoles.join(',')
      });
      console.log('Role', targetRoles);
      console.log('Notification', result);
      setNotifications(Array.isArray(result.data) ? result.data : []);
      setTotalNotifications(Number(result.pagination?.total) || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
      setTotalNotifications(0);
    }
  };

  const loadTemplates = async (pageToLoad = templatePage) => {
    try {
      const result = await backend.listPaginated('EmailTemplate', {
        page: pageToLoad,
        limit: templatePageSize,
        q: JSON.stringify(templateFilters),
      });
      console.log('EmailTemplate', result)
      setEmailTemplates(Array.isArray(result.data) ? result.data : []);
      setTotalTemplates(Number(result.pagination?.total) || 0);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setEmailTemplates([]);
      setTotalTemplates(0);
    }
  };

  const loadSettings = async (pageToLoad = settingsPage) => {
    try {
      const result = await backend.listPaginated('NotificationSetting', {
        page: pageToLoad,
        limit: settingsPageSize,
      });
      setNotificationSettings(Array.isArray(result.data) ? result.data : []);
      setTotalSettings(Number(result.pagination?.total) || 0);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setNotificationSettings([]);
      setTotalSettings(0);
    }
  };

  const loadSlaRules = async (pageToLoad = slaPage) => {
    try {
      const result = await backend.listPaginated('SlaRule', {
        page: pageToLoad,
        limit: slaPageSize,
        q: JSON.stringify(SlaFilters),
      });
      setSlaRules(Array.isArray(result.data) ? result.data : []);
      setTotalSlaRules(Number(result.pagination?.total) || 0);
    } catch (error) {
      console.error('Failed to load SLA rules:', error);
      setSlaRules([]);
      setTotalSlaRules(0);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const configData = await backend.list('SystemConfig');
      setSystemConfigs(configData || []);

      await Promise.all([
        loadNotifications(notifPage, userRoles),
        loadTemplates(templatePage),
        loadSettings(settingsPage),
        loadSlaRules(slaPage),
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleSaveUserSettings = async () => {
    if (!keycloakUserId) {
      console.error('No Keycloak user ID available');
      return;
    }
    setProcessing(true);
    try {
      const payload = {
        ...currentSetting,
        keycloak_user_id: keycloakUserId,
        user_email: currentSetting.user_email || currentSetting.notification_email || '',
        user_role: currentSetting.user_role || '',
      };
      // Remove the 'id' field so the upsert can work on keycloak_user_id
      delete payload.id;
      const result = await backend.upsertMyNotificationSettings(payload);
      if (result) setCurrentSetting(result);
      setSuccessMessage('Settings saved successfully');
      loadSettings(settingsPage);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    setProcessing(false);
  };

  const handleSaveConfig = async () => {
    setProcessing(true);
    try {
      const typeMap = {
        'rules': 'ELIGIBILITY_RULE',
        'thresholds': 'FINANCIAL_THRESHOLD',
        'approval': 'APPROVAL_MATRIX'
      };
      
      const configData = {
        config_type: typeMap[activeTab === 'rules' ? 'rules' : activeTab === 'thresholds' ? 'thresholds' : 'approval'],
        config_key: configKey,
        config_value: configValue,
        description: description,
        is_active: isActive,
        effective_date: new Date().toISOString().split('T')[0],
        status: 'APPROVED'
      };

      if (editingConfig) {
        await backend.update('SystemConfig', editingConfig.id, configData);
      } else {
        await backend.create('SystemConfig', configData);
      }

      setSuccessMessage('Configuration saved successfully');
      setShowDialog(false);
      resetForm();
      const refreshedConfigs = await backend.list('SystemConfig');
      setSystemConfigs(refreshedConfigs || []);
    } catch (error) {
      console.error('Save error:', error);
    }
    setProcessing(false);
  };

    const handleCreateTemplate = async (template) => {
      try {
        setProcessing(true);
        await backend.create('EmailTemplate', template);
        await loadTemplates(templatePage);
        setShowTemplateDialog(false);
        setSelectedTemplate(null);
        setSuccessMessage('Email template created successfully');
      } catch (error) {
        console.error('Failed to create template:', error);
        setSuccessMessage('Failed to create template');
      } finally {
        setProcessing(false);
      }
    };

    const handleEditTemplate = (row) => {
      setSelectedTemplate({ ...row }); 
      setShowTemplateDialog(true);
    };

    const handleUpdateTemplate = async (template) => {
      try {
        setProcessing(true);
        await backend.update('EmailTemplate', template.id, template);
        await loadTemplates(templatePage);
        setShowTemplateDialog(false);
        setSelectedTemplate(null);
        setSuccessMessage('Email template updated successfully');
      } catch (error) {
        console.error('Failed to update template:', error);
        setSuccessMessage('Failed to update template');
      } finally {
        setProcessing(false);
      }
    };

    const handleOpenCreateTemplate = () => {
      setSelectedTemplate({
        object_type: 'Batch',
        recipient_role: 'BRINS',
        status_from: '',
        status_to: '',
        email_subject: '',
        email_body: '',
        is_active: true
      });
      setShowTemplateDialog(true);
    };

    const handleSaveTemplate = async () => {
      if (!selectedTemplate) return;
      if (selectedTemplate.id) {
        await handleUpdateTemplate(selectedTemplate);
      } else {
        await handleCreateTemplate(selectedTemplate);
      }
    };

    const handleDeleteTemplate = async (row) => {
      if (!window.confirm('Delete this template?')) return;
      try {
        await backend.delete('EmailTemplate', row.id);
        setSuccessMessage('Template deleted');
        loadTemplates(templatePage);
      } catch (error) {
        console.error('Delete error:', error);
        setSuccessMessage('Template already deleted or not found');
      }
    };

  const handleMarkAsRead = async (notifId) => {
    try {
      await backend.updateNotification(notifId, { is_read: true });
      loadNotifications(notifPage);
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const handleDeleteSettings = async () => {
    if (selectedSettings.length === 0) return;
    
    setProcessing(true);
    try {
      for (const id of selectedSettings) {
        await backend.delete('NotificationSetting', id);
      }
      setSuccessMessage(`Deleted ${selectedSettings.length} settings`);
      setSelectedSettings([]);
      loadSettings(settingsPage);
    } catch (error) {
      console.error('Delete error:', error);
    }
    setProcessing(false);
  };

  const toggleSettingSelection = (id) => {
    if (selectedSettings.includes(id)) {
      setSelectedSettings(selectedSettings.filter(sid => sid !== id));
    } else {
      setSelectedSettings([...selectedSettings, id]);
    }
  };

  const resetForm = () => {
    setConfigKey('');
    setConfigValue('');
    setDescription('');
    setIsActive(true);
    setEditingConfig(null);
  };

  const openEditDialog = (config) => {
    setEditingConfig(config);
    setConfigKey(config.config_key);
    setConfigValue(config.config_value);
    setDescription(config.description || '');
    setIsActive(config.is_active);
    setShowDialog(true);
  };

  const getConfigsByType = (type) => {
    const typeMap = {
      'rules': 'ELIGIBILITY_RULE',
      'thresholds': 'FINANCIAL_THRESHOLD',
      'approval': 'APPROVAL_MATRIX'
    };
    return systemConfigs.filter(c => c.config_type === typeMap[type]);
  };

  const emailTemplateColumns = [
    {
      header: "Object Type",
      cell: (row) => (
        <span>{row.object_type}</span>
      )
    },
    {
      header: 'Status Transition',
      accessorKey: 'status_to',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.status_from && <span className="text-gray-500">{row.status_from} →</span>}
          <span className="font-medium">{row.status_to}</span>
        </div>
      )
    },
    {
      header: 'Recipient',
      accessorKey: 'recipient_role',
      cell: (row) => <Badge variant="outline">{row.recipient_role}</Badge>
    },
    {
      header: 'Subject',
      accessorKey: 'email_subject',
      cell: (row) => <span className="text-sm">{row.email_subject}</span>
    },
    {
      header: 'Status',
      accessorKey: 'is_active',
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${row.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm">{row.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-1">
          <Button 
            type="button"
            variant="ghost" 
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleEditTemplate(row); }}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button 
            type="button"
            variant="ghost" 
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();
              await handleDeleteTemplate(row);
            }}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      )
    }
  ]

  const configColumns = [
    { header: 'Config Key', cell: (row) => <span className="font-mono text-sm">{row.config_key}</span> },
    { header: 'Value', accessorKey: 'config_value' },
    { header: 'Description', accessorKey: 'description' },
    { 
      header: 'Status',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${row.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm">{row.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => openEditDialog(row)}>
          <Edit className="w-4 h-4" />
        </Button>
      )
    }
  ];

  const settingsColumns = [
    {
      header: (
        <Checkbox
          checked={selectedSettings.length === notificationSettings.length && notificationSettings.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedSettings(notificationSettings.map(s => s.id));
            } else {
              setSelectedSettings([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedSettings.includes(row.id)}
          onCheckedChange={() => toggleSettingSelection(row.id)}
        />
      ),
      width: '50px'
    },
    {
      header: 'User',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.full_name || 'No Name'}</p>
          <StatusBadge status={row.user_role} className="mt-1" />
        </div>
      )
    },
    {
      header: 'Contact',
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Mail className={`w-4 h-4 ${row.email_enabled ? 'text-green-600' : 'text-gray-400'}`} />
            <span className="text-sm">{row.notification_email || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className={`w-4 h-4 ${row.whatsapp_enabled ? 'text-green-600' : 'text-gray-400'}`} />
            <span className="text-sm">{row.whatsapp_number || '-'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Active Notifications',
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
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => {
          setCurrentSetting(row);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}>
          <Edit className="w-4 h-4" />
        </Button>
      )
    }
  ];

  const SlaColumns = [
    {
      header: 'Rule Name',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.rule_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">{row.entity_type}</Badge>
            <Badge className={`text-xs ${row.priority === 'CRITICAL' ? 'bg-red-500' : row.priority === 'HIGH' ? 'bg-orange-500' : row.priority === 'MEDIUM' ? 'bg-yellow-500' : 'bg-blue-500'}`}>
              {row.priority}
            </Badge>
          </div>
        </div>
      )
    },
    {
      header: 'Trigger Condition',
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">{row.trigger_condition.replace(/_/g, ' ')}</p>
          {row.status_value && <p className="text-xs text-gray-500">Status: {row.status_value}</p>}
          {row.duration_value && (
            <p className="text-xs text-gray-500">
              Duration: {row.duration_value} {row.duration_unit?.toLowerCase()}
            </p>
          )}
        </div>
      )
    },
    {
      header: 'Notification',
      cell: (row) => (
        <div className="space-y-1">
          <Badge variant="outline">{row.notification_type}</Badge>
          <p className="text-xs text-gray-500">To: {row.recipient_role}</p>
          {row.is_recurring && (
            <Badge variant="outline" className="bg-orange-50 text-xs">
              Recurring: {row.recurrence_interval}h
            </Badge>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${row.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm">{row.is_active ? 'Active' : 'Inactive'}</span>
          </div>
          {row.trigger_count > 0 && (
            <p className="text-xs text-gray-500">Triggered: {row.trigger_count}x</p>
          )}
        </div>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSelectedRule(row);
              setShowRuleDialog(true);
            }}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={async () => {
              if (window.confirm('Delete this rule?')) {
                try {
                  await backend.delete('SlaRule', row.id);
                  setSuccessMessage('Rule deleted');
                } catch (error) {
                  console.error('Delete error:', error);
                  setSuccessMessage('Rule already deleted or not found');
                }
                loadData();
              }
            }}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Configuration"
        subtitle="Manage notifications, settings, and system rules"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'System Configuration' }
        ]}
        actions={
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-fit grid-cols-3">
          {/* <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications ({notifTotal})
          </TabsTrigger> */}
          <TabsTrigger value="email-templates">
            <Mail className="w-4 h-4 mr-2" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="notif-engine">
            <Settings className="w-4 h-4 mr-2" />
            Notif Engine
          </TabsTrigger>
          <TabsTrigger value="notification-rules">
            <AlertCircle className="w-4 h-4 mr-2" />
            Notification by Rules
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        {/* <TabsContent value="notifications" className="mt-4">
          <NotificationList/>
        </TabsContent> */}

        {/* Email Templates Tab */}
        <TabsContent value="email-templates" className="mt-4 space-y-6">
          <FilterTab
            filters={templateFilters}
            onFilterChange={setTemplateFilters}
            defaultFilters={defaultTemplateFilter}
            filterConfig={[
              {
                key: "object_type",
                label: "Object Type",
                options: [
                  {value: "all", label: "All Object Types"},
                  {value: "MasterContract", label: "Master Contract"},
                  {value: "Batch", label: "Batch"},
                  {value: "Record", label: "Record"},
                  {value: "Nota", label: "Nota"},
                  {value: "Debtor", label: "Debtor"},
                  {value: "Claim", label: "Claim"},
                  {value: "Subrogation", label: "Subrogation"},
                  {value: "DebitCreditNote", label: "Debit/Credit Note"},
                  {value: "PaymentIntent", label: "Payment Intent"},
                ]
              }
            ]}
          />

          <div className='flex flex-wrap gap-2'>
            <Button 
              variant="outline"
              onClick={handleOpenCreateTemplate}>
                <Plus className="w-4 h-4 mr-2" />
                Add Template
              </Button>
          </div>

          <DataTable
            columns={emailTemplateColumns}
            data={pagedTemplates}
            isLoading={loading}
            pagination={{ from: templateFrom, to: templateTo, total: templateTotal, page: templatePage, totalPages: templateTotalPages }}
            onPageChange={(p) => setTemplatePage(p)}
          />
        </TabsContent>

        {/* Notif Engine Tab */}
        <TabsContent value="notif-engine" className="mt-4 space-y-6">
          {/* My Settings Section */}
          <Card>
            <CardHeader>
              <CardTitle>My Notification Preferences</CardTitle>
              <p className="text-sm text-gray-500">Configure your personal notification settings</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      type="text"
                      value={currentSetting.full_name}
                      onChange={(e) => setCurrentSetting({...currentSetting, full_name: e.target.value})}
                      placeholder="Your full name"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Email for Notifications</Label>
                    <Input
                      type="email"
                      value={currentSetting.notification_email}
                      onChange={(e) => setCurrentSetting({...currentSetting, notification_email: e.target.value})}
                      placeholder="your.email@example.com"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>WhatsApp Number</Label>
                    <Input
                      type="tel"
                      value={currentSetting.whatsapp_number}
                      onChange={(e) => setCurrentSetting({...currentSetting, whatsapp_number: e.target.value})}
                      placeholder="+62812345678"
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <Label>Enable Email Notifications</Label>
                    <Switch
                      checked={currentSetting.email_enabled}
                      onCheckedChange={(checked) => setCurrentSetting({...currentSetting, email_enabled: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Enable WhatsApp Notifications</Label>
                    <Switch
                      checked={currentSetting.whatsapp_enabled}
                      onCheckedChange={(checked) => setCurrentSetting({...currentSetting, whatsapp_enabled: checked})}
                    />
                  </div>

                  <Button
                    onClick={handleSaveUserSettings}
                    disabled={processing}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Save My Settings
                      </>
                    )}
                  </Button>
                </div>

                <div className="lg:col-span-2 space-y-3">
                  <Label className="text-base font-semibold">Notification Types</Label>
                  <p className="text-sm text-gray-500 mb-4">Select which workflow notifications you want to receive</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'notify_contract_status', label: 'Master Contract Status', description: 'Draft → Pending Approvals → Active/Rejected', color: 'slate' },
                      { key: 'notify_batch_status', label: 'Batch Status', description: 'Uploaded → Validated → Matched → Approved → Paid → Closed', color: 'blue' },
                      { key: 'notify_record_status', label: 'Record Status', description: 'Accepted → Revised → Rejected', color: 'indigo' },
                      { key: 'notify_nota_status', label: 'Nota Status', description: 'Draft → Issued → Confirmed → Paid', color: 'purple' },
                      { key: 'notify_bordero_status', label: 'Bordero Status', description: 'Generated → Under Review → Final', color: 'violet' },
                      { key: 'notify_invoice_status', label: 'Invoice Status', description: 'Issued → Partially Paid → Paid', color: 'fuchsia' },
                      { key: 'notify_claim_status', label: 'Claim Status', description: 'Draft → Checked → Doc Verified → Invoiced → Paid', color: 'pink' },
                      { key: 'notify_subrogation_status', label: 'Subrogation Status', description: 'Draft → Invoiced → Paid/Closed', color: 'orange' },
                      { key: 'notify_debit_credit_note', label: 'Debit/Credit Note', description: 'Draft → Under Review → Approved/Rejected → Acknowledged', color: 'amber' },
                      { key: 'notify_payment_received', label: 'Payment Received', description: 'Payment confirmations and matching', color: 'green' },
                      { key: 'notify_approval_required', label: 'Approval Required', description: 'Actions requiring your approval', color: 'yellow' },
                      { key: 'notify_document_verification', label: 'Document Verification', description: 'Document upload and verification updates', color: 'teal' }
                    ].map(({ key, label, description, color }) => (
                      <div key={key} className={`flex items-start justify-between p-3 bg-${color}-50 border border-${color}-100 rounded-lg`}>
                        <div className="flex-1 pr-3">
                          <Label className="font-medium text-sm">{label}</Label>
                          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                        </div>
                        <Switch
                          checked={currentSetting[key]}
                          onCheckedChange={(checked) => setCurrentSetting({...currentSetting, [key]: checked})}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All User Settings Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All User Notification Settings</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Manage notification preferences for all users</p>
                </div>
                {selectedSettings.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSettings}
                    disabled={processing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete ({selectedSettings.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={settingsColumns}
                data={notificationSettings}
                isLoading={loading}
                emptyMessage="No notification settings found"
                pagination={{ from: settingsFrom, to: settingsTo, total: settingsTotal, page: settingsPage, totalPages: settingsTotalPages }}
                onPageChange={(p) => setSettingsPage(p)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification by Rules Tab */}
        <TabsContent value="notification-rules" className="mt-4 space-y-6">
          {/* <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              <strong>SLA & Auto Notification Rules:</strong> Atur notifikasi otomatis berdasarkan durasi status, due date, atau kondisi tertentu.
              <br/><br/>
              <strong>⚙️ Cara Kerja:</strong>
              <br/>• <strong>Konfigurasi Rules:</strong> Anda dapat setup rules lengkap di sini (sudah tersedia 21 contoh real)
              <br/>• <strong>Auto-Trigger Engine:</strong> Memerlukan backend scheduler yang monitoring entities setiap periode dan auto-trigger notifikasi berdasarkan rules
              <br/>• <strong>Status Saat Ini:</strong> Rules tersimpan di database dan siap digunakan. Untuk auto-trigger otomatis, perlu aktivasi backend functions di app settings
              <br/><br/>
              <strong>💡 Alternatif Tanpa Backend:</strong> Notifikasi manual saat workflow action (sudah terintegrasi di Batch Processing, Claim Review, dll)
            </AlertDescription>
          </Alert> */}
          
          <FilterTab
            filters={SlaFilters}
            onFilterChange={setSlaFilters}
            defaultFilters={defaultSlaFilter}
            filterConfig={[
              {
                key: 'ruleName',
                placeholder: 'Search rules by name',
                label: 'Rule Name',
                type: 'input',
                inputType: "text"
              },
              {
                key: "triggerCondition",
                label: "Condition",
                options: [
                  {value: "all", label: "All Conditions"},
                  {value: "STATUS_DURATION", label: "Status Duration"},
                  {value: "CREATED_DURATION", label: "Created Duration"},
                  {value: "DUE_DATE_APPROACHING", label: "Dude Date Approaching"},
                  {value: "DUE_DATE_PASSED", label: "Due Date Passed"},
                ]
              },
              {
                key: 'status',
                label: 'Status',
                options: [
                  {value: "all", label: "All Status"},
                  {value: "active", label: "Active"},
                  {value: "inactive", label: "Inactive"},
                ]
              },
            ]}
          />
          
          <div className='flex flex-wrap gap-2'>
            <Button
                variant="outline"
                onClick={() => {
                  setSelectedRule({
                    rule_name: '',
                    entity_type: 'Debtor',
                    trigger_condition: 'STATUS_DURATION',
                    status_value: 'DRAFT',
                    duration_value: 48,
                    duration_unit: 'HOURS',
                    notification_type: 'BOTH',
                    recipient_role: 'BRINS',
                    email_subject: '',
                    email_body: '',
                    priority: 'MEDIUM',
                    is_active: true,
                    is_recurring: false
                  });
                  setShowRuleDialog(true);
                }}
            >
              <Plus className="w-4 h-4 mr-2" />
                Add Rule
            </Button>
          </div>
          
          <DataTable
            columns={SlaColumns}
            data={pagedSla}
            isLoading={loading}
            pagination={{from: slaFrom, to: slaTo, total: slaTotal, page: slaPage, totalPages: slaTotalPages }}
            onPageChange={(p) => setSlaPage(p)}
            emptyMessage="No SLA rules configured. Click 'Add Rule' to create automatic notifications."
          />

          {/* Rule Examples */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-base">Example Use Cases</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-sm font-medium">📋 Debtor Pending SLA</p>
                <p className="text-xs text-gray-600 mt-1">
                  "IF Debtor status = 'PENDING' for more than 48 hours, THEN send email reminder to TUGURE"
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-sm font-medium">⏰ Claim Review SLA</p>
                <p className="text-xs text-gray-600 mt-1">
                  "IF Claim status = 'Draft' for more than 7 days, THEN send HIGH priority notification to TUGURE"
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-sm font-medium">💰 Invoice Due Date Alert</p>
                <p className="text-xs text-gray-600 mt-1">
                  "IF Invoice due_date approaching (3 days before), THEN send reminder to BRINS"
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-sm font-medium">🔄 Payment Overdue</p>
                <p className="text-xs text-gray-600 mt-1">
                  "IF Invoice due_date passed AND status != 'PAID', THEN send CRITICAL alert every 24h to BRINS"
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* SLA Rule Dialog */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRule?.id ? 'Edit SLA Rule' : 'Add SLA Rule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rule Name *</Label>
                <Input
                  value={selectedRule?.rule_name || ''}
                  onChange={(e) => setSelectedRule({ ...selectedRule, rule_name: e.target.value })}
                  placeholder="e.g., Debtor Pending 48h Alert"
                />
              </div>
              <div>
                <Label>Entity Type *</Label>
                <select
                  value={selectedRule?.entity_type || 'Debtor'}
                  onChange={(e) => setSelectedRule({ ...selectedRule, entity_type: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="MasterContract">Master Contract</option>
                  <option value="Debtor">Debtor</option>
                  <option value="Batch">Batch</option>
                  <option value="Claim">Claim</option>
                  <option value="Subrogation">Subrogation</option>
                  <option value="Nota">Nota</option>
                  <option value="DebitCreditNote">Debit/Credit Note</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Payment">Payment</option>
                  <option value="PaymentIntent">Payment Intent</option>
                  <option value="Document">Document</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Trigger Condition *</Label>
                <select
                  value={selectedRule?.trigger_condition || 'STATUS_DURATION'}
                  onChange={(e) => setSelectedRule({ ...selectedRule, trigger_condition: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="STATUS_DURATION">Status Duration (time in specific status)</option>
                  <option value="CREATED_DURATION">Created Duration (time since created)</option>
                  <option value="UPDATED_DURATION">Updated Duration (time since last update)</option>
                  <option value="DUE_DATE_APPROACHING">Due Date Approaching</option>
                  <option value="DUE_DATE_PASSED">Due Date Passed</option>
                </select>
              </div>
              <div>
                <Label>Priority *</Label>
                <select
                  value={selectedRule?.priority || 'MEDIUM'}
                  onChange={(e) => setSelectedRule({ ...selectedRule, priority: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            {(selectedRule?.trigger_condition === 'STATUS_DURATION') && (
              <div>
                <Label>Status Value *</Label>
                <Input
                  value={selectedRule?.status_value || ''}
                  onChange={(e) => setSelectedRule({ ...selectedRule, status_value: e.target.value })}
                  placeholder="e.g., PENDING, DRAFT, etc"
                />
              </div>
            )}

            {(selectedRule?.trigger_condition?.includes('DURATION')) && (
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label>Duration Value *</Label>
                  <Input
                    type="number"
                    value={selectedRule?.duration_value || ''}
                    onChange={(e) => setSelectedRule({ ...selectedRule, duration_value: parseInt(e.target.value) })}
                    placeholder="e.g., 48"
                  />
                </div>
                <div>
                  <Label>Unit *</Label>
                  <select
                    value={selectedRule?.duration_unit || 'HOURS'}
                    onChange={(e) => setSelectedRule({ ...selectedRule, duration_unit: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="HOURS">Hours</option>
                    <option value="DAYS">Days</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Notification Type *</Label>
                <select
                  value={selectedRule?.notification_type || 'BOTH'}
                  onChange={(e) => setSelectedRule({ ...selectedRule, notification_type: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="EMAIL">Email Only</option>
                  <option value="SYSTEM">System Notification Only</option>
                  <option value="BOTH">Both Email & System</option>
                </select>
              </div>
              <div>
                <Label>Recipient Role *</Label>
                <select
                  value={selectedRule?.recipient_role || 'BRINS'}
                  onChange={(e) => setSelectedRule({ ...selectedRule, recipient_role: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="BRINS">BRINS</option>
                  <option value="TUGURE">TUGURE</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="ALL">ALL</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Email Subject *</Label>
              <Input
                value={selectedRule?.email_subject || ''}
                onChange={(e) => setSelectedRule({ ...selectedRule, email_subject: e.target.value })}
                placeholder="e.g., [SLA Alert] {entity_type} {entity_id} - {status}"
              />
            </div>

            <div>
              <Label>Email Body *</Label>
              <Textarea
                value={selectedRule?.email_body || ''}
                onChange={(e) => setSelectedRule({ ...selectedRule, email_body: e.target.value })}
                rows={6}
                placeholder="Dear Team,&#10;&#10;{entity_type} {entity_id} has been in status {status} for {duration} hours.&#10;&#10;Please take action."
              />
              <p className="text-xs text-gray-500 mt-1">
                Available variables: {'{entity_id}, {entity_type}, {status}, {duration}, {date}'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label>Active Rule</Label>
                <Switch
                  checked={selectedRule?.is_active !== false}
                  onCheckedChange={(checked) => setSelectedRule({ ...selectedRule, is_active: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Recurring Notification</Label>
                <Switch
                  checked={selectedRule?.is_recurring || false}
                  onCheckedChange={(checked) => setSelectedRule({ ...selectedRule, is_recurring: checked })}
                />
              </div>
            </div>

            {selectedRule?.is_recurring && (
              <div>
                <Label>Recurrence Interval (hours)</Label>
                <Input
                  type="number"
                  value={selectedRule?.recurrence_interval || 24}
                  onChange={(e) => setSelectedRule({ ...selectedRule, recurrence_interval: parseInt(e.target.value) })}
                  placeholder="e.g., 24 (send notification every 24 hours)"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>Cancel</Button>
            <Button 
              onClick={async () => {
                setProcessing(true);
                try {
                  if (selectedRule?.id) {
                    await backend.update('SlaRule', selectedRule.id, selectedRule);
                  } else {
                    await backend.create('SlaRule', {
                      ...selectedRule,
                      trigger_count: 0
                    });
                  }
                  await loadSlaRules(slaPage);
                  setShowRuleDialog(false);
                  setSuccessMessage('SLA rule saved successfully');
                } catch (error) {
                  console.error('Failed to save rule:', error);
                }
                setProcessing(false);
              }}
              disabled={processing || !selectedRule?.rule_name || !selectedRule?.email_subject}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save Rule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.id ? 'Edit Email Template' : 'Add Email Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Object Type</Label>
                <select
                  value={selectedTemplate?.object_type || 'Batch'}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, object_type: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="MasterContract">Master Contract</option>
                  <option value="Batch">Batch</option>
                  <option value="Record">Record</option>
                  <option value="Nota">Nota</option>
                  <option value="Debtor">Debtor</option>
                  <option value="Claim">Claim</option>
                  <option value="Subrogation">Subrogation</option>
                  <option value="DebitCreditNote">Debit/Credit Note</option>
                  <option value="PaymentIntent">Payment Intent</option>
                </select>
              </div>
              <div>
                <Label>Recipient Role</Label>
                <select
                  value={selectedTemplate?.recipient_role || 'BRINS'}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, recipient_role: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="BRINS">BRINS</option>
                  <option value="TUGURE">TUGURE</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="ALL">ALL</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status From (Optional)</Label>
                <Input
                  value={selectedTemplate?.status_from || ''}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, status_from: e.target.value })}
                  placeholder="e.g., Uploaded"
                />
              </div>
              <div>
                <Label>Status To</Label>
                <Input
                  value={selectedTemplate?.status_to || ''}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, status_to: e.target.value })}
                  placeholder="e.g., Validated"
                />
              </div>
            </div>

            <div>
              <Label>Email Subject</Label>
              <Input
                value={selectedTemplate?.email_subject || ''}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, email_subject: e.target.value })}
                placeholder="Use variables: {batch_id}, {user_name}, {date}, etc"
              />
            </div>

            <div>
              <Label>Email Body</Label>
              <Textarea
                value={selectedTemplate?.email_body || ''}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, email_body: e.target.value })}
                rows={8}
                placeholder="Use variables: {batch_id}, {user_name}, {date}, {total_premium}, etc"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available variables: {'{batch_id}, {user_name}, {date}, {total_records}, {total_premium}, {amount}, {claim_no}, {debtor_name}'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedTemplate?.is_active !== false}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, is_active: e.target.checked })}
                className="rounded"
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                if (selectedTemplate?.id) {
                  await backend.update('EmailTemplate', selectedTemplate.id, selectedTemplate);
                } else {
                  await backend.create('EmailTemplate', selectedTemplate);
                }
                await loadTemplates(templatePage);
                setShowTemplateDialog(false);
                setSuccessMessage('Email template saved successfully');
              } catch (error) {
                console.error('Failed to save template:', error);
              }
            }}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Edit Configuration' : 'Add Configuration'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Config Key *</Label>
              <Input
                value={configKey}
                onChange={(e) => setConfigKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                placeholder="e.g., MAX_LOAN_AMOUNT"
              />
            </div>
            <div>
              <Label>Config Value *</Label>
              <Input
                value={configValue}
                onChange={(e) => setConfigValue(e.target.value)}
                placeholder="Enter value"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this configuration..."
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={processing || !configKey || !configValue}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}