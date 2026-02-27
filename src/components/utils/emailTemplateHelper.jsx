/**
 * Email Template Helper
 * Handles email template variable replacement and sending
 */

import { backend } from '@/api/backendClient';

/**
 * Replace variables in email template
 * @param {string} template - Template string with variables like {variable_name}
 * @param {object} variables - Object with variable values
 * @returns {string} - Template with variables replaced
 */
export function replaceTemplateVariables(template, variables) {
  if (!template) return '';
  
  let result = template;
  
  // Replace all variables in format {variable_name}
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, variables[key] || '');
  });
  
  return result;
}

/**
 * Get email template for object type and status transition
 * @param {string} objectType - Type of object (Batch, Record, Nota, Claim, Subrogation)
 * @param {string} statusTo - Target status
 * @param {string} recipientRole - Recipient role (BRINS, TUGURE, ALL)
 * @returns {object|null} - Email template or null
 */
export async function getEmailTemplate(objectType, statusTo, recipientRole) {
  try {
    const templates = await backend.list('EmailTemplate');
    
    // Find matching template
    const template = templates.find(t => 
      t.object_type === objectType &&
      t.status_to === statusTo &&
      (t.recipient_role === recipientRole || t.recipient_role === 'ALL') &&
      t.is_active
    );
    
    return template;
  } catch (error) {
    console.error('Failed to get email template:', error);
    return null;
  }
}

/**
 * Get notification settings for users who should receive this notification
 * @param {string} targetRole - Target role (BRINS, TUGURE, ALL)
 * @param {string} notificationType - Type of notification (e.g., 'notify_batch_status')
 * @returns {array} - Array of notification settings
 */
export async function getNotificationRecipients(targetRole, notificationType) {
  try {
    const allSettings = await backend.list('NotificationSetting');
    
    // Filter settings based on role and notification type preference
    const recipients = allSettings.filter(setting => {
      // Check role match
      const roleMatch = targetRole === 'ALL' || 
                       setting.user_role === targetRole || 
                       setting.user_role === 'ADMIN';
      
      // Check if email is enabled
      const emailEnabled = setting.email_enabled;
      
      // Check if this specific notification type is enabled
      const notificationEnabled = notificationType ? setting[notificationType] : true;
      
      return roleMatch && emailEnabled && notificationEnabled && setting.notification_email;
    });
    
    return recipients;
  } catch (error) {
    console.error('Failed to get notification recipients:', error);
    return [];
  }
}

/**
 * Send email using template
 * @param {string} objectType - Type of object (Batch, Record, Nota, Claim, Subrogation)
 * @param {string} statusFrom - Current status (optional)
 * @param {string} statusTo - Target status
 * @param {string} recipientRole - Recipient role (BRINS, TUGURE, ALL)
 * @param {string} notificationType - Notification preference field name
 * @param {object} variables - Variables for template replacement
 * @returns {Promise<void>}
 */
export async function sendTemplatedEmail(objectType, statusFrom, statusTo, recipientRole, notificationType, variables) {
  try {
    // Get email template
    const template = await getEmailTemplate(objectType, statusTo, recipientRole);
    
    if (!template) {
      console.warn(`No email template found for ${objectType} -> ${statusTo} (${recipientRole})`);
      return;
    }
    
    // Get recipients based on preferences
    const recipients = await getNotificationRecipients(recipientRole, notificationType);
    
    if (recipients.length === 0) {
      console.log(`No recipients enabled for ${objectType} -> ${statusTo} notification`);
      return;
    }
    
    // Replace variables in subject and body
    const subject = replaceTemplateVariables(template.email_subject, variables);
    const body = replaceTemplateVariables(template.email_body, variables);
    
    // Send email to all recipients
    const emailPromises = recipients.map(recipient =>
      backend.sendEmail({
        to: recipient.notification_email,
        subject: subject,
        body: body
      }).catch(error => {
        console.error(`Failed to send email to ${recipient.notification_email}:`, error);
      })
    );
    
    await Promise.all(emailPromises);
    console.log(`Sent ${recipients.length} emails for ${objectType} -> ${statusTo}`);
  } catch (error) {
    console.error('Failed to send templated email:', error);
    throw error;
  }
}

