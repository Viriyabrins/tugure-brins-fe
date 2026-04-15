/**
 * Storage service for file operations via backend API.
 * Centralized wrapper for file upload, download, deletion, and listing.
 * Backend handles all MinIO interactions (credentials not exposed to frontend).
 * Used by all features: claims, debtors, contracts, master-contracts, etc.
 */

import { validateFile, validateFiles } from '@/utils/fileValidation.js';

const API_BASE = (import.meta.env.VITE_API_PROXY || '') + '/api';

/**
 * Upload and validate a file via backend API.
 * 
 * @param {File} file - File to upload
 * @param {Object} options - Upload options
 * @param {string} options.recordId - Record ID (claim_no, debtor ID, etc.)
 * @param {string} options.batchId - Batch ID for organization
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 * 
 * @example
 * const result = await uploadFileToStorage(file, { recordId: 'CLM001', batchId: 'BATCH-2026-03' });
 * if (result.success) console.log('Uploaded:', result.data.key);
 */
export async function uploadFileToStorage(file, options) {
  const { recordId, batchId } = options;

  if (!recordId || !batchId) {
    return { success: false, error: 'recordId and batchId are required' };
  }

  // Validate file
  const validation = validateFile(file);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  try {
    const formData = new FormData();
    // Fields must come before file so backend can read them during stream parsing
    formData.append('recordId', recordId);
    formData.append('batchId', batchId);
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.data || data };
  } catch (err) {
    console.error('Upload error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upload and validate multiple files via backend API.
 * Stops on first error or validates all before uploading.
 * 
 * @param {File[]} files - Array of files to upload
 * @param {Object} options - Upload options
 * @param {string} options.recordId - Record ID
 * @param {string} options.batchId - Batch ID
 * @param {boolean} [options.stopOnError=true] - Stop uploading if validation fails
 * @returns {Promise<{success: boolean, uploaded: object[], errors: string[]}>}
 */
export async function uploadMultipleFiles(files, options) {
  const { recordId, batchId, stopOnError = true } = options;

  if (!recordId || !batchId) {
    return { success: false, uploaded: [], errors: ['recordId and batchId are required'] };
  }

  // Validate all files first
  const validation = validateFiles(files);
  if (!validation.isValid) {
    const errorMessages = validation.errors.map((err) =>
      err.fileName ? `${err.fileName}: ${err.errors.join('; ')}` : err.error
    );
    if (stopOnError) {
      return { success: false, uploaded: [], errors: errorMessages };
    }
  }

  // Upload all valid files
  const uploaded = [];
  const errors = [];

  for (const file of files) {
    const fileValidation = validateFile(file);
    if (!fileValidation.isValid) {
      errors.push(`${file.name}: ${fileValidation.errors.join('; ')}`);
      if (stopOnError) break;
      continue;
    }

    try {
      const result = await uploadFileToStorage(file, { recordId, batchId });
      if (result.success) {
        uploaded.push(result.data);
      } else {
        errors.push(`${file.name}: ${result.error}`);
        if (stopOnError) break;
      }
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
      if (stopOnError) break;
    }
  }

  return { success: errors.length === 0, uploaded, errors };
}

/**
 * Get all files for a record via backend API.
 * 
 * @param {string} recordId - Record ID (claim_no, debtor ID, etc.)
 * @param {string} batchId - Batch ID
 * @returns {Promise<Array>} Array of file objects {key, fileName, size, lastModified}
 * 
 * @example
 * const files = await getFilesForRecord('CLM001', 'BATCH-2026-03');
 * console.log(files); // [{key: '...', fileName: 'document.pdf', size: 1024, ...}, ...]
 */
export async function getFilesForRecord(recordId, batchId) {
  try {
    const params = new URLSearchParams({ recordId, batchId });
    const response = await fetch(`${API_BASE}/files?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch files with status ${response.status}`);
    }

    const data = await response.json();
    return data.data?.files || [];
  } catch (err) {
    console.error('Error fetching files:', err);
    return [];
  }
}

/**
 * Get a presigned download URL for a file via backend API.
 * URL expires in 30 minutes for security.
 * 
 * @param {string} fileKey - Full file key (e.g., 'BATCH-ID/RECORD-ID/filename')
 * @returns {Promise<string>} Presigned URL valid for 30 minutes
 * 
 * @example
 * const url = await getDownloadUrl('BATCH-2026-03/CLM001/document.pdf');
 * window.open(url); // Opens file in new tab
 */
export async function getDownloadUrl(fileKey) {
  try {
    const params = new URLSearchParams({ key: fileKey });
    const response = await fetch(`${API_BASE}/files/download-url?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to get download URL with status ${response.status}`);
    }

    const data = await response.json();
    return data.data?.url || data.url;
  } catch (err) {
    console.error('Error generating download URL:', err);
    throw err;
  }
}

/**
 * Delete a file from storage via backend API.
 * 
 * @param {string} fileKey - Full file key
 * @returns {Promise<void>}
 * 
 * @example
 * await removeFile('BATCH-2026-03/CLM001/document.pdf');
 */
export async function removeFile(fileKey) {
  try {
    // Encode the key for URL
    const encodedKey = encodeURIComponent(fileKey);
    const response = await fetch(`${API_BASE}/files/${encodedKey}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file with status ${response.status}`);
    }
  } catch (err) {
    console.error('Error deleting file:', err);
    throw err;
  }
}

/**
 * Get total size of all files for a record (useful for quota checking).
 * 
 * @param {string} recordId - Record ID
 * @param {string} batchId - Batch ID
 * @returns {Promise<number>} Total size in bytes
 */
export async function getTotalFilesSize(recordId, batchId) {
  try {
    const files = await getFilesForRecord(recordId, batchId);
    return files.reduce((sum, file) => sum + (file.size || 0), 0);
  } catch (err) {
    console.error('Error calculating total file size:', err);
    return 0;
  }
}

export default {
  uploadFileToStorage,
  uploadMultipleFiles,
  getFilesForRecord,
  getDownloadUrl,
  removeFile,
  getTotalFilesSize,
};
