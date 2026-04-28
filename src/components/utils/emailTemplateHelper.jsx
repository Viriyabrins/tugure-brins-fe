/**
 * Email Template Helper
 * Workflow email templates are the normal/default template system.
 * This helper remains for compatibility with older imports.
 */

import { backend } from '@/api/backendClient';

export function replaceTemplateVariables(template, variables) {
  if (!template) return '';

  let result = template;
  Object.keys(variables || {}).forEach((key) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, variables[key] || '');
  });
  return result;
}

/**
 * Deprecated compatibility helper.
 * Status-transition template lookups are no longer used.
 */
export async function getEmailTemplate() {
  console.warn('[emailTemplateHelper] getEmailTemplate is deprecated. Workflow email templates are now the default template system.');
  return null;
}

/**
 * Deprecated compatibility helper.
 * Legacy templated status emails are no longer used.
 */
export async function sendTemplatedEmail() {
  console.warn('[emailTemplateHelper] sendTemplatedEmail is deprecated. Use workflow email templates instead.');
}

/**
 * Compatibility wrapper for direct workflow-style sends from the frontend.
 * Prefers explicit subject/body passed by caller and still resolves recipients by role.
 */
export async function sendNotificationEmail({
  targetRealm = 'brins',
  targetRole = '',
  to = [],
  variables = {},
  fallbackSubject = '',
  fallbackBody = '',
}) {
  const emailSet = new Set(Array.isArray(to) ? to : (to ? [to] : []));

  if (targetRole) {
    try {
      const roleUsers = await backend.getUsersByRole(targetRealm, targetRole);
      if (Array.isArray(roleUsers)) {
        roleUsers.forEach((user) => {
          if (user.email) emailSet.add(user.email);
        });
        console.log(`[emailTemplateHelper] Resolved ${roleUsers.length} user(s) from ${targetRealm}/${targetRole}`);
      }
    } catch (err) {
      console.warn(`[emailTemplateHelper] Failed to resolve role recipients for ${targetRealm}/${targetRole}:`, err);
    }
  }

  const recipients = [...emailSet].filter(Boolean);
  if (recipients.length === 0) {
    console.warn('[emailTemplateHelper] No recipients resolved. Skipping email.');
    return;
  }

  const subject = replaceTemplateVariables(fallbackSubject, variables);
  const body = replaceTemplateVariables(fallbackBody, variables);

  if (!subject || !body) {
    console.warn('[emailTemplateHelper] Missing subject/body. Skipping email.');
    return;
  }

  await backend.sendDirectEmail({ to: recipients.join(', '), subject, body });
  console.log(`[emailTemplateHelper] Sent workflow-style email to ${recipients.length} recipient(s).`);
}

export async function sendWorkflowEmail({
  realm,
  roleName,
  extraTo = [],
  variables = {},
  fallbackSubject,
  fallbackBody,
}) {
  return sendNotificationEmail({
    targetRealm: realm,
    targetRole: roleName,
    to: extraTo,
    variables,
    fallbackSubject,
    fallbackBody,
  });
}

export async function createNotification(title, message, type, module, referenceId, targetRole) {
  try {
    await backend.create('Notification', {
      title,
      message,
      type,
      module,
      reference_id: referenceId,
      target_role: targetRole,
      is_read: false,
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

export async function createAuditLog(action, module, entityType, entityId, oldValue, newValue, userEmail, userRole, reason) {
  try {
    await backend.create('AuditLog', {
      action,
      module,
      entity_type: entityType,
      entity_id: entityId,
      old_value: JSON.stringify(oldValue),
      new_value: JSON.stringify(newValue),
      user_email: userEmail,
      user_role: userRole,
      reason: reason || '',
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