/**
 * Send notification email to all users in a Keycloak group.
 * Resolves recipient emails from Keycloak group via backend, then sends using EmailTemplate
 * from DB (with fallback subject/body if no template exists).
 *
 * @param {object} options
 * @param {string} options.targetGroup - Keycloak group name to resolve recipients from (e.g., 'email')
 * @param {string[]} [options.to] - Optional explicit email addresses (in addition to group resolution)
 * @param {string} options.objectType - Object type for template lookup (Batch, Record, Nota, Claim, Subrogation)
 * @param {string} options.statusTo - Target status for template lookup
 * @param {string} [options.recipientRole='ALL'] - Recipient role for template lookup (BRINS, TUGURE, ALL)
 * @param {object} [options.variables={}] - Variables for template replacement
 * @param {string} [options.fallbackSubject=''] - Fallback subject if no template found
 * @param {string} [options.fallbackBody=''] - Fallback body if no template found
 * @returns {Promise<void>}
 */
export async function sendNotificationEmail({
  targetGroup = '',
  to = [],
  objectType,
  statusTo,
  recipientRole = 'ALL',
  variables = {},
  fallbackSubject = '',
  fallbackBody = '',
}) {
  // 1. Resolve recipient emails from Keycloak group
  const emailSet = new Set(Array.isArray(to) ? to : (to ? [to] : []));

  if (targetGroup) {
    try {
      const groupUsers = await backend.getUsersByGroup(targetGroup);
      if (Array.isArray(groupUsers)) {
        groupUsers.forEach(user => {
          if (user.email) emailSet.add(user.email);
        });
        console.log(`[sendNotificationEmail] Group "${targetGroup}": found ${groupUsers.length} user(s)`);
      }
    } catch (err) {
      console.warn(`[sendNotificationEmail] Failed to get users for group "${targetGroup}":`, err);
    }
  }

  const recipients = [...emailSet].filter(Boolean);

  if (recipients.length === 0) {
    console.warn('[sendNotificationEmail] No recipients resolved from group or explicit list. Skipping.');
    return;
  }

  console.log(`[sendNotificationEmail] Sending to ${recipients.length} recipient(s): ${recipients.join(', ')}`);

  // 2. Get subject/body from template or fallback
  let subject = fallbackSubject;
  let body = fallbackBody;

  try {
    const template = await getEmailTemplate(objectType, statusTo, recipientRole);
    if (template) {
      subject = replaceTemplateVariables(template.email_subject, variables);
      body = replaceTemplateVariables(template.email_body, variables);
      console.log(`[sendNotificationEmail] Using DB template for ${objectType} -> ${statusTo}`);
    } else {
      console.warn(`[sendNotificationEmail] No template for ${objectType} -> ${statusTo}, using fallback.`);
      subject = replaceTemplateVariables(subject, variables);
      body = replaceTemplateVariables(body, variables);
    }
  } catch (err) {
    console.warn('[sendNotificationEmail] Template lookup failed, using fallback:', err.message);
    subject = replaceTemplateVariables(subject, variables);
    body = replaceTemplateVariables(body, variables);
  }

  if (!subject || !body) {
    console.warn('[sendNotificationEmail] No subject or body available. Skipping.');
    return;
  }

  // 3. Send to each recipient
  const results = await Promise.allSettled(
    recipients.map(email =>
      backend.sendDirectEmail({ to: email, subject, body })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`[sendNotificationEmail] Sent: ${sent}, Failed: ${failed} for ${objectType} -> ${statusTo}`);

  if (failed > 0) {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[sendNotificationEmail] Failed to send to ${recipients[i]}:`, r.reason);
      }
    });
  }
}

/**
 * Create notification in system
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (INFO, WARNING, ACTION_REQUIRED, DECISION)
 * @param {string} module - Module name
 * @param {string} referenceId - Reference entity ID
 * @param {string} targetRole - Target role
 * @returns {Promise<void>}
 */
export async function createNotification(title, message, type, module, referenceId, targetRole) {
  try {
    await backend.create('Notification', {
      title,
      message,
      type,
      module,
      reference_id: referenceId,
      target_role: targetRole,
      is_read: false
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

/**
 * Create audit log entry
 * @param {string} action - Action performed
 * @param {string} module - Module name
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @param {object} oldValue - Old value object
 * @param {object} newValue - New value object
 * @param {string} userEmail - User email
 * @param {string} userRole - User role
 * @param {string} reason - Reason/remarks
 * @returns {Promise<void>}
 */
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
      reason: reason || ''
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}