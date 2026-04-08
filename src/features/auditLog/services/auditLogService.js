import { backend } from "@/api/backendClient";

export async function loadData() {
    let data = await backend.list("AuditLog");
    if (data && data.length > 0) {
        data = data.filter(
            (log) =>
                !log.user_email?.includes("sibernetik") &&
                !log.user_email?.includes("@system"),
        );
    }
    return data || [];
}

export async function fetchDetail(id) {
    return backend.get("AuditLog", id);
}
