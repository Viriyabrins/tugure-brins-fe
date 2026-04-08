import { backend } from "@/api/backendClient";

export const documentEligibilityService = {
    async loadData() {
        const [batchData, debtorData, docData, contractData] = await Promise.all([
            backend.list("Batch"),
            backend.list("Debtor"),
            backend.list("Document"),
            backend.list("MasterContract"),
        ]);
        return {
            batches: batchData || [],
            debtors: debtorData || [],
            documents: (docData || []).filter((d) => !d.claim_id),
            contracts: (contractData || []).filter((c) => c.effective_status === "Active"),
        };
    },

    async uploadDocuments(batch, files, existingDocuments, userEmail) {
        for (const file of files) {
            const { file_url } = await backend.uploadFile(file);
            const existing = existingDocuments.filter((d) => d.batch_id === batch.batch_id && d.document_name === file.name && !d.claim_id);
            const latestVersion = existing.length > 0 ? Math.max(...existing.map((d) => d.version || 1)) : 0;
            await backend.create("Document", { batch_id: batch.batch_id, document_type: "General Document", document_name: file.name, file_url, upload_date: new Date().toISOString().split("T")[0], status: "PENDING", version: latestVersion + 1, parent_document_id: existing.length > 0 ? existing[existing.length - 1].id : null, uploaded_by: userEmail });
        }
        await backend.create("Notification", { title: "Batch Documents Uploaded", message: `${files.length} documents uploaded for batch ${batch.batch_id}`, type: "INFO", module: "DOCUMENT", reference_id: batch.batch_id, target_role: "TUGURE" });
    },

    async deleteDocs(docIds) {
        for (const id of docIds) await backend.delete("Document", id);
    },
};
