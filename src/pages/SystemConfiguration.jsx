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
import { 
  Settings, Bell, Mail, MessageSquare, Shield, DollarSign, 
  CheckCircle2, RefreshCw, Loader2, Plus, Edit, Trash2, Eye, User, TestTube, AlertCircle
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { format } from 'date-fns';

export default function SystemConfiguration() {
  const [user, setUser] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationSettings, setNotificationSettings] = useState([]);
  const [selectedSettings, setSelectedSettings] = useState([]);
  const [systemConfigs, setSystemConfigs] = useState([]);
  const [slaRules, setSlaRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notifications');
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [selectedRule, setSelectedRule] = useState(null);
  const [selectedRules, setSelectedRules] = useState([]);
  const [templateFilters, setTemplateFilters] = useState({ objectType: 'all' });
  const [ruleFilters, setRuleFilters] = useState({ triggerCondition: 'all', status: 'all' });
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
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const [configData, notifData, settingsData, templates, rules] = await Promise.all([
        base44.entities.SystemConfig.list(),
        base44.entities.Notification.list(),
        base44.entities.NotificationSetting.list(),
        base44.entities.EmailTemplate.list(),
        base44.entities.SlaRule.list()
      ]);
      
      // Create sample data if any is empty
      const needsSampleData = !configData || configData.length === 0 || 
                              !notifData || notifData.length === 0 ||
                              !templates || templates.length === 0 ||
                              !rules || rules.length === 0;
      
      setSystemConfigs(configData || []);
      setNotifications(notifData || []);
      setEmailTemplates(templates || []);
      setSlaRules(rules || []);
      
      setNotificationSettings(settingsData || []);
      
      const userSetting = settingsData.find(s => s.user_email === currentUser.email);
      if (userSetting) {
        setCurrentSetting(userSetting);
      } else {
        setCurrentSetting(prev => ({
          ...prev,
          full_name: currentUser.full_name || currentUser.email,
          user_email: currentUser.email
        }));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const createSampleConfigs = async () => {
    const sampleConfigs = [
      // Eligibility Rules
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MAX_LOAN_TENURE_MONTHS', config_value: '120', description: 'Maximum loan tenure allowed for coverage (months)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MIN_LOAN_AMOUNT_IDR', config_value: '10000000', description: 'Minimum loan amount eligible for coverage (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MAX_DEBTOR_AGE', config_value: '65', description: 'Maximum age of debtor at time of application', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'KOLEKTIBILITAS_THRESHOLD', config_value: '2', description: 'Maximum collectibility level allowed (0=Normal, 1=DPK, 2=KL)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'REQUIRED_DOCS_INDIVIDUAL', config_value: '4', description: 'Number of required documents for Individual credit type', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'REQUIRED_DOCS_CORPORATE', config_value: '6', description: 'Number of required documents for Corporate credit type', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      
      // Financial Thresholds
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'COVERAGE_PERCENTAGE', config_value: '70', description: 'Default coverage percentage for reinsurance', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'PREMIUM_RATE_INDIVIDUAL', config_value: '0.85', description: 'Premium rate for individual credit (as % of exposure)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'PREMIUM_RATE_CORPORATE', config_value: '0.65', description: 'Premium rate for corporate credit (as % of exposure)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'MAX_CLAIM_AMOUNT_IDR', config_value: '5000000000', description: 'Maximum claimable amount per debtor (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'LATE_PAYMENT_PENALTY_RATE', config_value: '0.5', description: 'Late payment penalty rate per month (%)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'PAYMENT_GRACE_PERIOD_DAYS', config_value: '30', description: 'Grace period before late payment penalty applies', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      
      // Approval Matrix
      { config_type: 'APPROVAL_MATRIX', config_key: 'DEBTOR_AUTO_APPROVE_LIMIT', config_value: '100000000', description: 'Auto-approve debtors with exposure below this amount (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'CLAIM_AUTO_APPROVE_LIMIT', config_value: '50000000', description: 'Auto-approve claims below this amount (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'REQUIRES_SENIOR_APPROVAL', config_value: '500000000', description: 'Amount requiring senior management approval (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'DEBTOR_REVIEW_SLA_HOURS', config_value: '48', description: 'SLA for debtor review and approval (hours)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'CLAIM_REVIEW_SLA_DAYS', config_value: '14', description: 'SLA for claim review and decision (days)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' }
    ];

    for (const config of sampleConfigs) {
      try {
        await base44.entities.SystemConfig.create(config);
      } catch (error) {
        console.error('Failed to create sample config:', error);
      }
    }
    
    // Create sample notifications - Complete workflow coverage
    const sampleNotifications = [
      // Batch Workflow
      {
        title: '[Batch] Status Updated: Uploaded → Validated',
        message: 'Batch BATCH-2025-001 has been validated by tugure@company.com. Total 45 records validated. Email notification sent to brins@company.com with validation details.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Batch] Status Updated: Validated → Matched',
        message: 'Batch BATCH-2025-001 has been matched by system. 45 records matched successfully. Matching process completed. Email notification sent to both parties.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      {
        title: '[Batch] Status Updated: Matched → Approved',
        message: 'Batch BATCH-2025-001 with total premium IDR 125,000,000 has been approved by tugure@company.com. Ready for Nota issuance. Auto email sent to BRINS.',
        type: 'DECISION',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Batch] Status Updated: Approved → Nota Issued',
        message: 'Batch BATCH-2025-001 - Nota has been issued. Nota number: NOTA-2025-001. Total amount: IDR 125,000,000. Email sent to brins@company.com for branch confirmation.',
        type: 'ACTION_REQUIRED',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Batch] Status Updated: Nota Issued → Branch Confirmed',
        message: 'Batch BATCH-2025-001 - Branch has confirmed Nota NOTA-2025-001. Waiting for payment. Email notification sent to tugure@company.com.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'TUGURE'
      },
      {
        title: '[Batch] Status Updated: Branch Confirmed → Paid',
        message: 'Batch BATCH-2025-001 - Payment received for Nota NOTA-2025-001. Amount: IDR 125,000,000. Payment date: 2025-01-15. Email sent to both parties.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      {
        title: '[Batch] Status Updated: Paid → Closed',
        message: 'Batch BATCH-2025-001 has been closed successfully. All processes completed. Final reconciliation done. Email sent to all stakeholders.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      
      // Record Workflow
      {
        title: '[Record] Status Updated: Accepted → Revised',
        message: 'Record REC-2025-001 in Batch BATCH-2025-002 marked as Revised. Reason: Incomplete documentation. Please resubmit corrected data. Email sent to brins@company.com.',
        type: 'WARNING',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Record] Status Updated: Revised → Accepted',
        message: 'Record REC-2025-001 has been re-validated and accepted. Corrections verified successfully. Email sent to brins@company.com.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Record] Status Updated: Accepted → Rejected',
        message: 'Record REC-2025-003 has been rejected permanently. Reason: Non-eligible debtor - exceeds age limit. Email sent to brins@company.com with rejection details.',
        type: 'WARNING',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      
      // Nota Workflow
      {
        title: '[Nota] Status Updated: Draft → Issued',
        message: 'Nota NOTA-2025-002 has been issued for Batch BATCH-2025-002. Total amount: IDR 85,500,000. Issued date: 2025-01-10. Email sent to brins@company.com.',
        type: 'ACTION_REQUIRED',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Nota] Status Updated: Issued → Confirmed',
        message: 'Nota NOTA-2025-002 has been confirmed by Branch on 2025-01-12. Confirmed by: branch_manager@brins.com. Email notification sent to tugure@company.com for payment processing.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'TUGURE'
      },
      {
        title: '[Nota] Status Updated: Confirmed → Paid',
        message: 'Nota NOTA-2025-002 payment completed. Amount paid: IDR 85,500,000. Payment reference: PAY-2025-002. Email sent to all parties.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      
      // Claim Workflow
      {
        title: '[Claim] Status Updated: Draft → Checked',
        message: 'Claim CLM-2025-001 for debtor PT ABC has been checked and eligibility verified. Claim amount: IDR 50,000,000. Email notification sent to brins@company.com.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Claim] Status Updated: Checked → Doc Verified',
        message: 'Claim CLM-2025-001 - All supporting documents verified successfully. Next step: invoicing. Verified by: claim_officer@tugure.com. Email sent to finance team.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'TUGURE'
      },
      {
        title: '[Claim] Status Updated: Doc Verified → Invoiced',
        message: 'Claim CLM-2025-001 has been invoiced. Invoice number: INV-CLM-2025-001. Amount: IDR 50,000,000. Email sent to brins@company.com.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Claim] Status Updated: Invoiced → Paid',
        message: 'Claim CLM-2025-001 payment completed. Settlement amount: IDR 50,000,000. Settlement date: 2025-01-20. Email sent to all parties.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      
      // Subrogation Workflow
      {
        title: '[Subrogation] Status Updated: Draft → Invoiced',
        message: 'Subrogation SUB-2025-001 for Claim CLM-2025-001 has been invoiced. Recovery amount: IDR 25,000,000. Invoice sent. Email sent to BRINS.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Subrogation] Status Updated: Invoiced → Paid / Closed',
        message: 'Subrogation SUB-2025-001 completed and closed. Recovery received: IDR 25,000,000. Final settlement done. Email sent to all stakeholders.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      }
    ];
    
    for (const notif of sampleNotifications) {
      try {
        await base44.entities.Notification.create(notif);
      } catch (error) {
        console.error('Failed to create sample notification:', error);
      }
    }
    
    // Create sample email templates - Complete end-to-end workflow
    const sampleTemplates = [
      // === MASTER CONTRACT WORKFLOW ===
      {
        object_type: 'MasterContract',
        status_from: 'Draft',
        status_to: 'Pending First Approval',
        recipient_role: 'TUGURE',
        email_subject: '[Contract {contract_id}] First Approval Required',
        email_body: 'Dear TUGURE Team,\n\nMaster Contract {contract_id} requires first approval.\n\nContract Details:\n- Policy: {policy_number}\n- Coverage Limit: {coverage_limit}\n- Share: {reinsurance_share}%\n\nPlease review and approve.\n\nBest regards,\nSystem',
        is_active: true
      },
      {
        object_type: 'MasterContract',
        status_from: 'Pending First Approval',
        status_to: 'Pending Second Approval',
        recipient_role: 'ADMIN',
        email_subject: '[Contract {contract_id}] Second Approval Required',
        email_body: 'Dear Admin,\n\nMaster Contract {contract_id} requires second approval.\n\nFirst approved by: {user_name}\nDate: {date}\n\nPlease review and approve.\n\nBest regards,\nSystem',
        is_active: true
      },
      {
        object_type: 'MasterContract',
        status_from: 'Pending Second Approval',
        status_to: 'Active',
        recipient_role: 'ALL',
        email_subject: '[Contract {contract_id}] Activated',
        email_body: 'Dear Team,\n\nMaster Contract {contract_id} is now active.\n\nApproved by: {user_name}\nDate: {date}\n\nContract is ready for batch submissions.\n\nBest regards,\nSystem',
        is_active: true
      },
      
      // === BATCH WORKFLOW ===
      {
        object_type: 'Batch',
        status_from: 'Uploaded',
        status_to: 'Validated',
        recipient_role: 'BRINS',
        email_subject: '[Batch {batch_id}] Validated Successfully',
        email_body: 'Dear BRINS Team,\n\nBatch {batch_id} validated by {user_name} on {date}.\n\nValidation Summary:\n- Total Records: {total_records}\n- Total Premium: {total_premium}\n\nNext: Matching process.\n\nBest regards,\nTUGURE System',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Validated',
        status_to: 'Matched',
        recipient_role: 'ALL',
        email_subject: '[Batch {batch_id}] Matching Completed',
        email_body: 'Dear Team,\n\nBatch {batch_id} matching process completed on {date}.\n\nMatching Results:\n- Records Matched: {total_records}\n- Total Premium Matched: {total_premium}\n\nNext Step: Approval review by TUGURE team.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Matched',
        status_to: 'Approved',
        recipient_role: 'BRINS',
        email_subject: '[Batch {batch_id}] Approved for Coverage',
        email_body: 'Dear BRINS Team,\n\nBatch {batch_id} has been approved by {user_name}.\n\nApproval Details:\n- Approval Date: {date}\n- Total Exposure: {total_exposure}\n- Total Premium: {total_premium}\n- Approved Records: {total_records}\n\nNext Step: Nota will be issued within 24 hours.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Approved',
        status_to: 'Nota Issued',
        recipient_role: 'BRINS',
        email_subject: '[Batch {batch_id}] Nota Issued - Action Required',
        email_body: 'Dear BRINS Team,\n\nNota has been issued for Batch {batch_id}.\n\nNota Details:\n- Nota Number: {nota_number}\n- Issue Date: {date}\n- Total Amount: {total_premium}\n\nAction Required: Please confirm receipt at your branch within 3 business days.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Nota Issued',
        status_to: 'Branch Confirmed',
        recipient_role: 'TUGURE',
        email_subject: '[Batch {batch_id}] Branch Confirmation Received',
        email_body: 'Dear TUGURE Team,\n\nBranch has confirmed receipt of Nota for Batch {batch_id}.\n\nConfirmation Details:\n- Confirmed by: {user_name}\n- Confirmation Date: {date}\n- Nota Amount: {total_premium}\n\nNext Step: Please proceed with payment processing.\n\nBest regards,\nBRINS System',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Branch Confirmed',
        status_to: 'Paid',
        recipient_role: 'ALL',
        email_subject: '[Batch {batch_id}] Payment Received',
        email_body: 'Dear Team,\n\nPayment received for Batch {batch_id}.\n\nPayment Details:\n- Payment Date: {date}\n- Amount Paid: {total_premium}\n- Payment Reference: {payment_reference}\n\nNext Step: Batch will be closed after final reconciliation.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Paid',
        status_to: 'Closed',
        recipient_role: 'ALL',
        email_subject: '[Batch {batch_id}] Batch Closed Successfully',
        email_body: 'Dear Team,\n\nBatch {batch_id} has been closed successfully.\n\nFinal Summary:\n- Total Records: {total_records}\n- Total Exposure: {total_exposure}\n- Total Premium: {total_premium}\n- Closed Date: {date}\n\nAll processes completed. Batch is now archived.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      
      // === RECORD WORKFLOW ===
      {
        object_type: 'Record',
        status_from: 'Accepted',
        status_to: 'Revised',
        recipient_role: 'BRINS',
        email_subject: '[Record {record_id}] Revision Required',
        email_body: 'Dear BRINS Team,\n\nRecord {record_id} in Batch {batch_id} requires revision.\n\nRevision Details:\n- Reason: {revision_reason}\n- Revised Date: {date}\n- Reviewed by: {user_name}\n\nAction Required: Please submit corrected information within 5 business days.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Record',
        status_from: 'Revised',
        status_to: 'Accepted',
        recipient_role: 'BRINS',
        email_subject: '[Record {record_id}] Re-validation Accepted',
        email_body: 'Dear BRINS Team,\n\nRecord {record_id} has been re-validated and accepted.\n\nAcceptance Details:\n- Re-validation Date: {date}\n- Validated by: {user_name}\n- Batch: {batch_id}\n\nRecord is now included in the active batch.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Record',
        status_from: 'Accepted',
        status_to: 'Rejected',
        recipient_role: 'BRINS',
        email_subject: '[Record {record_id}] Record Rejected',
        email_body: 'Dear BRINS Team,\n\nRecord {record_id} has been permanently rejected.\n\nRejection Details:\n- Reason: {rejection_reason}\n- Rejection Date: {date}\n- Reviewed by: {user_name}\n\nThis record will not be covered under the reinsurance policy.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      
      // === NOTA WORKFLOW ===
      {
        object_type: 'Nota',
        status_from: 'Draft',
        status_to: 'Issued',
        recipient_role: 'BRINS',
        email_subject: '[Nota {nota_number}] Nota Issued',
        email_body: 'Dear BRINS Team,\n\nNota {nota_number} has been issued.\n\nNota Details:\n- Type: {nota_type}\n- Reference: {reference_id}\n- Amount: {amount}\n- Issue Date: {date}\n\nAction Required: Please confirm receipt at your branch.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Nota',
        status_from: 'Issued',
        status_to: 'Confirmed',
        recipient_role: 'TUGURE',
        email_subject: '[Nota {nota_number}] Branch Confirmation',
        email_body: 'Dear TUGURE Team,\n\nNota {nota_number} has been confirmed by Branch.\n\nConfirmation Details:\n- Confirmed by: {user_name}\n- Confirmation Date: {date}\n- Amount: {amount}\n\nNext Step: Please proceed with payment processing.\n\nBest regards,\nBRINS System',
        is_active: true
      },
      {
        object_type: 'Nota',
        status_from: 'Confirmed',
        status_to: 'Paid',
        recipient_role: 'ALL',
        email_subject: '[Nota {nota_number}] Payment Completed',
        email_body: 'Dear Team,\n\nPayment completed for Nota {nota_number}.\n\nPayment Details:\n- Amount Paid: {amount}\n- Payment Date: {date}\n- Payment Reference: {payment_reference}\n\nNota is now fully settled.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      
      // === DEBTOR REVIEW WORKFLOW ===
      {
        object_type: 'Debtor',
        status_from: 'SUBMITTED',
        status_to: 'APPROVED',
        recipient_role: 'BRINS',
        email_subject: '[Debtor {debtor_name}] Approved',
        email_body: 'Dear BRINS Team,\n\nDebtor {debtor_name} approved.\n\nDetails:\n- Plafond: {plafond}\n- Premium: {premium}\n- Approved by: {user_name}\n\nBest regards,\nTUGURE System',
        is_active: true
      },
      {
        object_type: 'Debtor',
        status_from: 'SUBMITTED',
        status_to: 'REJECTED',
        recipient_role: 'BRINS',
        email_subject: '[Debtor {debtor_name}] Rejected - Revision Needed',
        email_body: 'Dear BRINS Team,\n\nDebtor {debtor_name} rejected.\n\nReason: {remarks}\nRejected by: {user_name}\n\nPlease revise and resubmit.\n\nBest regards,\nTUGURE System',
        is_active: true
      },
      
      // === CLAIM WORKFLOW ===
      {
        object_type: 'Claim',
        status_from: 'Draft',
        status_to: 'Checked',
        recipient_role: 'BRINS',
        email_subject: '[Claim {claim_no}] Checked',
        email_body: 'Claim {claim_no} checked by {user_name}.\n\nNext: Doc verification.\n\nBest regards,\nTUGURE System',
        is_active: true
      },
      {
        object_type: 'Claim',
        status_from: 'Checked',
        status_to: 'Doc Verified',
        recipient_role: 'TUGURE',
        email_subject: '[Claim {claim_no}] Documents Verified',
        email_body: 'Dear TUGURE Team,\n\nAll supporting documents for Claim {claim_no} have been verified.\n\nVerification Details:\n- Claim Amount: {claim_amount}\n- Verified Date: {date}\n- Verified by: {user_name}\n\nNext Step: Invoicing process.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      {
        object_type: 'Claim',
        status_from: 'Doc Verified',
        status_to: 'Invoiced',
        recipient_role: 'BRINS',
        email_subject: '[Claim {claim_no}] Claim Invoiced',
        email_body: 'Dear BRINS Team,\n\nClaim {claim_no} has been invoiced.\n\nInvoice Details:\n- Invoice Number: {invoice_number}\n- Invoice Amount: {claim_amount}\n- Invoice Date: {date}\n\nNext Step: Payment processing within SLA.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Claim',
        status_from: 'Invoiced',
        status_to: 'Paid',
        recipient_role: 'ALL',
        email_subject: '[Claim {claim_no}] Settlement Completed',
        email_body: 'Dear Team,\n\nClaim {claim_no} settlement completed.\n\nSettlement Details:\n- Settlement Amount: {claim_amount}\n- Settlement Date: {date}\n- Payment Reference: {settlement_ref}\n\nClaim is now fully settled and closed.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      
      // === SUBROGATION WORKFLOW ===
      {
        object_type: 'Subrogation',
        status_from: 'Draft',
        status_to: 'Invoiced',
        recipient_role: 'BRINS',
        email_subject: '[Subrogation {subrogation_id}] Recovery Invoice Issued',
        email_body: 'Dear BRINS Team,\n\nSubrogation invoice issued for Claim {claim_id}.\n\nSubrogation Details:\n- Subrogation ID: {subrogation_id}\n- Recovery Amount: {recovery_amount}\n- Invoice Date: {date}\n\nPlease process recovery payment.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Subrogation',
        status_from: 'Invoiced',
        status_to: 'Paid / Closed',
        recipient_role: 'ALL',
        email_subject: '[Subrogation {subrogation_id}] Recovery Completed',
        email_body: 'Dear Team,\n\nSubrogation {subrogation_id} completed and closed.\n\nRecovery Summary:\n- Recovery Amount: {recovery_amount}\n- Recovery Date: {date}\n- Related Claim: {claim_id}\n\nSubrogation process is now complete.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      
      // === DEBIT/CREDIT NOTE WORKFLOW ===
      {
        object_type: 'DebitCreditNote',
        status_from: 'Draft',
        status_to: 'Under Review',
        recipient_role: 'TUGURE',
        email_subject: '[DN/CN {note_number}] Review Required',
        email_body: 'Dear TUGURE Team,\n\nDebit/Credit Note {note_number} submitted for review.\n\nDetails:\n- Type: {note_type}\n- Amount: {adjustment_amount}\n- Reason: {reason_code}\n\nPlease review and approve/reject.\n\nBest regards,\nSystem',
        is_active: true
      },
      {
        object_type: 'DebitCreditNote',
        status_from: 'Under Review',
        status_to: 'Approved',
        recipient_role: 'BRINS',
        email_subject: '[DN/CN {note_number}] Approved',
        email_body: 'Dear BRINS Team,\n\nDebit/Credit Note {note_number} has been approved.\n\nDetails:\n- Type: {note_type}\n- Amount: {adjustment_amount}\n- Approved by: {user_name}\n\nReconciliation updated automatically.\n\nBest regards,\nTUGURE System',
        is_active: true
      },
      {
        object_type: 'DebitCreditNote',
        status_from: 'Under Review',
        status_to: 'Rejected',
        recipient_role: 'BRINS',
        email_subject: '[DN/CN {note_number}] Rejected',
        email_body: 'Dear BRINS Team,\n\nDebit/Credit Note {note_number} has been rejected.\n\nReason: {rejection_reason}\n\nPlease review and resubmit if necessary.\n\nBest regards,\nTUGURE System',
        is_active: true
      },
      {
        object_type: 'DebitCreditNote',
        status_from: 'Approved',
        status_to: 'Acknowledged',
        recipient_role: 'ALL',
        email_subject: '[DN/CN {note_number}] Acknowledged',
        email_body: 'Dear Team,\n\nDebit/Credit Note {note_number} acknowledged by BRINS.\n\nProcess completed.\n\nBest regards,\nSystem',
        is_active: true
      },
      
      // === PAYMENT INTENT WORKFLOW ===
      {
        object_type: 'PaymentIntent',
        status_from: 'Draft',
        status_to: 'Submitted',
        recipient_role: 'TUGURE',
        email_subject: '[Payment Intent {intent_id}] Approval Required',
        email_body: 'Dear TUGURE Team,\n\nPayment Intent {intent_id} submitted for approval.\n\nDetails:\n- Invoice: {invoice_id}\n- Planned Amount: {planned_amount}\n- Planned Date: {planned_date}\n\nPlease review and approve.\n\nBest regards,\nBRINS',
        is_active: true
      },
      {
        object_type: 'PaymentIntent',
        status_from: 'Submitted',
        status_to: 'Approved',
        recipient_role: 'BRINS',
        email_subject: '[Payment Intent {intent_id}] Approved',
        email_body: 'Dear BRINS Team,\n\nPayment Intent {intent_id} approved.\n\nApproved by: {user_name}\nDate: {date}\n\nPlease proceed with payment.\n\nBest regards,\nTUGURE System',
        is_active: true
      },
      {
        object_type: 'PaymentIntent',
        status_from: 'Submitted',
        status_to: 'Rejected',
        recipient_role: 'BRINS',
        email_subject: '[Payment Intent {intent_id}] Rejected',
        email_body: 'Dear BRINS Team,\n\nPayment Intent {intent_id} rejected.\n\nReason: {rejection_reason}\n\nBest regards,\nTUGURE System',
        is_active: true
      }
    ];
    
    for (const template of sampleTemplates) {
      try {
        await base44.entities.EmailTemplate.create(template);
      } catch (error) {
        console.error('Failed to create sample template:', error);
      }
    }

    // Create sample SLA rules - Real business scenarios
    const sampleSlaRules = [
      // === DEBTOR WORKFLOW SLA ===
      {
        rule_name: 'Debtor Pending Review - 48h SLA',
        entity_type: 'Debtor',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'SUBMITTED',
        duration_value: 48,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[SLA Alert] Debtor {entity_id} Pending Review for 48 Hours',
        email_body: 'Dear TUGURE Team,\n\nDebtor {entity_id} has been pending review for {duration} hours.\n\nCurrent Status: {status}\nSubmission Date: {date}\n\nPlease review and approve/reject to meet SLA requirements.\n\nBest regards,\nSystem SLA Monitor',
        priority: 'HIGH',
        is_active: true,
        is_recurring: false
      },
      {
        rule_name: 'Debtor Conditional Status - Follow Up Reminder',
        entity_type: 'Debtor',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'CONDITIONAL',
        duration_value: 72,
        duration_unit: 'HOURS',
        notification_type: 'EMAIL',
        recipient_role: 'BRINS',
        email_subject: '[Action Required] Debtor {entity_id} - Additional Documentation Required',
        email_body: 'Dear BRINS Team,\n\nDebtor {entity_id} has been in CONDITIONAL status for {duration} hours.\n\nPlease submit the required additional documents to proceed with approval.\n\nPending Items:\n- Complete documentation as per conditional approval\n- Submit within 7 days to avoid rejection\n\nBest regards,\nTUGURE Reinsurance System',
        priority: 'MEDIUM',
        is_active: true,
        is_recurring: true,
        recurrence_interval: 48
      },
      {
        rule_name: 'Document Incomplete - Urgent Reminder',
        entity_type: 'Debtor',
        trigger_condition: 'CREATED_DURATION',
        duration_value: 120,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'BRINS',
        email_subject: '[Urgent] Debtor {entity_id} - Documentation Incomplete for 5 Days',
        email_body: 'Dear BRINS Team,\n\nDebtor {entity_id} has incomplete documentation for {duration} hours (5 days).\n\nAction Required:\n- Upload all required documents immediately\n- Risk of rejection if not completed within 2 days\n\nRequired Documents:\n- Check Document Eligibility page for details\n\nBest regards,\nSystem SLA Monitor',
        priority: 'CRITICAL',
        is_active: true,
        is_recurring: true,
        recurrence_interval: 24
      },

      // === BATCH WORKFLOW SLA ===
      {
        rule_name: 'Batch Uploaded - Validation SLA 24h',
        entity_type: 'Batch',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Uploaded',
        duration_value: 24,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[SLA Alert] Batch {entity_id} Awaiting Validation for 24 Hours',
        email_body: 'Dear TUGURE Team,\n\nBatch {entity_id} has been uploaded and awaiting validation for {duration} hours.\n\nBatch Details:\n- Total Records: Check batch processing page\n- Submission Date: {date}\n\nPlease validate the batch to proceed with matching.\n\nBest regards,\nSystem SLA Monitor',
        priority: 'HIGH',
        is_active: true,
        is_recurring: false
      },
      {
        rule_name: 'Batch Matched - Approval Required 48h',
        entity_type: 'Batch',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Matched',
        duration_value: 48,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[Action Required] Batch {entity_id} - Approval Pending for 48 Hours',
        email_body: 'Dear TUGURE Team,\n\nBatch {entity_id} has been matched and pending approval for {duration} hours.\n\nAction Required:\n- Review batch details\n- Approve or reject batch\n- SLA target: 48 hours\n\nPlease complete approval to proceed with Nota issuance.\n\nBest regards,\nSystem SLA Monitor',
        priority: 'HIGH',
        is_active: true,
        is_recurring: false
      },
      {
        rule_name: 'Nota Issued - Branch Confirmation Overdue',
        entity_type: 'Batch',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Nota Issued',
        duration_value: 72,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'BRINS',
        email_subject: '[Urgent] Batch {entity_id} - Nota Confirmation Overdue',
        email_body: 'Dear BRINS Team,\n\nNota for Batch {entity_id} has been issued {duration} hours ago but not yet confirmed by branch.\n\nAction Required:\n- Confirm Nota receipt at branch\n- SLA target: 3 business days (72 hours)\n- Overdue status may affect payment processing\n\nPlease confirm immediately to avoid delays.\n\nBest regards,\nTUGURE Reinsurance System',
        priority: 'CRITICAL',
        is_active: true,
        is_recurring: true,
        recurrence_interval: 24
      },
      {
        rule_name: 'Batch Branch Confirmed - Payment Reminder',
        entity_type: 'Batch',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Branch Confirmed',
        duration_value: 168,
        duration_unit: 'HOURS',
        notification_type: 'EMAIL',
        recipient_role: 'TUGURE',
        email_subject: '[Payment Reminder] Batch {entity_id} - Payment Pending for 7 Days',
        email_body: 'Dear TUGURE Team,\n\nBatch {entity_id} has been confirmed by branch {duration} hours ago (7 days) but payment not yet received.\n\nPayment Status:\n- Nota Amount: Check payment page\n- Branch Confirmation Date: {date}\n\nPlease follow up on payment status with accounting team.\n\nBest regards,\nSystem SLA Monitor',
        priority: 'MEDIUM',
        is_active: true,
        is_recurring: true,
        recurrence_interval: 72
      },

      // === CLAIM WORKFLOW SLA ===
      {
        rule_name: 'Claim Submitted - Eligibility Check 48h SLA',
        entity_type: 'Claim',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Draft',
        duration_value: 48,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[SLA Alert] Claim {entity_id} - Eligibility Check Required',
        email_body: 'Dear TUGURE Team,\n\nClaim {entity_id} has been submitted {duration} hours ago and requires eligibility verification.\n\nClaim Details:\n- Claimant: Check claim details\n- Claim Amount: Check claim page\n- Submission Date: {date}\n\nSLA Target: 48 hours for initial eligibility check\n\nPlease review and proceed with eligibility verification.\n\nBest regards,\nSystem SLA Monitor',
        priority: 'HIGH',
        is_active: true,
        is_recurring: false
      },
      {
        rule_name: 'Claim Doc Verification - 7 Days SLA',
        entity_type: 'Claim',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Checked',
        duration_value: 168,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[Urgent] Claim {entity_id} - Document Verification Overdue',
        email_body: 'Dear TUGURE Team,\n\nClaim {entity_id} has been checked but document verification is pending for {duration} hours (7 days).\n\nAction Required:\n- Verify all supporting documents\n- Complete verification within SLA\n- SLA Target: 7 days from eligibility check\n\nOverdue status may impact claim settlement timeline.\n\nBest regards,\nSystem SLA Monitor',
        priority: 'CRITICAL',
        is_active: true,
        is_recurring: true,
        recurrence_interval: 48
      },
      {
        rule_name: 'Claim Invoiced - Payment 14 Days SLA',
        entity_type: 'Claim',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Invoiced',
        duration_value: 336,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[Payment Alert] Claim {entity_id} - Settlement Due in 14 Days',
        email_body: 'Dear TUGURE Team,\n\nClaim {entity_id} has been invoiced {duration} hours ago (14 days).\n\nSettlement Details:\n- Invoice Amount: Check claim page\n- Invoice Date: {date}\n- SLA Target: 14 days for claim settlement\n\nPlease process payment to meet SLA commitment.\n\nBest regards,\nSystem SLA Monitor',
        priority: 'HIGH',
        is_active: true,
        is_recurring: true,
        recurrence_interval: 72
      },

      // === INVOICE & PAYMENT SLA ===
      {
        rule_name: 'Invoice Overdue - 7 Days Past Due Date',
        entity_type: 'Invoice',
        trigger_condition: 'DUE_DATE_PASSED',
        duration_value: 168,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'BRINS',
        email_subject: '[Overdue Invoice] {entity_id} - Payment 7 Days Overdue',
        email_body: 'Dear BRINS Team,\n\nInvoice {entity_id} is now {duration} hours (7 days) overdue.\n\nInvoice Details:\n- Amount: Check invoice page\n- Due Date: {date}\n- Overdue Period: 7 days\n\nLate Payment Penalty:\n- Penalty may apply as per contract terms\n- Please process payment immediately\n\nBest regards,\nTUGURE Reinsurance System',
        priority: 'CRITICAL',
        is_active: true,
        is_recurring: true,
        recurrence_interval: 72
      },
      {
        rule_name: 'Invoice Due Date Approaching - 3 Days Reminder',
        entity_type: 'Invoice',
        trigger_condition: 'DUE_DATE_APPROACHING',
        duration_value: 72,
        duration_unit: 'HOURS',
        notification_type: 'EMAIL',
        recipient_role: 'BRINS',
        email_subject: '[Payment Reminder] Invoice {entity_id} Due in 3 Days',
        email_body: 'Dear BRINS Team,\n\nInvoice {entity_id} is due in {duration} hours (3 days).\n\nInvoice Summary:\n- Amount: Check invoice page\n- Due Date: {date}\n- Payment Method: As per contract\n\nPlease arrange payment before due date to avoid late payment penalties.\n\nBest regards,\nTUGURE Reinsurance System',
        priority: 'MEDIUM',
        is_active: true,
        is_recurring: false
      },
      {
        rule_name: 'Payment Intent Pending - Approval Required',
        entity_type: 'PaymentIntent',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'SUBMITTED',
        duration_value: 48,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[Action Required] Payment Intent {entity_id} - Approval Pending',
        email_body: 'Dear TUGURE Team,\n\nPayment Intent {entity_id} has been submitted {duration} hours ago and requires approval.\n\nPayment Details:\n- Planned Amount: Check payment intent page\n- Planned Date: {date}\n\nPlease review and approve/reject payment intent.\n\nBest regards,\nSystem SLA Monitor',
        priority: 'MEDIUM',
        is_active: true,
        is_recurring: false
      },

      // === MASTER CONTRACT SLA ===
      {
        rule_name: 'Contract Pending First Approval - 24h SLA',
        entity_type: 'MasterContract',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Pending First Approval',
        duration_value: 24,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[SLA Alert] Contract {entity_id} - First Approval Pending 24h',
        email_body: 'Dear TUGURE Team,\n\nMaster Contract {entity_id} pending first approval for {duration} hours.\n\nAction Required:\n- Review contract terms\n- Approve or reject within SLA\n\nBest regards,\nSystem SLA Monitor',
        priority: 'HIGH',
        is_active: true,
        is_recurring: false
      },
      {
        rule_name: 'Contract Pending Second Approval - 48h SLA',
        entity_type: 'MasterContract',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Pending Second Approval',
        duration_value: 48,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'ADMIN',
        email_subject: '[SLA Alert] Contract {entity_id} - Second Approval Pending 48h',
        email_body: 'Dear Admin,\n\nMaster Contract {entity_id} pending second approval for {duration} hours.\n\nAction Required:\n- Final review and approval needed\n\nBest regards,\nSystem SLA Monitor',
        priority: 'HIGH',
        is_active: true,
        is_recurring: false
      },
      
      // === BORDERO SLA ===
      {
        rule_name: 'Bordero Generated - Review Required 24h',
        entity_type: 'Bordero',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'GENERATED',
        duration_value: 24,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[SLA Alert] Bordero {entity_id} - Review Pending 24h',
        email_body: 'Dear TUGURE Team,\n\nBordero {entity_id} generated 24 hours ago and awaiting review.\n\nAction Required:\n- Review bordero data\n- Move to UNDER_REVIEW status\n\nBest regards,\nSystem SLA Monitor',
        priority: 'MEDIUM',
        is_active: true,
        is_recurring: false
      },
      {
        rule_name: 'Bordero Under Review - Finalize 48h',
        entity_type: 'Bordero',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'UNDER_REVIEW',
        duration_value: 48,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[SLA Alert] Bordero {entity_id} - Finalize Pending 48h',
        email_body: 'Dear TUGURE Team,\n\nBordero {entity_id} under review for 48 hours.\n\nAction Required:\n- Complete review\n- Finalize bordero\n\nBest regards,\nSystem SLA Monitor',
        priority: 'HIGH',
        is_active: true,
        is_recurring: false
      },

      // === NOTA WORKFLOW SLA ===
      {
        rule_name: 'Nota Confirmed - Payment Intent Auto-Create',
        entity_type: 'Nota',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Confirmed',
        duration_value: 1,
        duration_unit: 'HOURS',
        notification_type: 'SYSTEM',
        recipient_role: 'BRINS',
        email_subject: '[Payment Intent] Nota {entity_id} - Payment Intent Created',
        email_body: 'Payment Intent auto-created for Nota {entity_id}. Check Payment Intent menu.',
        priority: 'MEDIUM',
        is_active: true,
        is_recurring: false
      },
      {
        rule_name: 'DN/CN Pending Review - 48h SLA',
        entity_type: 'DebitCreditNote',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Under Review',
        duration_value: 48,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[SLA Alert] DN/CN {entity_id} - Review Pending 48h',
        email_body: 'Dear TUGURE Team,\n\nDebit/Credit Note {entity_id} pending review for {duration} hours.\n\nAction Required:\n- Review adjustment reason\n- Approve or reject DN/CN\n\nBest regards,\nSystem SLA Monitor',
        priority: 'HIGH',
        is_active: true,
        is_recurring: false
      },

      // === SUBROGATION SLA ===
      {
        rule_name: 'Subrogation Recovery - Follow Up Required',
        entity_type: 'Subrogation',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'Invoiced',
        duration_value: 240,
        duration_unit: 'HOURS',
        notification_type: 'EMAIL',
        recipient_role: 'TUGURE',
        email_subject: '[Follow Up] Subrogation {entity_id} - Recovery Payment Pending',
        email_body: 'Dear TUGURE Team,\n\nSubrogation {entity_id} has been invoiced {duration} hours ago (10 days) but recovery payment not received.\n\nRecovery Details:\n- Recovery Amount: Check subrogation page\n- Invoice Date: {date}\n\nPlease follow up with BRINS for recovery payment.\n\nBest regards,\nSystem SLA Monitor',
        priority: 'MEDIUM',
        is_active: true,
        is_recurring: true,
        recurrence_interval: 120
      },

      // === DOCUMENT VERIFICATION SLA ===
      {
        rule_name: 'Document Pending Verification - 48h SLA',
        entity_type: 'Document',
        trigger_condition: 'STATUS_DURATION',
        status_value: 'PENDING',
        duration_value: 48,
        duration_unit: 'HOURS',
        notification_type: 'BOTH',
        recipient_role: 'TUGURE',
        email_subject: '[SLA Alert] Document Verification Pending for 48 Hours',
        email_body: 'Dear TUGURE Team,\n\nDocument for entity {entity_id} has been pending verification for {duration} hours.\n\nAction Required:\n- Verify document authenticity\n- Approve or reject document\n- SLA Target: 48 hours\n\nPlease complete verification to proceed with debtor approval.\n\nBest regards,\nSystem SLA Monitor',
        priority: 'HIGH',
        is_active: true,
        is_recurring: false
      }
    ];

    for (const rule of sampleSlaRules) {
      try {
        await base44.entities.SlaRule.create({
          ...rule,
          trigger_count: 0
        });
      } catch (error) {
        console.error('Failed to create sample SLA rule:', error);
      }
    }
  };

  const handleSaveUserSettings = async () => {
    setProcessing(true);
    try {
      const existing = notificationSettings.find(s => s.user_email === user.email);
      
      if (existing) {
        await base44.entities.NotificationSetting.update(existing.id, currentSetting);
      } else {
        await base44.entities.NotificationSetting.create({
          ...currentSetting,
          full_name: currentSetting.full_name || user.full_name || user.email,
          user_email: user.email,
          user_role: user.role.toUpperCase()
        });
      }

      setSuccessMessage('Settings saved successfully');
      loadData();
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
        await base44.entities.SystemConfig.update(editingConfig.id, configData);
      } else {
        await base44.entities.SystemConfig.create(configData);
      }

      setSuccessMessage('Configuration saved successfully');
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
    }
    setProcessing(false);
  };

  const handleMarkAsRead = async (notifId) => {
    try {
      await base44.entities.Notification.update(notifId, { is_read: true });
      loadData();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const handleDeleteSettings = async () => {
    if (selectedSettings.length === 0) return;
    
    setProcessing(true);
    try {
      for (const id of selectedSettings) {
        await base44.entities.NotificationSetting.delete(id);
      }
      setSuccessMessage(`Deleted ${selectedSettings.length} settings`);
      setSelectedSettings([]);
      loadData();
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

  const unreadNotifications = notifications.filter(n => !n.is_read);

  const handleResetData = async (dataType) => {
    if (!window.confirm(`Are you sure you want to reset all ${dataType} data? This cannot be undone.`)) {
      return;
    }

    setResetting(true);
    setResetMessage('');
    setSuccessMessage('');
    
    try {
      let deletedCount = 0;
      
      if (dataType === 'debtors') {
        const debtors = await base44.entities.Debtor.list();
        for (const debtor of debtors) {
          await base44.entities.Debtor.delete(debtor.id);
        }
        deletedCount = debtors.length;
        
        const batches = await base44.entities.Batch.list();
        for (const batch of batches) {
          await base44.entities.Batch.delete(batch.id);
        }
        
        const records = await base44.entities.Record.list();
        for (const record of records) {
          await base44.entities.Record.delete(record.id);
        }
        
        const documents = await base44.entities.Document.list();
        for (const doc of documents) {
          await base44.entities.Document.delete(doc.id);
        }
        
        const borderos = await base44.entities.Bordero.list();
        for (const bordero of borderos) {
          await base44.entities.Bordero.delete(bordero.id);
        }
        
        const notas = await base44.entities.Nota.list();
        for (const nota of notas) {
          await base44.entities.Nota.delete(nota.id);
        }
        
        const dnCnNotes = await base44.entities.DebitCreditNote.list();
        for (const note of dnCnNotes) {
          await base44.entities.DebitCreditNote.delete(note.id);
        }
      } else if (dataType === 'claims') {
        const claims = await base44.entities.Claim.list();
        for (const claim of claims) {
          await base44.entities.Claim.delete(claim.id);
        }
        deletedCount = claims.length;
        
        const subrogations = await base44.entities.Subrogation.list();
        for (const subrogation of subrogations) {
          await base44.entities.Subrogation.delete(subrogation.id);
        }
      } else if (dataType === 'financial') {
        const invoices = await base44.entities.Invoice.list();
        for (const invoice of invoices) {
          await base44.entities.Invoice.delete(invoice.id);
        }
        
        const payments = await base44.entities.Payment.list();
        for (const payment of payments) {
          await base44.entities.Payment.delete(payment.id);
        }
        
        const paymentIntents = await base44.entities.PaymentIntent.list();
        for (const intent of paymentIntents) {
          await base44.entities.PaymentIntent.delete(intent.id);
        }
        
        const dnCnNotes = await base44.entities.DebitCreditNote.list();
        for (const note of dnCnNotes) {
          await base44.entities.DebitCreditNote.delete(note.id);
        }
        
        deletedCount = invoices.length + payments.length;
      } else if (dataType === 'notifications') {
        const notifications = await base44.entities.Notification.list();
        for (const notif of notifications) {
          await base44.entities.Notification.delete(notif.id);
        }
        deletedCount = notifications.length;
        loadData();
      } else if (dataType === 'contracts') {
        const contracts = await base44.entities.MasterContract.list();
        for (const contract of contracts) {
          await base44.entities.MasterContract.delete(contract.id);
        }
        deletedCount = contracts.length;
      } else if (dataType === 'all') {
        await handleResetData('debtors');
        await handleResetData('claims');
        await handleResetData('financial');
        await handleResetData('notifications');
        setResetMessage('All testing data has been reset successfully!');
        setResetting(false);
        return;
      }
      
      setResetMessage(`Successfully deleted ${deletedCount} ${dataType} records`);
    } catch (error) {
      console.error('Reset error:', error);
      setResetMessage(`Failed to reset ${dataType}: ${error.message}`);
    }
    
    setResetting(false);
  };

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications ({unreadNotifications.length})
          </TabsTrigger>
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
          <TabsTrigger value="testing">
            <TestTube className="w-4 h-4 mr-2" />
            Testing Tools
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-4">
          <div className="space-y-3">
            {unreadNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No unread notifications</p>
                </CardContent>
              </Card>
            ) : (
              unreadNotifications.map((notif) => (
                <Card key={notif.id} className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-blue-100">
                        <Bell className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold text-gray-900">{notif.title}</h4>
                            <Badge variant="outline">{notif.type.replace(/_/g, ' ')}</Badge>
                            <Badge variant="outline">{notif.module}</Badge>
                          </div>
                          <span className="text-xs text-gray-500">
                            {format(new Date(notif.created_date), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{notif.message}</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleMarkAsRead(notif.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark as Read
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="email-templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Email Notification Templates</h3>
              <p className="text-sm text-gray-500">Configure automated email messages for status transitions</p>
            </div>
            <div className="flex gap-2">
              {selectedTemplates.length > 0 && (
                <Button variant="destructive" onClick={async () => {
                  if (!window.confirm(`Delete ${selectedTemplates.length} template(s)?`)) return;
                  setProcessing(true);
                  let deleted = 0;
                  for (const id of selectedTemplates) {
                    try {
                      await base44.entities.EmailTemplate.delete(id);
                      deleted++;
                    } catch (error) {
                      console.error('Delete error:', error);
                    }
                  }
                  setSuccessMessage(`${deleted} template(s) deleted`);
                  setSelectedTemplates([]);
                  loadData();
                  setProcessing(false);
                }}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedTemplates.length})
                </Button>
              )}
              <Button onClick={() => { setSelectedTemplate(null); setShowTemplateDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Template
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <Select value={templateFilters.objectType} onValueChange={(val) => setTemplateFilters({...templateFilters, objectType: val})}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Object Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Object Types</SelectItem>
                    <SelectItem value="MasterContract">Master Contract</SelectItem>
                    <SelectItem value="Batch">Batch</SelectItem>
                    <SelectItem value="Record">Record</SelectItem>
                    <SelectItem value="Nota">Nota</SelectItem>
                    <SelectItem value="Debtor">Debtor</SelectItem>
                    <SelectItem value="Claim">Claim</SelectItem>
                    <SelectItem value="Subrogation">Subrogation</SelectItem>
                    <SelectItem value="DebitCreditNote">Debit/Credit Note</SelectItem>
                    <SelectItem value="PaymentIntent">Payment Intent</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setTemplateFilters({objectType: 'all'})}>
                  Clear Filter
                </Button>
              </div>
            </CardContent>
          </Card>

          <DataTable
            columns={[
              {
                header: (
                  <Checkbox
                    checked={selectedTemplates.length === emailTemplates.length && emailTemplates.length > 0}
                    onCheckedChange={(checked) => {
                      setSelectedTemplates(checked ? emailTemplates.map(t => t.id) : []);
                    }}
                  />
                ),
                cell: (row) => (
                  <Checkbox
                    checked={selectedTemplates.includes(row.id)}
                    onCheckedChange={() => {
                      setSelectedTemplates(prev =>
                        prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id]
                      );
                    }}
                  />
                ),
                width: '40px'
              },
              {
                header: 'Object Type',
                accessorKey: 'object_type',
                cell: (row) => (
                  <Badge variant="outline">{row.object_type}</Badge>
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
                cell: (row) => <Badge>{row.recipient_role}</Badge>
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
                  <Badge variant={row.is_active ? 'default' : 'secondary'}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                )
              },
              {
                header: 'Actions',
                cell: (row) => (
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => { setSelectedTemplate(row); setShowTemplateDialog(true); }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={async () => {
                        if (window.confirm('Delete this template?')) {
                          try {
                            await base44.entities.EmailTemplate.delete(row.id);
                            setSuccessMessage('Template deleted');
                          } catch (error) {
                            console.error('Delete error:', error);
                            setSuccessMessage('Template already deleted or not found');
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
            ]}
            data={emailTemplates.filter(t => {
              if (templateFilters.objectType !== 'all' && t.object_type !== templateFilters.objectType) return false;
              return true;
            })}
            isLoading={loading}
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
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification by Rules Tab */}
        <TabsContent value="notification-rules" className="mt-4 space-y-6">
          <Alert className="bg-blue-50 border-blue-200">
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
          </Alert>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SLA & Notification Rules</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Configure automatic notifications based on time, status, or conditions</p>
                </div>
                <div className="flex gap-2">
                  {selectedRules.length > 0 && (
                    <Button variant="destructive" size="sm" onClick={async () => {
                      if (!window.confirm(`Delete ${selectedRules.length} rule(s)?`)) return;
                      setProcessing(true);
                      let deleted = 0;
                      for (const id of selectedRules) {
                        try {
                          await base44.entities.SlaRule.delete(id);
                          deleted++;
                        } catch (error) {
                          console.error('Delete error:', error);
                        }
                      }
                      setSuccessMessage(`${deleted} rule(s) deleted`);
                      setSelectedRules([]);
                      loadData();
                      setProcessing(false);
                    }}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete ({selectedRules.length})
                    </Button>
                  )}
                  <Button onClick={() => { 
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
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rule
                </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input 
                  placeholder="Search rules..." 
                  value={ruleSearchTerm}
                  onChange={(e) => setRuleSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Select value={ruleFilters.triggerCondition} onValueChange={(val) => setRuleFilters({...ruleFilters, triggerCondition: val})}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Trigger Condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Conditions</SelectItem>
                    <SelectItem value="STATUS_DURATION">Status Duration</SelectItem>
                    <SelectItem value="CREATED_DURATION">Created Duration</SelectItem>
                    <SelectItem value="DUE_DATE_APPROACHING">Due Date Approaching</SelectItem>
                    <SelectItem value="DUE_DATE_PASSED">Due Date Passed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ruleFilters.status} onValueChange={(val) => setRuleFilters({...ruleFilters, status: val})}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => { setRuleSearchTerm(''); setRuleFilters({triggerCondition: 'all', status: 'all'}); }}>
                  Clear
                </Button>
              </div>
              <DataTable
                columns={[
                  {
                    header: (
                      <Checkbox
                        checked={selectedRules.length === slaRules.length && slaRules.length > 0}
                        onCheckedChange={(checked) => {
                          setSelectedRules(checked ? slaRules.map(r => r.id) : []);
                        }}
                      />
                    ),
                    cell: (row) => (
                      <Checkbox
                        checked={selectedRules.includes(row.id)}
                        onCheckedChange={() => {
                          setSelectedRules(prev =>
                            prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id]
                          );
                        }}
                      />
                    ),
                    width: '40px'
                  },
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
                          variant="outline" 
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
                                await base44.entities.SlaRule.delete(row.id);
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
                ]}
                data={slaRules.filter(r => {
                  if (ruleSearchTerm && !r.rule_name.toLowerCase().includes(ruleSearchTerm.toLowerCase()) &&
                      !r.entity_type.toLowerCase().includes(ruleSearchTerm.toLowerCase())) return false;
                  if (ruleFilters.triggerCondition !== 'all' && r.trigger_condition !== ruleFilters.triggerCondition) return false;
                  if (ruleFilters.status === 'active' && !r.is_active) return false;
                  if (ruleFilters.status === 'inactive' && r.is_active) return false;
                  return true;
                })}
                isLoading={loading}
                emptyMessage="No SLA rules configured. Click 'Add Rule' to create automatic notifications."
              />
            </CardContent>
          </Card>

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

        {/* Testing Tools Tab */}
        <TabsContent value="testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Testing & Development Tools</CardTitle>
              <p className="text-sm text-gray-500">Reset data for testing purposes. Use with caution!</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {resetMessage && (
                <Alert className={resetMessage.includes('Failed') ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
                  <AlertDescription className={resetMessage.includes('Failed') ? 'text-red-700' : 'text-green-700'}>
                    {resetMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-orange-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Reset Debtor Data</CardTitle>
                    <p className="text-sm text-gray-500">Delete all debtors, batches, records, documents, borderos, and notas</p>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => handleResetData('debtors')}
                      disabled={resetting}
                      variant="outline"
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Reset Debtor Data
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-orange-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Reset Claim Data</CardTitle>
                    <p className="text-sm text-gray-500">Delete all claims and subrogations</p>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => handleResetData('claims')}
                      disabled={resetting}
                      variant="outline"
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Reset Claim Data
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-orange-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Reset Financial Data</CardTitle>
                    <p className="text-sm text-gray-500">Delete invoices, payments, payment intents, and DN/CN</p>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => handleResetData('financial')}
                      disabled={resetting}
                      variant="outline"
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Reset Financial Data
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-orange-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Reset Notifications</CardTitle>
                    <p className="text-sm text-gray-500">Delete all notifications</p>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => handleResetData('notifications')}
                      disabled={resetting}
                      variant="outline"
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Reset Notifications
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-orange-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Reset Master Contracts</CardTitle>
                    <p className="text-sm text-gray-500">Delete all master contracts</p>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => handleResetData('contracts')}
                      disabled={resetting}
                      variant="outline"
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Reset Master Contracts
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-red-300 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-lg text-red-700">⚠️ Reset All Testing Data</CardTitle>
                  <p className="text-sm text-red-600">This will delete ALL data except contracts and system configurations</p>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => handleResetData('all')}
                    disabled={resetting}
                    variant="destructive"
                    className="w-full"
                  >
                    {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Reset All Testing Data
                  </Button>
                </CardContent>
              </Card>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> System Configurations are preserved during reset all. Master Contracts can be reset individually if needed for testing.
                </AlertDescription>
              </Alert>
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
                    await base44.entities.SlaRule.update(selectedRule.id, selectedRule);
                  } else {
                    await base44.entities.SlaRule.create({
                      ...selectedRule,
                      trigger_count: 0
                    });
                  }
                  await loadData();
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
                  await base44.entities.EmailTemplate.update(selectedTemplate.id, selectedTemplate);
                } else {
                  await base44.entities.EmailTemplate.create(selectedTemplate);
                }
                await loadData();
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