/**
 * Storage service for S3/MinIO operations.
 * Centralized wrapper for file upload, download, deletion, and listing.
 * Used by all features: claims, debtors, contracts, master-contracts, etc.
 */

import {
  uploadFile as minioUpload,
  deleteFile,
  listFiles,
  getPresignedUrl,
} from './minioClient.js';
import { validateFile, validateFiles } from '@/utils/fileValidation.js';

/**
 * Upload and validate a file to MinIO storage.
 * Automatically converts File/Blob to ArrayBuffer for browser compatibility.
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
    // Upload to MinIO with automatic ArrayBuffer conversion
    const result = await minioUpload(file, recordId, batchId);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Upload and validate multiple files to storage.
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
      const result = await minioUpload(file, recordId, batchId);
      uploaded.push(result);
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
      if (stopOnError) break;
    }
  }

  return { success: errors.length === 0, uploaded, errors };
}

/**
 * Get all files for a record.
 * 
 * @param {string} recordId - Record ID (claim_no, debtor ID, etc.)
 * @param {string} batchId - Batch ID
 * @returns {Promise<Array>} Array of file objects {key, fileName, size, lastModified, bucket}
 * 
 * @example
 * const files = await getFilesForRecord('CLM001', 'BATCH-2026-03');
 * console.log(files); // [{key: '...', fileName: 'document.pdf', size: 1024, ...}, ...]
 */
export async function getFilesForRecord(recordId, batchId) {
  try {
    return await listFiles(recordId, batchId);
  } catch (err) {
    console.error('Error fetching files:', err);
    return [];
  }
}

/**
 * Get a presigned download URL for a file.
 * URL expires in 30 minutes for security.
 * 
 * @param {string} fileKey - Full file key from MinIO (e.g., 'brins/BATCH-ID/RECORD-ID/filename')
 * @returns {Promise<string>} Presigned URL valid for 30 minutes
 * 
 * @example
 * const url = await getDownloadUrl('brins/BATCH-2026-03/CLM001/document.pdf');
 * window.open(url); // Opens file in new tab
 */
export async function getDownloadUrl(fileKey) {
  try {
    return await getPresignedUrl(fileKey);
  } catch (err) {
    console.error('Error generating download URL:', err);
    throw err;
  }
}

/**
 * Delete a file from storage.
 * 
 * @param {string} fileKey - Full file key from MinIO
 * @returns {Promise<void>}
 * 
 * @example
 * await removeFile('brins/BATCH-2026-03/CLM001/document.pdf');
 */
export async function removeFile(fileKey) {
  try {
    await deleteFile(fileKey);
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
    const files = await listFiles(recordId, batchId);
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
