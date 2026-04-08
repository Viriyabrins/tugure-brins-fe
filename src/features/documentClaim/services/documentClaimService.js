import { backend } from "@/api/backendClient";

export const documentClaimService = {
    async loadData() {
        const [batchData, docData, contractData] = await Promise.all([
            backend.list("Batch"),
            backend.list("Document"),
            backend.list("Contract"),
        ]);
        return {
            batches: Array.isArray(batchData) ? batchData : [],
            documents: (Array.isArray(docData) ? docData : []).filter((d) => d.claim_id),
            contracts: (Array.isArray(contractData) ? contractData : []).filter((c) => c.status === "ACTIVE"),
        };
    },

    async uploadDocuments(batch, files, userEmail) {
        for (const file of files) {
            const file_url = URL.createObjectURL(file);
            const existingDocs = (await backend.list("Document")).filter(
                (d) => d.batch_id === batch.batch_id && d.document_name === file.name && d.claim_id,
            );
            const latestVersion = existingDocs.length > 0 ? Math.max(...existingDocs.map((d) => d.version || 1)) : 0;
            await backend.create("Document", {
                batch_id: batch.batch_id,
                claim_id: batch.batch_id,
                document_type: "Claim Document",
                document_name: file.name,
                file_url,
                upload_date: new Date().toISOString().split("T")[0],
                status: "PENDING",
                version: latestVersion + 1,
                parent_document_id: existingDocs.length > 0 ? existingDocs[existingDocs.length - 1].id : null,
                uploaded_by: userEmail,
            });
        }
        await backend.create("Notification", {
            title: "Claim Documents Uploaded",
            message: `${files.length} claim documents uploaded for batch ${batch.batch_id}`,
            type: "INFO",
            module: "DOCUMENT",
            reference_id: batch.batch_id,
            target_role: "TUGURE",
        });
    },
};
