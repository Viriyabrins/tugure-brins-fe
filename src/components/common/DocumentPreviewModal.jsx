import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * A modal component for previewing documents inline.
 * 
 * Props:
 *   open      {boolean} - Modal visibility state
 *   onClose   {() => void} - Close handler
 *   url       {string} - The URL of the document to preview
 *   fileName  {string} - The name of the file
 */
export function DocumentPreviewModal({ open, onClose, url, fileName }) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b shrink-0 bg-white">
                    <DialogTitle className="truncate" title={fileName}>
                        Preview: {fileName || "Document"}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 min-h-0 bg-gray-100 relative">
                    {url ? (
                        <iframe
                            src={url}
                            title={fileName || "Document Preview"}
                            className="w-full h-full border-none bg-white"
                        />
                    ) : (
                        <div className="flex items-center justify-center w-full h-full text-gray-500">
                            No preview URL available
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t shrink-0 bg-white">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default DocumentPreviewModal;
