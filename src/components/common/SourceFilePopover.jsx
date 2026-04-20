import { useState } from "react";
import { FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { getFilesByPath, getDownloadUrl } from "@/services/storageService";

/**
 * Displays the source filename for a record. Clicking opens a popover
 * with file details and a download button that fetches the original
 * Excel from MinIO.
 *
 * @param {string|null} filename - The original upload filename (from DB).
 * @param {string|null} uploadDate - ISO date string of the upload.
 * @param {string} folder - MinIO top-level folder (e.g. 'batch', 'claim', 'master-contract').
 * @param {string} subfolder - MinIO subfolder (e.g. 'excel').
 * @param {string} recordId - Record identifier used when storing the file (batch_id, claim_no, contract_no).
 */
export default function SourceFilePopover({ filename, uploadDate, folder, subfolder = "excel", recordId }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  if (!filename) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const files = await getFilesByPath(folder, subfolder, recordId);
      if (!files || files.length === 0) {
        setError("File not found in storage");
        return;
      }
      const fileKey = files[0].key;
      const url = await getDownloadUrl(fileKey);
      if (url) {
        window.open(url, "_blank");
      } else {
        setError("Failed to generate download URL");
      }
    } catch (err) {
      console.error("Download error:", err);
      setError("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const formattedDate = uploadDate
    ? new Date(uploadDate).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer max-w-[160px] truncate"
          title={filename}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{filename}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium text-gray-500">Source File</p>
            <p className="text-sm font-medium break-all">{filename}</p>
          </div>
          {formattedDate && (
            <div>
              <p className="text-xs font-medium text-gray-500">Uploaded</p>
              <p className="text-sm">{formattedDate}</p>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1" />
            )}
            {downloading ? "Downloading..." : "Download Original"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
