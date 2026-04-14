import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getFilesForRecord } from "@/services/storageService";

export function AttachmentCount({ recordId, batchId }) {
    const [count, setCount] = useState(null);

    useEffect(() => {
        if (!recordId || !batchId) {
            setCount(0);
            return;
        }

        let isMounted = true;
        
        getFilesForRecord(recordId, batchId)
            .then(files => {
                if (isMounted) setCount(files.length || 0);
            })
            .catch(() => {
                if (isMounted) setCount(0);
            });

        return () => {
             isMounted = false;
        };
    }, [recordId, batchId]);

    if (count === null) {
        return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
    }

    return <span className="text-sm text-gray-600">{count}</span>;
}

export default AttachmentCount;
