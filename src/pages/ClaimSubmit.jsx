import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
    FileText,
    Upload,
    Send,
    CheckCircle2,
    AlertCircle,
    Download,
    RefreshCw,
    Loader2,
    Eye,
    Plus,
    DollarSign,
    Clock,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { formatRupiahAdaptive } from "@/utils/currency";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import * as XLSX from "xlsx";

const defaultFilter = {
    contract: "all",
    batch: "",
    claimStatus: "all",
    subrogationStatus: "all",
}

const HEADER_ALIAS_MAP = {
    nama_tertanggung: "nama_tertanggung",
    no_ktp_npwp: "no_ktp_npwp",
    no_ktp__npwp: "no_ktp_npwp",
    noktp_npwp: "no_ktp_npwp",
    no_fasilitas_kredit: "no_fasilitas_kredit",
    bdo_premi: "bdo_premi",
    tanggal_realisasi_kredit: "tanggal_realisasi_kredit",
    plafond: "plafond",
    max_coverage: "max_coverage",
    kol_debitur: "kol_debitur",
    dol: "dol",
    nilai_klaim: "nilai_klaim",
    claimno: "claim_no",
    claim_no: "claim_no",
    policyno: "policy_no",
    policy_no: "policy_no",
    nomor_sertifikat: "nomor_sertifikat",
    share_tugure: "share_tugure",
    share_tugure_percentage: "share_tugure_percentage",
    share_tugure_amount: "share_tugure_amount",
    check_bdo_premi: "check_bdo_premi",
    nomor_peserta: "nomor_peserta",
    no: "no",
};

const normalizeHeader = (header = "") => {
    const normalized = String(header)
        .trim()
        .toLowerCase()
        .replace(/[%().]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
    return HEADER_ALIAS_MAP[normalized] || normalized;
};

const toNullableString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text === "" ? null : text;
};

const toNumber = (value) => {
    if (value === undefined || value === null || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    let text = String(value).trim();
    if (!text) return 0;

    text = text.replace(/\s/g, "");
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");

    if (lastComma > -1 && lastDot > -1) {
        if (lastComma > lastDot) {
            text = text.replace(/\./g, "").replace(",", ".");
        } else {
            text = text.replace(/,/g, "");
        }
    } else if (lastComma > -1) {
        text = text.replace(/\./g, "").replace(",", ".");
    } else if (lastDot > -1) {
        if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
            text = text.replace(/\./g, "");
        }
    }

    text = text.replace(/[^\d.-]/g, "");
    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toBoolean = (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "boolean") return value;

    const text = String(value).trim().toLowerCase();
    return ["true", "1", "yes", "y", "v", "☑", "✅", "checked"].includes(
        text,
    );
};

const maskKtp = (value) => {
    const text = toNullableString(value);
    if (!text) return null;
    if (text.length <= 3) return text;
    return `${text.slice(0, 3)}${"*".repeat(text.length - 3)}`;
};

