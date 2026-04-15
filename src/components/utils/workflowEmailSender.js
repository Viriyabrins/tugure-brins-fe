/**
 * Workflow Email Sender
 * 
 * Sends emails using hardcoded subject/body messages with Keycloak role-based
 * recipient resolution. Does NOT use EmailTemplate DB lookups.
 * 
 * **Logging:** Each email send is logged with a unique request ID (EMAIL_timestamp_random).
 * Check browser console for detailed logs including:
 *   - Template parameters (objectType, statusTo, recipientRole)
 *   - Recipients resolved from Keycloak roles
 *   - Final email subject, body, and recipients
 *   - Success/failure status
 * 
 * When EmailTemplate DB is ready, migrate callers back to emailTemplateHelper.jsx.
 */

import { backend } from '@/api/backendClient';

/**
 * Replace variables in a string template.
 * @param {string} template - Template string with variables like {variable_name}
 * @param {object} variables - Object with variable values
 * @returns {string} - Template with variables replaced
 */
export function replaceTemplateVariables(template, variables) {
  if (!template) return '';
  
  let result = template;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, variables[key] || '');
  });
  
  return result;
}

/**
 * Send a workflow notification email.
 * Resolves recipients from a Keycloak client role, merges with explicit addresses,
 * and sends using the provided subject and body (no DB template lookup).
 *
 * @param {object} options
 * @param {'brins'|'tugure'} [options.targetRealm='brins'] - Keycloak realm
 * @param {string} [options.targetRole=''] - Client role name (e.g. 'checker-brins-role')
 * @param {string[]} [options.to=[]] - Explicit recipient email addresses
 * @param {object} [options.variables={}] - Variables for subject/body replacement
 * @param {string} options.fallbackSubject - Email subject (supports {var} replacement)
 * @param {string} options.fallbackBody - Email body HTML (supports {var} replacement)
 * @returns {Promise<void>}
 */
