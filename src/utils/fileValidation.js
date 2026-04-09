/**
 * File validation utilities for attachments across all features.
 * Centralized validation for file types, sizes, and counts.
 * Used by: claims, debtors, contracts, and other features.
 */

// Allowed file types and their MIME types
const ALLOWED_FILE_TYPES = {
  pdf: ['application/pdf'],
  excel: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
  word: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
  ppt: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'],
  text: ['text/plain', 'text/csv'],
};

// Flatten to array for easy checking
const ALLOWED_MIME_TYPES = Object.values(ALLOWED_FILE_TYPES).flat();

// File extensions for fallback checking
const ALLOWED_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.csv'];

// Constraints
export const FILE_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  MAX_FILES_PER_CLAIM: 5,
};

/**
 * Validate a single file.
 * @param {File} file
 * @returns {Object} {isValid: boolean, errors: string[]}
 */
export function validateFile(file) {
  const errors = [];

  if (!file) {
    errors.push('File is required');
    return { isValid: false, errors };
  }

  // Check file type by MIME type first, then by extension
  const isMimeTypeValid = ALLOWED_MIME_TYPES.includes(file.type);
  const extension = '.' + file.name.split('.').pop().toLowerCase();
  const isExtensionValid = ALLOWED_EXTENSIONS.includes(extension);

  if (!isMimeTypeValid && !isExtensionValid) {
    errors.push(
      `Invalid file type: ${file.type || 'unknown'}. Allowed: PDF, Excel, Word, PowerPoint, Text files`
    );
  }

  // Check file size
  if (file.size > FILE_CONSTRAINTS.MAX_FILE_SIZE) {
    errors.push(
      `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum (${FILE_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024}MB)`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate multiple files.
 * @param {File[]} files
 * @returns {Object} {isValid: boolean, errors: {fileName: string, error: string}[]}
 */
export function validateFiles(files) {
  if (!Array.isArray(files)) {
    return { isValid: false, errors: [{ error: 'Files must be an array' }] };
  }

  // Check file count
  if (files.length > FILE_CONSTRAINTS.MAX_FILES_PER_CLAIM) {
    return {
      isValid: false,
      errors: [
        {
          error: `Too many files (${files.length}). Maximum allowed: ${FILE_CONSTRAINTS.MAX_FILES_PER_CLAIM}`,
        },
      ],
    };
  }

  if (files.length === 0) {
    return { isValid: true, errors: [] };
  }

  // Validate each file
  const errors = [];
  files.forEach((file) => {
    const validation = validateFile(file);
    if (!validation.isValid) {
      errors.push({
        fileName: file.name,
        errors: validation.errors,
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get human-readable file size.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file icon based on extension or MIME type.
 * @param {string} fileName
 * @returns {string} Icon emoji
 */
export function getFileIcon(fileName) {
  const extension = '.' + fileName.split('.').pop().toLowerCase();

  if (['.pdf'].includes(extension)) return '📄';
  if (['.xlsx', '.xls', '.csv'].includes(extension)) return '📊';
  if (['.docx', '.doc'].includes(extension)) return '📝';
  if (['.pptx', '.ppt'].includes(extension)) return '🎯';
  if (['.txt'].includes(extension)) return '📃';

  return '📎'; // Default generic file icon
}

/**
 * Build error message from validation errors.
 * @param {Object} validation - Result from validateFiles
 * @returns {string} Message for display
 */
export function buildValidationErrorMessage(validation) {
  if (validation.isValid) return '';

  if (validation.errors.length === 1 && !validation.errors[0].fileName) {
    return validation.errors[0].error;
  }

  const details = validation.errors
    .map((err) => {
      if (err.fileName) {
        return `${err.fileName}: ${
          Array.isArray(err.errors) ? err.errors.join('; ') : err.errors
        }`;
      }
      return err.error || err;
    })
    .join('\n');

  return `❌ File validation failed:\n${details}`;
}

export default {
  validateFile,
  validateFiles,
  formatFileSize,
  getFileIcon,
  buildValidationErrorMessage,
  FILE_CONSTRAINTS,
};