const getExcelDate = (value) => {
    if (value === undefined || value === null || value === "") return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
    }
    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed) return null;
        const date = new Date(
            Date.UTC(
                parsed.y,
                (parsed.m || 1) - 1,
                parsed.d || 1,
                parsed.H || 0,
                parsed.M || 0,
                parsed.S || 0,
            ),
        );
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    const text = String(value).trim();
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export default function ClaimSubmit() {
    const [user, setUser] = useState(null);
    const [userRoles, setUserRoles] = useState([]);
    const [claims, setClaims] = useState([]);
    const [subrogations, setSubrogations] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [batches, setBatches] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showSubrogationDialog, setShowSubrogationDialog] = useState(false);
    const [showRevisionDialog, setShowRevisionDialog] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState("");
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [validationRemarks, setValidationRemarks] = useState([]);
    const [selectedClaim, setSelectedClaim] = useState("");
    const [recoveryAmount, setRecoveryAmount] = useState("");
    const [recoveryDate, setRecoveryDate] = useState("");
    const [subrogationRemarks, setSubrogationRemarks] = useState("");
    const [activeTab, setActiveTab] = useState("claims");
    const [uploadFile, setUploadFile] = useState(null);
    const [parsedClaims, setParsedClaims] = useState([]);
    const [filters, setFilters] = useState(defaultFilter);
    const canShowActionButtons = userRoles.some((role) => {
        const normalizedRole = String(role || "").trim().toLowerCase();
        return (
            normalizedRole === "maker-brins-role" ||
            normalizedRole === "checker-brins-role"
        );
    });

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

    const loadUser = async () => {
        try {
            const { default: keycloakService } = await import('@/services/keycloakService');
            const userInfo = keycloakService.getCurrentUserInfo();
            if (userInfo) {
                const roles = keycloakService.getRoles();
                const roleList = Array.isArray(roles) ? roles : [];
                const normalizedRoles = roleList
                    .map((roleName) => String(roleName || "").trim().toLowerCase())
                    .filter(Boolean);
                setUserRoles(roleList);
                let role = 'USER';
                if (normalizedRoles.includes('admin')) role = 'admin';
                else if (normalizedRoles.includes('approver-brins-role')) role = 'approver';
                else if (normalizedRoles.includes('checker-brins-role')) role = 'checker';
                else if (normalizedRoles.includes('maker-brins-role')) role = 'maker';
                setUser({ id: userInfo.id, email: userInfo.email, full_name: userInfo.name, role });
            }
        } catch (error) {
            console.error("Failed to load user:", error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        setErrorMessage("");

        try {
            // Load semua data menggunakan backend client
            const [
                claimData,
                subrogationData,
                debtorData,
                batchData,
                contractData,
            ] = await Promise.all([
                backend.list("Claim"),
                backend.list("Subrogation"),
                backend.list("Debtor"),
                backend.list("Batch"),
                backend.list("Contract"),
            ]);

            // Pastikan data adalah array
            setClaims(Array.isArray(claimData) ? claimData : []);
            setSubrogations(
                Array.isArray(subrogationData) ? subrogationData : [],
            );
            setDebtors(Array.isArray(debtorData) ? debtorData : []);
            setBatches(Array.isArray(batchData) ? batchData : []);
            setContracts(Array.isArray(contractData) ? contractData : []);
        } catch (error) {
            console.error("Failed to load data:", error);
            setErrorMessage("Failed to load data. Please refresh the page.");

            // Set default empty arrays
            setClaims([]);
            setSubrogations([]);
            setDebtors([]);
            setBatches([]);
            setContracts([]);
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        const sampleData = [
            "CERT-001,PT Maju Jaya,1234567890001,FK-001,2025-01,2025-01-15,500000000,375000000,1,2025-06-15,250000000,75,187500000,true,P-001,POL-001",
            "CERT-002,CV Berkah Abadi,1234567890002,FK-002,2025-01,2025-01-16,300000000,225000000,1,2025-06-16,150000000,75,112500000,true,P-002,POL-001",
        ];

        const headers = [
            "nomor_sertifikat",
            "nama_tertanggung",
            "no_ktp_npwp",
            "no_fasilitas_kredit",
            "bdo_premi",
            "tanggal_realisasi_kredit",
            "plafond",
            "max_coverage",
            "kol_debitur",
            "dol",
            "nilai_klaim",
            "share_tugure_percentage",
            "share_tugure_amount",
            "check_bdo_premi",
            "nomor_peserta",
            "policy_no",
        ];

        const csvContent = headers.join(",") + "\n" + sampleData.join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "claim_template.csv";
        a.click();
    };

    const formatDateToISO = (dateInput) => getExcelDate(dateInput);

    const parseUploadRows = async (file) => {
        const fileName = (file?.name || "").toLowerCase();
        if (
            !(
                fileName.endsWith(".csv") ||
                fileName.endsWith(".xlsx") ||
                fileName.endsWith(".xls")
            )
        ) {
            throw new Error("Unsupported file format. Please upload .csv, .xlsx, or .xls");
        }

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, {
            type: "array",
            cellDates: true,
            raw: false,
        });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: "",
            blankrows: false,
        });

        if (!Array.isArray(rows) || rows.length <= 1) {
            throw new Error("No data found in file");
        }

        const headers = (rows[0] || []).map((h) => normalizeHeader(h));
        const headerIndexMap = headers.reduce((acc, header, idx) => {
            if (!acc[header]) acc[header] = [];
            acc[header].push(idx);
            return acc;
        }, {});

        const getFirstIndex = (candidates) => {
            for (const candidate of candidates) {
                const indices = headerIndexMap[candidate];
                if (Array.isArray(indices) && indices.length > 0) return indices[0];
            }
            return -1;
        };

        const idxNomorPeserta = getFirstIndex(["nomor_peserta"]);
        const idxPolicyNo = getFirstIndex(["policy_no", "policyno"]);
        const idxNomorSertifikat = getFirstIndex(["nomor_sertifikat"]);
        const idxNamaTertanggung = getFirstIndex(["nama_tertanggung"]);
        const idxKtp = getFirstIndex(["no_ktp_npwp", "noktp_npwp"]);
        const idxFasilitas = getFirstIndex(["no_fasilitas_kredit"]);
        const idxBdoPremi = getFirstIndex(["bdo_premi"]);
        const idxTanggalRealisasi = getFirstIndex(["tanggal_realisasi_kredit"]);
        const idxPlafond = getFirstIndex(["plafond"]);
        const idxMaxCoverage = getFirstIndex(["max_coverage"]);
        const idxKolDebitur = getFirstIndex(["kol_debitur"]);
        const idxDol = getFirstIndex(["dol"]);
        const idxNilaiKlaim = getFirstIndex(["nilai_klaim"]);
        const idxCheckBdoPremi = getFirstIndex(["check_bdo_premi"]);
        const idxSharePctDirect = getFirstIndex(["share_tugure_percentage"]);
        const idxShareAmtDirect = getFirstIndex(["share_tugure_amount"]);

        const shareHeaderIndices = headerIndexMap.share_tugure || [];

        const bodyRows = rows.slice(1);
        return bodyRows.map((rowValues, index) => {
            const values = Array.isArray(rowValues) ? rowValues : [];
            const read = (idx) => (idx >= 0 ? values[idx] : "");
            const findShareValues = () => {
                if (idxSharePctDirect >= 0 || idxShareAmtDirect >= 0) {
                    return {
                        percentage: read(idxSharePctDirect),
                        amount: read(idxShareAmtDirect),
                    };
                }

                const candidateIndexes = [...shareHeaderIndices];
                if (candidateIndexes.length === 0) {
                    const start = idxNomorSertifikat >= 0 ? idxNomorSertifikat + 1 : 0;
                    const end =
                        idxCheckBdoPremi >= 0 ? idxCheckBdoPremi : Math.max(values.length - 1, 0);
                    for (let i = start; i < end; i++) {
                        candidateIndexes.push(i);
                    }
                }

                let percentage = null;
                let amount = null;
                for (const idx of candidateIndexes) {
                    const raw = read(idx);
                    const text = String(raw ?? "").trim();
                    if (!text) continue;
                    if (text.includes("%") && percentage === null) {
                        percentage = raw;
                        continue;
                    }
                    if (amount === null) {
                        amount = raw;
                    }
                }

                return { percentage, amount };
            };

            const shareValues = findShareValues();

            return {
                excelRow: index + 2,
                policy_no: toNullableString(read(idxPolicyNo)),
                nomor_sertifikat: toNullableString(read(idxNomorSertifikat)),
                nama_tertanggung: toNullableString(read(idxNamaTertanggung)),
                no_ktp_npwp_raw: toNullableString(read(idxKtp)),
                no_fasilitas_kredit: toNullableString(read(idxFasilitas)),
                bdo_premi: toNullableString(read(idxBdoPremi)),
                tanggal_realisasi_kredit: read(idxTanggalRealisasi),
                plafond: toNumber(read(idxPlafond)),
                max_coverage: toNumber(read(idxMaxCoverage)),
                kol_debitur: toNullableString(read(idxKolDebitur)),
                dol: read(idxDol),
                nilai_klaim: toNumber(read(idxNilaiKlaim)),
                share_tugure_percentage: toNumber(shareValues.percentage),
                share_tugure_amount: toNumber(shareValues.amount),
                check_bdo_premi: toBoolean(read(idxCheckBdoPremi)),
                nomor_peserta: toNullableString(read(idxNomorPeserta)),
            };
        });
    };

    const handleFileUpload = async (file) => {
        if (!file || !selectedBatch) return;

        setProcessing(true);
        setErrorMessage("");
        setValidationRemarks([]);
        setParsedClaims([]);

        try {
            // selectedBatch bisa berupa id atau batch_id
            const batch = batches.find(
                (b) => b.batch_id === selectedBatch || b.id === selectedBatch,
            );

            if (!batch) {
                setErrorMessage("Batch not found");
                setProcessing(false);
                return;
            }

            // Ambil debtors untuk batch ini
            const batchDebtors = debtors.filter(
                (d) => d.batch_id === batch.batch_id,
            );

            const rows = await parseUploadRows(file);

            const parsed = [];
            const validationErrors = [];

            for (const row of rows) {
                const debtor = batchDebtors.find(
                    (d) =>
                        String(d.nomor_peserta || "").trim() ===
                            String(row.nomor_peserta || "").trim() &&
                        String(d.policy_no || "").trim() ===
                            String(row.policy_no || "").trim(),
                );

                let rowRemarks = [];
                if (!debtor) {
                    rowRemarks.push(
                        "Debtor not found in batch (match by nomor peserta & policy no)",
                    );
                } else {
                    if (debtor.status !== "APPROVED") {
                        rowRemarks.push("Debtor not approved");
                    }
                    if (
                        Number(row.nilai_klaim) >
                        (parseFloat(debtor.plafon) || 0)
                    ) {
                        rowRemarks.push(`Exceeds plafond (${debtor.plafon})`);
                    }
                }

                if (rowRemarks.length > 0) {
                    validationErrors.push({
                        row: row.excelRow,
                        participant: row.nomor_peserta || "Unknown",
                        issues: rowRemarks,
                    });
                }

                parsed.push({
                    policy_no: row.policy_no,
                    nomor_sertifikat: row.nomor_sertifikat,
                    nama_tertanggung: row.nama_tertanggung,
                    no_ktp_npwp: maskKtp(row.no_ktp_npwp_raw),
                    no_fasilitas_kredit: row.no_fasilitas_kredit,
                    bdo_premi: row.bdo_premi,
                    tanggal_realisasi_kredit: row.tanggal_realisasi_kredit,
                    plafond: Number(row.plafond) || 0,
                    max_coverage: Number(row.max_coverage) || 0,
                    kol_debitur: row.kol_debitur,
                    dol: row.dol,
                    nilai_klaim: Number(row.nilai_klaim) || 0,
                    share_tugure_percentage: Number(row.share_tugure_percentage) || 0,
                    share_tugure_amount: Number(row.share_tugure_amount) || 0,
                    check_bdo_premi: !!row.check_bdo_premi,
                    validation_remarks: rowRemarks.join("; "),
                    debtor_id: debtor?.id,
                    contract_id: debtor?.contract_id,
                    batch_id: debtor?.batch_id,
                });
            }

            setParsedClaims(parsed);
            setValidationRemarks(validationErrors);

            if (validationErrors.length > 0) {
                setErrorMessage(
                    `${validationErrors.length} validation issues found`,
                );
            } else {
                setSuccessMessage(
                    `Parsed ${parsed.length} claims - all validated`,
                );
            }
        } catch (error) {
            console.error("Parse error:", error);
            setErrorMessage("Failed to parse file: " + error.message);
        }
        setProcessing(false);
    };

    const handleBulkUpload = async () => {
        if (
            !Array.isArray(parsedClaims) ||
            parsedClaims.length === 0 ||
            !selectedBatch
        ) {
            setErrorMessage("No valid claims to upload");
            return;
        }

        setProcessing(true);

        try {
            const batch = batches.find((b) => b.batch_id === selectedBatch);

            if (!batch) {
                setErrorMessage("Batch not found");
                setProcessing(false);
                return;
            }

            // Validate Nota payment
            let batchNotas = [];
            try {
                const notasResponse = await backend.list("Nota");
                batchNotas = notasResponse.filter(
                    (n) =>
                        n.reference_id === batch.batch_id &&
                        n.nota_type === "Batch",
                );
            } catch (notaError) {
                console.error("Error checking notas:", notaError);
            }

            const hasCompletedPayment = batchNotas.some(
                (n) => n.status === "Nota Closed",
            );

            if (!hasCompletedPayment && batchNotas.length > 0) {
                setErrorMessage(
                    `❌ BLOCKED: Claim submission not allowed. Nota must be PAID first.`,
                );

                try {
                    await backend.create("AuditLog", {
                        action: "BLOCKED_CLAIM_SUBMISSION",
                        module: "CLAIM",
                        entity_type: "Batch",
                        entity_id: batch.batch_id,
                        old_value: "{}",
                        new_value: JSON.stringify({
                            blocked_reason: "Nota not PAID",
                        }),
                        user_email: user?.email,
                        user_role: user?.role,
                        reason: "Attempted claim submission before Nota payment",
                    });
                } catch (auditError) {
                    console.error("Failed to create audit log:", auditError);
                }

                setProcessing(false);
                return;
            }

            let uploaded = 0;
            let errors = [];

            for (const claim of parsedClaims) {
                if (claim.validation_remarks) continue;

                try {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, "0");
                    const sequence = String(uploaded + 1).padStart(6, "0");
                    const claimNo = `CLM-${year}-${month}-${sequence}`;

                    const tanggalRealisasiISO = formatDateToISO(
                        claim.tanggal_realisasi_kredit,
                    );
                    const dolISO = formatDateToISO(claim.dol);

                    await backend.create("Claim", {
                        claim_no: claimNo,
                        policy_no: claim.policy_no,
                        nomor_sertifikat: claim.nomor_sertifikat,
                        nama_tertanggung: claim.nama_tertanggung,
                        no_ktp_npwp: claim.no_ktp_npwp,
                        no_fasilitas_kredit: claim.no_fasilitas_kredit,
                        bdo_premi: claim.bdo_premi,
                        tanggal_realisasi_kredit: tanggalRealisasiISO,
                        plafond: claim.plafond,
                        max_coverage: claim.max_coverage,
                        kol_debitur: claim.kol_debitur,
                        dol: dolISO,
                        nilai_klaim: claim.nilai_klaim,
                        share_tugure_percentage: claim.share_tugure_percentage,
                        share_tugure_amount: claim.share_tugure_amount,
                        check_bdo_premi: claim.check_bdo_premi,
                        debtor_id: claim.debtor_id || "",
                        contract_id: claim.contract_id || "",
                        batch_id: batch.batch_id,
                        status: "Draft",
                        version_no: 1,
                    });

                    // Create audit log
                    await backend.create("AuditLog", {
                        action: "CLAIM_CREATED",
                        module: "CLAIM",
                        entity_type: "Claim",
                        entity_id: claimNo,
                        old_value: "{}",
                        new_value: JSON.stringify({
                            batch_id: batch.batch_id,
                            nilai_klaim: claim.nilai_klaim,
                        }),
                        user_email: user?.email,
                        user_role: user?.role,
                        reason: "Bulk upload from file",
                    });

                    uploaded++;
                } catch (createError) {
                    errors.push(`Row ${uploaded + 1}: ${createError.message}`);
                    console.error("Failed to create claim:", createError);
                }
            }

            // Create notification for bulk upload
            if (uploaded > 0) {
                try {
                    await backend.create("Notification", {
                        title: "Bulk Claim Upload",
                        message: `${uploaded} claims uploaded for batch ${batch.batch_id}`,
                        type: "INFO",
                        module: "CLAIM",
                        reference_id: batch.batch_id,
                        target_role: "TUGURE",
                    });
                } catch (notifError) {
                    console.error("Failed to create notification:", notifError);
                }
            }

            if (errors.length > 0) {
                setErrorMessage(
                    `Uploaded ${uploaded} claims, but ${errors.length} failed: ${errors.join("; ")}`,
                );
            } else {
                setSuccessMessage(`✓ Successfully uploaded ${uploaded} claims`);
            }

            setShowUploadDialog(false);
            setParsedClaims([]);
            setSelectedBatch("");

            // Reload data
            setTimeout(() => {
                loadData();
            }, 1000);
        } catch (error) {
            console.error("Upload error:", error);
            setErrorMessage("Failed to upload claims: " + error.message);
        }
        setProcessing(false);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Claim Submission"
                subtitle="Submit reinsurance claims per batch"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Claim Submit" },
                ]}
                actions={
                    canShowActionButtons ? (
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                onClick={loadData}
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={downloadTemplate}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download Template
                            </Button>
                            <Button 
                                variant="outline"
                                onClick={() => setShowUploadDialog(true)}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Bulk Upload
                            </Button>
                        </div>
                    ) : null
                }
            />

            {successMessage && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        {successMessage}
                    </AlertDescription>
                </Alert>
            )}

            {errorMessage && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            {validationRemarks.length > 0 && (
                <Card className="border-orange-300 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="text-orange-700">
                            Validation Issues
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {validationRemarks.map((remark, idx) => (
                                <Alert
                                    key={idx}
                                    className="bg-orange-100 border-orange-300"
                                >
                                    <AlertCircle className="h-4 w-4 text-orange-600" />
                                    <AlertDescription className="text-orange-800">
                                        <strong>
                                            Row {remark.row} (
                                            {remark.participant}):
                                        </strong>{" "}
                                        {remark.issues.join(", ")}
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </div>
                        {canShowActionButtons && (
                            <Button
                                className="mt-3 bg-orange-600"
                                size="sm"
                                onClick={() => setShowRevisionDialog(true)}
                            >
                                Re-upload Revised Only
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Gradient Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard
                    title="Total Claims"
                    value={claims.length}
                    subtitle={formatRupiahAdaptive(
                        claims.reduce(
                            (s, c) => s + (Number(c.nilai_klaim) || 0),
                            0,
                        ),
                    )}
                    icon={FileText}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title="Draft Claims"
                    value={claims.filter((c) => c.status === "Draft").length}
                    subtitle="Pending check"
                    icon={Clock}
                    gradient="from-orange-500 to-orange-600"
                />
                <GradientStatCard
                    title="Total Subrogation"
                    value={subrogations.length}
                    subtitle={formatRupiahAdaptive(
                        subrogations.reduce(
                            (s, sub) => s + (Number(sub.recovery_amount) || 0),
                            0,
                        ),
                    )}
                    icon={DollarSign}
                    gradient="from-green-500 to-green-600"
                />
                <GradientStatCard
                    title="Recovered"
                    value={
                        subrogations.filter((s) => s.status === "Paid / Closed")
                            .length
                    }
                    subtitle="Completed"
                    icon={CheckCircle2}
                    gradient="from-purple-500 to-purple-600"
                />
            </div>

            {/* Filters */}
            <FilterTab
                filters={filters}
                onFilterChange={setFilters}
                defaultFilters={defaultFilter}
                filterConfig={[
                    {
                        key: "contract",
                        label: "Contract",
                        options: [
                            { value: "all", label: "All Contracts" },
                            ...contracts.map((c) => ({
                                value: c.contract_id,
                                label: c.contract_number,
                            })),
                        ],
                    },
                    {
                        key: "batch",
                        placeholder: "Batch ID",
                        label: "Batch ID",
                        options: [
                            { value: "all", label: "All Batches" },
                            ...batches.map((b) => ({
                                value: b.batch_id,
                                label: b.batch_id,
                            })),
                        ],
                    },
                    {
                        key: "claimStatus",
                        label: "Claim Status",
                        options: [
                            { value: "all", label: "    All Claim Status" },
                            { value: "Draft", label: "Draft" },
                            { value: "Checked", label: "Checked" },
                            { value: "Doc Verified", label: "Doc Verified" },
                            { value: "Invoiced", label: "Invoiced" },
                            { value: "Paid", label: "Paid" },
                        ],
                    },
                    {
                        key: "subrogationStatus",
                        label: "Subrogation Status",
                        options: [
                            { value: "all", label: "All Subrogation" },
                            { value: "Draft", label: "Draft" },
                            { value: "Invoiced", label: "Invoiced" },
                            { value: "Paid / Closed", label: "Paid / Closed" },
                        ],
                    },
                ]}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="claims">
                        <FileText className="w-4 h-4 mr-2" />
                        Claims ({claims.length})
                    </TabsTrigger>
                    <TabsTrigger value="subrogation">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Subrogation ({subrogations.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="claims" className="mt-4">
                    <DataTable
                        columns={[
                            { header: "Claim No", accessorKey: "claim_no" },
                            {
                                header: "Debtor",
                                accessorKey: "nama_tertanggung",
                            },
                            {
                                header: "Claim Amount",
                                cell: (row) =>
                                    `Rp ${(parseFloat(row.nilai_klaim) || 0).toLocaleString("id-ID")}`,
                            },
                            {
                                header: "Status",
                                cell: (row) => (
                                    <StatusBadge status={row.status} />
                                ),
                            },
                        ]}
                        data={claims.filter((c) => {
                            if (
                                filters.contract !== "all" &&
                                c.contract_id !== filters.contract
                            )
                                return false;
                            if (
                                filters.batch &&
                                !c.batch_id?.includes(filters.batch)
                            )
                                return false;
                            if (
                                filters.claimStatus !== "all" &&
                                c.status !== filters.claimStatus
                            )
                                return false;
                            return true;
                        })}
                        isLoading={loading}
                        emptyMessage="No claims submitted"
                    />
                </TabsContent>

                <TabsContent value="subrogation" className="mt-4">
                    <div className="mb-4 flex justify-end">
                        {canShowActionButtons && (
                            <Button
                                onClick={() => setShowSubrogationDialog(true)}
                                className="bg-green-600"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Subrogation
                            </Button>
                        )}
                    </div>
                    <DataTable
                        columns={[
                            {
                                header: "Subrogation ID",
                                accessorKey: "subrogation_id",
                            },
                            { header: "Claim ID", accessorKey: "claim_id" },
                            {
                                header: "Recovery Amount",
                                cell: (row) =>
                                    formatRupiahAdaptive(
                                        subrogations.reduce(
                                            (s, sub) =>
                                                s +
                                                (Number(sub.recovery_amount) ||
                                                    0),
                                            0,
                                        ),
                                    ),
                            },
                            {
                                header: "Recovery Date",
                                cell: (row) =>
                                    row.recovery_date
                                        ? new Date(
                                              row.recovery_date,
                                          ).toLocaleDateString("id-ID")
                                        : "-",
                            },
                            {
                                header: "Status",
                                cell: (row) => (
                                    <StatusBadge status={row.status} />
                                ),
                            },
                        ]}
                        data={subrogations.filter((s) => {
                            if (
                                filters.subrogationStatus !== "all" &&
                                s.status !== filters.subrogationStatus
                            )
                                return false;
                            return true;
                        })}
                        isLoading={loading}
                        emptyMessage="No subrogation records"
                    />
                </TabsContent>
            </Tabs>

            {/* Upload Dialog */}
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bulk Upload Claims</DialogTitle>
                        <DialogDescription>
                            Select batch and upload CSV/Excel file
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Select Batch *</Label>
                            <Select
                                value={selectedBatch}
                                onValueChange={setSelectedBatch}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select batch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.isArray(batches) &&
                                        batches.map((b) => (
                                            <SelectItem key={b.id} value={b.id}>
                                                {b.batch_id} (
                                                {b.batch_month || ""}/
                                                {b.batch_year || ""})
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Upload File</Label>
                            <Input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setUploadFile(file);
                                        handleFileUpload(file);
                                    }
                                }}
                                disabled={!selectedBatch}
                            />
                        </div>
                        {parsedClaims.length > 0 && (
                            <Alert className="bg-green-50 border-green-200">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-700">
                                    Parsed {parsedClaims.length} claims
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                    {canShowActionButtons && (
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowUploadDialog(false);
                                    setParsedClaims([]);
                                    setSelectedBatch("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleBulkUpload}
                                disabled={processing || parsedClaims.length === 0}
                                className="bg-blue-600"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    `Upload ${parsedClaims.length} Claims`
                                )}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Revision Dialog */}
            <Dialog
                open={showRevisionDialog}
                onOpenChange={setShowRevisionDialog}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Re-upload Revised Claims</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Alert className="bg-blue-50 border-blue-200">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                                Upload only revised rows that had issues
                            </AlertDescription>
                        </Alert>
                        <Input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    handleFileUpload(file);
                                    setShowRevisionDialog(false);
                                }
                            }}
                            className="mt-4"
                        />
                    </div>
                    {canShowActionButtons && (
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowRevisionDialog(false)}
                            >
                                Close
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Subrogation Dialog */}
            <Dialog
                open={showSubrogationDialog}
                onOpenChange={setShowSubrogationDialog}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Subrogation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Select Claim</Label>
                            <Select
                                value={selectedClaim}
                                onValueChange={setSelectedClaim}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select paid claim" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.isArray(claims) &&
                                        claims
                                            .filter((c) => c.status === "Paid")
                                            .map((c) => (
                                                <SelectItem
                                                    key={c.id}
                                                    value={c.id}
                                                >
                                                    {c.claim_no} -{" "}
                                                    {c.nama_tertanggung}
                                                </SelectItem>
                                            ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Recovery Amount</Label>
                            <Input
                                type="number"
                                value={recoveryAmount}
                                onChange={(e) =>
                                    setRecoveryAmount(e.target.value)
                                }
                            />
                        </div>
                        <div>
                            <Label>Recovery Date</Label>
                            <Input
                                type="date"
                                value={recoveryDate}
                                onChange={(e) =>
                                    setRecoveryDate(e.target.value)
                                }
                            />
                        </div>
                    </div>
                    {canShowActionButtons && (
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowSubrogationDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={async () => {
                                    if (!selectedClaim || !recoveryAmount) return;

                                    try {
                                        const claim = claims.find(
                                            (c) => c.claim_no === selectedClaim,
                                        );

                                        const subrogationId = `SUB-${Date.now()}`;

                                        await backend.create("Subrogation", {
                                            subrogation_id: subrogationId,
                                            claim_id: claim.claim_no,
                                            debtor_id: claim.debtor_id,
                                            recovery_amount:
                                                parseFloat(recoveryAmount),
                                            recovery_date:
                                                formatDateToISO(recoveryDate),
                                            status: "Draft",
                                            remarks: subrogationRemarks,
                                        });

                                        // Create audit log
                                        await backend.create("AuditLog", {
                                            action: "SUBROGATION_CREATED",
                                            module: "SUBROGATION",
                                            entity_type: "Subrogation",
                                            entity_id: subrogationId,
                                            old_value: "{}",
                                            new_value: JSON.stringify({
                                                claim_id: claim.claim_no,
                                                recovery_amount: recoveryAmount,
                                            }),
                                            user_email: user?.email,
                                            user_role: user?.role,
                                            reason: "Manual subrogation creation",
                                        });

                                        // Create notification
                                        await backend.create("Notification", {
                                            title: "New Subrogation Created",
                                            message: `Subrogation ${subrogationId} created for claim ${claim.claim_no}`,
                                            type: "INFO",
                                            module: "SUBROGATION",
                                            reference_id: subrogationId,
                                            target_role: "TUGURE",
                                        });

                                        setSuccessMessage("Subrogation created");
                                        setShowSubrogationDialog(false);
                                        setSelectedClaim("");
                                        setRecoveryAmount("");
                                        setRecoveryDate("");
                                        setSubrogationRemarks("");
                                        loadData();
                                    } catch (error) {
                                        console.error(
                                            "Failed to create subrogation:",
                                            error,
                                        );
                                        setErrorMessage(
                                            "Failed to create subrogation: " +
                                                error.message,
                                        );
                                    }
                                }}
                                disabled={!selectedClaim || !recoveryAmount}
                            >
                                Create
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