export async function sendNotificationEmail({
  targetRealm = 'brins',
  targetRole = '',
  to = [],
  variables = {},
  fallbackSubject = '',
  fallbackBody = '',
  // These params are accepted but ignored — kept for future emailTemplateHelper migration
  objectType,
  statusTo,
  recipientRole,
}) {
  const requestId = `EMAIL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[${requestId}][workflowEmail] ──────────────────────────────────────`);
  console.log(`[${requestId}][workflowEmail] Email Send Request Initiated`);
  console.log(`[${requestId}][workflowEmail] Template Parameters:`, {
    objectType: objectType || 'N/A',
    statusTo: statusTo || 'N/A',
    recipientRole: recipientRole || 'N/A',
  });
  console.log(`[${requestId}][workflowEmail] Target Destination:`, {
    realm: targetRealm,
    role: targetRole || '(no role)',
    explicitTo: to,
  });
  console.log(`[${requestId}][workflowEmail] Variables:`, variables);

  // 1. Resolve recipient emails from Keycloak client role
  const emailSet = new Set(Array.isArray(to) ? to : (to ? [to] : []));
  const resolvedFromRole = [];

  if (targetRole) {
    try {
      console.log(`[${requestId}][workflowEmail] Resolving recipients for role "${targetRole}" in realm "${targetRealm}"...`);
      const roleUsers = await backend.getUsersByRole(targetRealm, targetRole);
      if (Array.isArray(roleUsers)) {
        roleUsers.forEach(user => {
          if (user.email) {
            emailSet.add(user.email);
            resolvedFromRole.push(user.email);
          }
        });
        console.log(`[${requestId}][workflowEmail] ✓ Role resolution: found ${roleUsers.length} user(s), ${resolvedFromRole.length} with emails`);
        console.log(`[${requestId}][workflowEmail]   Resolved emails from role:`, resolvedFromRole);
      }
    } catch (err) {
      console.warn(`[${requestId}][workflowEmail] ✗ Failed to get users for role "${targetRole}" in realm "${targetRealm}":`, err.message);
    }
  }

  const recipients = [...emailSet].filter(Boolean);
  const explicitRecipients = Array.isArray(to) ? to : (to ? [to] : []);

  // Log recipient resolution breakdown
  console.log(`[${requestId}][workflowEmail] Recipient Resolution Summary:`);
  if (explicitRecipients.length > 0) {
    console.log(`[${requestId}][workflowEmail]   • From explicit addresses: ${explicitRecipients.length}`);
    explicitRecipients.forEach((email) => {
      console.log(`[${requestId}][workflowEmail]     └─ ${email}`);
    });
  } else {
    console.log(`[${requestId}][workflowEmail]   • From explicit addresses: 0`);
  }
  
  if (resolvedFromRole.length > 0) {
    console.log(`[${requestId}][workflowEmail]   • From role "${targetRole}": ${resolvedFromRole.length}`);
    resolvedFromRole.forEach((email) => {
      console.log(`[${requestId}][workflowEmail]     └─ ${email}`);
    });
  } else if (targetRole) {
    console.log(`[${requestId}][workflowEmail]   • From role "${targetRole}": 0`);
  }

  if (recipients.length === 0) {
    console.warn(`[${requestId}][workflowEmail] ✗ No recipients resolved. Email not sent.`);
    console.log(`[${requestId}][workflowEmail] ──────────────────────────────────────\n`);
    return;
  }

  // 2. Replace variables in subject and body
  const subject = replaceTemplateVariables(fallbackSubject, variables);
  const body = replaceTemplateVariables(fallbackBody, variables);

  if (!subject || !body) {
    console.warn(`[${requestId}][workflowEmail] ✗ No subject or body available. Email not sent.`, {
      hasSubject: !!subject,
      hasBody: !!body,
    });
    console.log(`[${requestId}][workflowEmail] ──────────────────────────────────────\n`);
    return;
  }

  console.log(`[${requestId}][workflowEmail] ✓ Final Recipients: ${recipients.length} email(s) (after deduplication)`);
  recipients.forEach((email, idx) => {
    console.log(`[${requestId}][workflowEmail]   [${idx + 1}] ${email}`);
  });
  console.log(`[${requestId}][workflowEmail] Email Subject:`, subject);
  console.log(`[${requestId}][workflowEmail] Email Body Preview:`, body.substring(0, 150) + (body.length > 150 ? '...' : ''));

  // 3. Send one email to all recipients
  try {
    console.log(`[${requestId}][workflowEmail] Sending email...`);
    await backend.sendDirectEmail({ to: recipients.join(', '), subject, body });
    console.log(`[${requestId}][workflowEmail] ✓ Email sent successfully to ${recipients.length} recipient(s).`);
  } catch (err) {
    console.error(`[${requestId}][workflowEmail] ✗ Failed to send email:`, err.message);
  }
  
  console.log(`[${requestId}][workflowEmail] ──────────────────────────────────────\n`);
}

/**
 * Convenience wrapper — same as sendNotificationEmail with renamed params.
 *
 * @param {object} options
 * @param {'brins'|'tugure'} options.realm - Keycloak realm
 * @param {string} options.roleName - Client role name
 * @param {string[]} [options.extraTo=[]] - Additional explicit email addresses
 * @param {object} [options.variables={}] - Template variables
 * @param {string} options.fallbackSubject - Email subject
 * @param {string} options.fallbackBody - Email body (HTML)
 * @returns {Promise<void>}
 */
export async function sendWorkflowEmail({
  realm,
  roleName,
  extraTo = [],
  variables = {},
  fallbackSubject,
  fallbackBody,
  // Passthrough for future migration
  objectType,
  statusTo,
  recipientRole,
}) {
  return sendNotificationEmail({
    targetRealm: realm,
    targetRole: roleName,
    to: extraTo,
    variables,
    fallbackSubject,
    fallbackBody,
    objectType,
    statusTo,
    recipientRole,
  });
}
