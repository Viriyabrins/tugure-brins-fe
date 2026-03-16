import React, { useState, useEffect, useMemo } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
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
import {
    FileText,
    Upload,
    CheckCircle2,
    AlertCircle,
    Download,
    RefreshCw,
    Loader2,
    Plus,
    DollarSign,
    Clock,
    TrendingUp,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { formatRupiahAdaptive } from "@/utils/currency";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import * as XLSX from "xlsx";
import { sendNotificationEmail } from "@/components/utils/emailTemplateHelper";

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
    kol: "kol_debitur",
    kol_debitur: "kol_debitur",
    dol: "dol",
    claim_amount: "nilai_klaim",
    nilai_klaim: "nilai_klaim",
    tahun_polis: "tahun_polis",
    bordero_klaim: "bordero_klaim",
    claimno: "claim_no",
    claim_no: "claim_no",
    policyno: "policy_no",
    policy_no: "policy_no",
    polyno: "policy_no",
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
        .replace(/[%()\.\/]/g, "")
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
    const [uploadTabActive, setUploadTabActive] = useState(1); // 1 = upload, 2 = preview
    const [previewValidationError, setPreviewValidationError] = useState("");
    const [showValidationDetails, setShowValidationDetails] = useState(false);
    // Subrogation create preview step: 1 = edit, 2 = preview
    const [subrogationTabActive, setSubrogationTabActive] = useState(1);
    const [subrogationPreviewError, setSubrogationPreviewError] = useState("");
    const [filters, setFilters] = useState(defaultFilter);
    const [claimPage, setClaimPage] = useState(1);
    const [totalClaims, setTotalClaims] = useState(0);
    const claimPageSize = 10;
    const [allClaimsForTrend, setAllClaimsForTrend] = useState([]);
    const [notas, setNotas] = useState([]);
    const canShowActionButtons = userRoles.some((role) => {
        const normalizedRole = String(role || "").trim().toLowerCase();
        return (
            normalizedRole === "maker-brins-role" ||
            normalizedRole === "checker-brins-role"
        );
    });

    // Determine user tenant: prefer 'tugure' roles. If any role contains 'tugure',
    // treat user as Tugure. Otherwise, if any role contains 'brins', treat as Brins.
    const _normalizedRoles = Array.isArray(userRoles)
        ? userRoles.map((r) => String(r || "").trim().toLowerCase())
        : [];
    const isTugureUser = _normalizedRoles.some((r) => r.includes("tugure"));
    const isBrinsUser = !isTugureUser && _normalizedRoles.some((r) => r.includes("brins"));

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

    // Reset to page 1 when filters change
    useEffect(() => {
        if (claimPage !== 1) setClaimPage(1);
    }, [filters.contract, filters.batch, filters.claimStatus, filters.subrogationStatus]);

    // Reload when page or filters change
    useEffect(() => {
        loadClaims(claimPage);
    }, [claimPage, filters.contract, filters.batch, filters.claimStatus, filters.subrogationStatus]);

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
                allClaimData,
                notaData,
            ] = await Promise.all([
                backend.listPaginated("Claim", { page: 1, limit: claimPageSize, q: JSON.stringify(filters) }),
                backend.list("Subrogation"),
                backend.list("Debtor"),
                backend.list("Batch"),
                backend.list("Contract"),
                backend.list("Claim"),
                backend.list("Nota"),
            ]);

            // Pastikan data adalah array
            const claimArr = claimData?.data || claimData;
            setClaims(Array.isArray(claimArr) ? claimArr : []);
            setTotalClaims(Number(claimData?.pagination?.total) || 0);
            setClaimPage(1);
            setSubrogations(
                Array.isArray(subrogationData) ? subrogationData : [],
            );
            setDebtors(Array.isArray(debtorData) ? debtorData : []);
            setBatches(Array.isArray(batchData) ? batchData : []);
            setContracts(Array.isArray(contractData) ? contractData : []);
            setAllClaimsForTrend(Array.isArray(allClaimData) ? allClaimData : []);
            setNotas(Array.isArray(notaData) ? notaData : []);
        } catch (error) {
            console.error("Failed to load data:", error);
            setErrorMessage("Failed to load data. Please refresh the page.");

            // Set default empty arrays
            setClaims([]);
            setSubrogations([]);
            setDebtors([]);
            setBatches([]);
            setContracts([]);
            setNotas([]);
        } finally {
            setLoading(false);
        }
    };

    const loadClaims = async (pageToLoad = claimPage) => {
        try {
            const result = await backend.listPaginated("Claim", {
                page: pageToLoad,
                limit: claimPageSize,
                q: JSON.stringify(filters),
            });
            setClaims(Array.isArray(result.data) ? result.data : []);
            setTotalClaims(Number(result.pagination?.total) || 0);
        } catch (error) {
            console.error("Failed to load claims:", error);
        }
    };

    const downloadTemplate = () => {
        const ll = [
            "CERT-001,PT Maju Jaya,1234567890001,FK-001,2025-01,2025-01-15,500000000,375000000,1,2025-06-15,250000000,75,187500000,true,P-001,POL-001",
            "CERT-002,CV Berkah Abadi,1234567890002,FK-002,2025-01,2025-01-16,300000000,225000000,1,2025-06-16,150000000,75,112500000,true,P-002,POL-001",
        ];
        const sampleData = [
            "Grace;;4;45831;131.194.944,00;811514102502483;1115141023000261;3;324623;0000K.01199.2025.11.00001.1.1;Dec-1;43,50%;57.069.800,64"
        ];

        const headers = [
            "nama_tertanggung",
            "no_ktp_npwp",
            "kol",
            "dol",
            "claim_amount",
            "claim_no",
            "policy_no",
            "tahun_polis",
            "nomor_sertifikat",
            "nomor_peserta",
            "bordero_klaim",
            "share_tugure_percentage",
            "share_tugure_amount"
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
        const idxTahunPolis = getFirstIndex(["tahun_polis"]);
        const idxBorderoKlaim = getFirstIndex(["bordero_klaim"]);
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
                tahun_polis: toNullableString(read(idxTahunPolis)),
                bordero_klaim: toNullableString(read(idxBorderoKlaim)),
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

                // New validation rules per request:
                // 1) Only verify that (nomor_peserta + policy_no) exists in the selected batch.
                // 2) Duplicate checks are handled after parsing (within-file and within selected batch).
                let rowRemarks = [];
                if (!debtor) {
                    rowRemarks.push(
                        "Debtor not found in batch (match by participant number & policy number)",
                    );
                }

                if (rowRemarks.length > 0) {
                    validationErrors.push({
                        row: row.excelRow,
                        participant: row.nomor_peserta || "Unknown",
                        issues: rowRemarks,
                    });
                }

                parsed.push({
                    excelRow: row.excelRow,
                    policy_no: row.policy_no,
                    nomor_sertifikat: row.nomor_sertifikat,
                    nama_tertanggung: row.nama_tertanggung,
                    nomor_peserta: row.nomor_peserta,
                    no_ktp_npwp: maskKtp(row.no_ktp_npwp_raw),
                    no_fasilitas_kredit: row.no_fasilitas_kredit,
                    bdo_premi: row.bdo_premi,
                    tanggal_realisasi_kredit: row.tanggal_realisasi_kredit,
                    plafond: Number(row.plafond) || 0,
                    max_coverage: Number(row.max_coverage) || 0,
                    kol_debitur: row.kol_debitur,
                    dol: row.dol,
                    nilai_klaim: Number(row.nilai_klaim) || 0,
                    tahun_polis: row.tahun_polis,
                    bordero_klaim: row.bordero_klaim,
                    share_tugure_percentage: Number(row.share_tugure_percentage) || 0,
                    share_tugure_amount: Number(row.share_tugure_amount) || 0,
                    check_bdo_premi: !!row.check_bdo_premi,
                    validation_remarks: rowRemarks.join("; "),
                    debtor_id: debtor?.id,
                    contract_id: debtor?.contract_id,
                    batch_id: debtor?.batch_id,
                });
            }

            // Duplicate validation: within uploaded file and within the selected batch only
            try {
                // Normalize key: policy_no + nomor_peserta
                const keyOf = (r) => `${String(r.policy_no || "").trim().toLowerCase()}||${String(r.nomor_peserta || "").trim().toLowerCase()}`;

                // 1) within-file duplicates
                const fileMap = {};
                for (const p of parsed) {
                    const k = keyOf(p);
                    if (!fileMap[k]) fileMap[k] = [];
                    fileMap[k].push(p);
                }

                for (const k of Object.keys(fileMap)) {
                    const group = fileMap[k];
                    if (group.length > 1) {
                        for (const item of group) {
                            validationErrors.push({
                                row: item.excelRow,
                                participant: item.nomor_peserta || "Unknown",
                                issues: ["Duplicate in uploaded file (policy number & participant)"],
                            });
                            item.validation_remarks = [item.validation_remarks, "Duplicate in uploaded file (policy number & participant)"].filter(Boolean).join("; ");
                        }
                    }
                }

                // 2) duplicates against existing claims within the same batch
                let existingClaims = [];
                try {
                    const claimResult = await backend.listPaginated("Claim", { limit: 9999 });
                    existingClaims = claimResult?.data || [];
                } catch (_) {
                    existingClaims = [];
                }

                const existingKeys = new Set(
                    existingClaims
                        .filter((c) => c.batch_id === batch.batch_id)
                        .map((c) => keyOf(c)),
                );

                for (const item of parsed) {
                    const k = keyOf(item);
                    if (existingKeys.has(k)) {
                        validationErrors.push({
                            row: item.excelRow,
                            participant: item.nomor_peserta || "Unknown",
                            issues: ["Duplicate with existing claim in selected batch (policy number & participant)"],
                        });
                        item.validation_remarks = [item.validation_remarks, "Duplicate with existing claim in selected batch (policy number & participant)"].filter(Boolean).join("; ");
                    }
                }
            } catch (dupErr) {
                console.warn("Duplicate check failed:", dupErr);
            }

            setParsedClaims(parsed);
            setValidationRemarks(validationErrors);

            // Build a dynamic, English summary message for the preview alert
            const buildPreviewValidationMessage = (errors) => {
                if (!Array.isArray(errors) || errors.length === 0) return "";
                const counts = { debtorNotFound: 0, duplicateInFile: 0, duplicateInBatch: 0, other: 0 };
                const otherSamples = {};

                for (const e of errors) {
                    for (const issue of e.issues) {
                        const txt = String(issue || "").toLowerCase();
                        if (txt.includes("debtor not found")) counts.debtorNotFound++;
                        else if (txt.includes("duplicate in uploaded file")) counts.duplicateInFile++;
                        else if (txt.includes("duplicate with existing claim")) counts.duplicateInBatch++;
                        else {
                            counts.other++;
                            otherSamples[issue] = (otherSamples[issue] || 0) + 1;
                        }
                    }
                }

                const parts = [];
                if (counts.debtorNotFound) parts.push(`${counts.debtorNotFound} rows where policy number or participant ID do not match any debtor in the selected batch`);
                if (counts.duplicateInFile) parts.push(`${counts.duplicateInFile} rows duplicated inside the uploaded file (policy number & participant)`);
                if (counts.duplicateInBatch) parts.push(`${counts.duplicateInBatch} rows duplicate with existing claims in the selected batch`);
                if (counts.other) parts.push(`${counts.other} rows with other issues`);

                const joined = parts.join("; ");
                return `Found ${errors.length} rows with validation issues: ${joined}. Please fix the source file and re-upload, or click Back to adjust the upload. Click 'View details' for row-level information.`;
            };

            const summaryMsg = buildPreviewValidationMessage(validationErrors);
            if (validationErrors.length > 0) {
                setErrorMessage(`${validationErrors.length} validation issues found`);
                setPreviewValidationError(summaryMsg);
            } else {
                setSuccessMessage(
                    `Parsed ${parsed.length} ${isBrinsUser ? 'recoveries' : 'claims'} - all validated`,
                );
                setPreviewValidationError("");
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
            setErrorMessage(isBrinsUser ? "No valid recoveries to upload" : "No valid claims to upload");
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
                (n) => n.status === "PAID",
            );

            if (!hasCompletedPayment && batchNotas.length > 0) {
                setErrorMessage(
                    `❌ BLOCKED: ${isBrinsUser ? 'Recovery' : 'Claim'} submission not allowed. Nota must be PAID first.`,
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

            // Find next available sequence for this month
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const prefix = `CLM-${year}-${month}-`;

            let existingClaims = [];
            try {
                const claimResult = await backend.listPaginated("Claim", { limit: 9999 });
                existingClaims = claimResult?.data || [];
            } catch (_) {
                existingClaims = [];
            }
            let maxSeq = 0;
            for (const c of existingClaims) {
                if (c.claim_no && c.claim_no.startsWith(prefix)) {
                    const seqStr = c.claim_no.replace(prefix, "");
                    const seq = parseInt(seqStr, 10);
                    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                }
            }

            for (const claim of parsedClaims) {
                if (claim.validation_remarks) continue;

                try {
                    maxSeq++;
                    const sequence = String(maxSeq).padStart(6, "0");
                    const claimNo = `${prefix}${sequence}`;

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
                        // tahun_polis: claim.tahun_polis,
                        share_tugure_percentage: claim.share_tugure_percentage,
                        share_tugure_amount: claim.share_tugure_amount,
                        check_bdo_premi: claim.check_bdo_premi,
                        debtor_id: claim.debtor_id || "",
                        contract_id: claim.contract_id || "",
                        batch_id: batch.batch_id,
                        nomor_peserta: claim.nomor_peserta,
                        status: "SUBMITTED",
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
                        title: isBrinsUser ? "Bulk Recovery Upload" : "Bulk Claim Upload",
                        message: `${uploaded} ${isBrinsUser ? 'recoveries' : 'claims'} uploaded for batch ${batch.batch_id}`,
                        type: "INFO",
                        module: "CLAIM",
                        reference_id: batch.batch_id,
                        target_role: "tugure-checker-role",
                    });

                    // Send Email to Tugure Checker
                    sendNotificationEmail({
                        targetGroup: "tugure-checker",
                        objectType: "Record",
                        statusTo: "SUBMITTED",
                        recipientRole: "TUGURE",
                        variables: {
                            claim_count: String(uploaded),
                            action_by: user?.email,
                            batch_id: batch.batch_id,
                        },
                        fallbackSubject: isBrinsUser ? "New Recoveries Submitted" : "New Claims Submitted",
                        fallbackBody: `${uploaded} ${isBrinsUser ? 'recoveries' : 'claims'} have been submitted by ${user?.email} for batch ${batch.batch_id} and await checking.`,
                    }).catch(e => console.error("Background email fail:", e));
                } catch (notifError) {
                    console.error("Failed to create notification:", notifError);
                }
            }

            if (errors.length > 0) {
                setErrorMessage(
                    `Uploaded ${uploaded} ${isBrinsUser ? 'recoveries' : 'claims'}, but ${errors.length} failed: ${errors.join("; ")}`,
                );
            } else {
                setSuccessMessage(`✓ Successfully uploaded ${uploaded} ${isBrinsUser ? 'recoveries' : 'claims'}`);
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
            setErrorMessage("Failed to upload " + (isBrinsUser ? "recoveries: " : "claims: ") + error.message);
        }
        setProcessing(false);
    };

    const columns = [
        { header: "Claim No", accessorKey: "claim_no" },
        {
            header:"Batch ID",
            accessorKey: "batch_id"
        },
        {
            header: "Debtor",
            accessorKey: "nama_tertanggung",
            cell: (row) => (
                <div>
                    <div className="font-medium">{row.nama_tertanggung}</div>
                    <div className="text-xs text-gray-500">
                        {row.nomor_peserta}
                    </div>
                </div>
            )
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
    ]

    return (
        <div className="space-y-6">
            <PageHeader
                title={isBrinsUser ? "Recovery Submission" : "Claim Submission"}
                subtitle={isBrinsUser ? "Submit recoveries per batch" : "Submit reinsurance claims per batch"}
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: isBrinsUser ? "Recovery Submit" : "Claim Submit" },
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

            {/* Validation issues are shown in the upload preview dialog only. */}

            {/* Gradient Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard
                    title={isBrinsUser ? "Total Recoveries" : "Total Claims"}
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
                    title={isBrinsUser ? "Submitted Recoveries" : "Submitted Claims"}
                    value={claims.filter((c) => c.status === "SUBMITTED").length}
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
                        label: isBrinsUser ? "Recovery Status" : "Claim Status",
                        options: [
                            { value: "all", label: isBrinsUser ? "    All Recovery Status" : "    All Claim Status" },
                            { value: "SUBMITTED", label: "Submitted" },
                            { value: "CHECKED", label: "Checked" },
                            { value: "APPROVED", label: "Approved" },
                            { value: "REVISION", label: "Revision" },
                        ],
                    },
                    // {
                    //     key: "subrogationStatus",
                    //     label: "Subrogation Status",
                    //     options: [
                    //         { value: "all", label: "All Subrogation" },
                    //         { value: "Draft", label: "Draft" },
                    //         { value: "Invoiced", label: "Invoiced" },
                    //         { value: "Paid / Closed", label: "Paid / Closed" },
                    //     ],
                    // },
                ]}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="claims">
                        <FileText className="w-4 h-4 mr-2" />
                        {isBrinsUser ? "Recoveries" : "Claims"} ({claims.length})
                    </TabsTrigger>
                    <TabsTrigger value="subrogation">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Subrogation ({subrogations.length})
                    </TabsTrigger>
                    <TabsTrigger value="trend">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Trend Analysis
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="claims" className="mt-4">
                    <DataTable
                        columns={columns}
                        data={claims}
                        isLoading={loading}
                        emptyMessage={isBrinsUser ? "No recoveries submitted" : "No claims submitted"}
                        pagination={{
                            from: totalClaims === 0 ? 0 : (claimPage - 1) * claimPageSize + 1,
                            to: Math.min(totalClaims, claimPage * claimPageSize),
                            total: totalClaims,
                            page: claimPage,
                            totalPages: Math.max(1, Math.ceil(totalClaims / claimPageSize)),
                        }}
                        onPageChange={(p) => setClaimPage(p)}
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

                <TabsContent value="trend" className="mt-4">
                    {(() => {
                        const batchMap = {};
                        batches.forEach((b) => {
                            batchMap[b.batch_id] = {
                                batch_month: b.batch_month,
                                batch_year: b.batch_year,
                            };
                        });
                        const monthMap = {};
                        allClaimsForTrend.forEach((claim) => {
                            const bInfo = batchMap[claim.batch_id];
                            if (!bInfo || !bInfo.batch_month || !bInfo.batch_year) return;
                            const key = `${bInfo.batch_year}-${String(bInfo.batch_month).padStart(2, "0")}`;
                            if (!monthMap[key]) {
                                const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                                monthMap[key] = {
                                    sortKey: key,
                                    label: `${monthNames[(bInfo.batch_month - 1) % 12]} ${bInfo.batch_year}`,
                                    nilai_klaim: 0,
                                    share_tugure_amount: 0,
                                };
                            }
                            monthMap[key].nilai_klaim += Number(claim.nilai_klaim) || 0;
                            monthMap[key].share_tugure_amount += Number(claim.share_tugure_amount) || 0;
                        });
                        const trendData = Object.values(monthMap).sort((a, b) =>
                            a.sortKey.localeCompare(b.sortKey)
                        );

                        const toB = (v) => (v / 1_000_000_000).toFixed(2);

                        const CustomTooltip = ({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            return (
                                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                                    <p className="font-semibold text-gray-700 mb-1">{label}</p>
                                    {payload.map((entry) => (
                                        <p key={entry.dataKey} style={{ color: entry.color }}>
                                            {entry.name}:{" "}
                                            <span className="font-medium">
                                                {formatRupiahAdaptive(entry.value * 1_000_000_000)}
                                            </span>
                                        </p>
                                    ))}
                                </div>
                            );
                        };

                        return (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-teal-600" />
                                        Trend Analysis
                                    </CardTitle>
                                    <p className="text-sm text-gray-500">
                                        {isBrinsUser ? "Recovery" : "Claim"} value trend by batch period
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    {trendData.length === 0 ? (
                                        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                                            No data available for trend analysis
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex gap-6 mb-4 flex-wrap">
                                                <div style={{ backgroundColor: '#1D4E32' }} className="rounded-lg px-4 py-2">
                                                    <p className="text-xs text-green-100">Total {isBrinsUser ? "Recovery" : "Claim"} Value</p>
                                                    <p className="text-lg font-semibold text-white">
                                                        {formatRupiahAdaptive(
                                                            allClaimsForTrend.reduce((s, c) => s + (Number(c.nilai_klaim) || 0), 0)
                                                        )}
                                                    </p>
                                                </div>
                                                <div style={{ backgroundColor: '#0D9488' }} className="rounded-lg px-4 py-2">
                                                    <p className="text-xs text-teal-100">Total Share Tugure Amount</p>
                                                    <p className="text-lg font-semibold text-white">
                                                        {formatRupiahAdaptive(
                                                            allClaimsForTrend.reduce((s, c) => s + (Number(c.share_tugure_amount) || 0), 0)
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                                                    <p className="text-xs text-gray-500">Periods</p>
                                                    <p className="text-lg font-semibold text-gray-700">{trendData.length}</p>
                                                </div>
                                            </div>
                                            <div className="h-80">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart
                                                        data={trendData.map((d) => ({
                                                            ...d,
                                                            nilai_klaim_b: parseFloat(toB(d.nilai_klaim)),
                                                            share_tugure_b: parseFloat(toB(d.share_tugure_amount)),
                                                        }))}
                                                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                        <XAxis
                                                            dataKey="label"
                                                            tick={{ fontSize: 12 }}
                                                            stroke="#6B7280"
                                                        />
                                                        <YAxis
                                                            tick={{ fontSize: 12 }}
                                                            stroke="#6B7280"
                                                            tickFormatter={(v) => formatRupiahAdaptive(v * 1_000_000_000)}
                                                            label={{
                                                                value: "IDR",
                                                                angle: -90,
                                                                position: "insideLeft",
                                                                offset: 10,
                                                                style: { fontSize: 11, fill: "#6B7280" },
                                                            }}
                                                        />
                                                        <Tooltip content={CustomTooltip} />
                                                        <Legend />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="nilai_klaim_b"
                                                            stroke="#1D4E32"
                                                            strokeWidth={3}
                                                            name={isBrinsUser ? "Recovery Value (Annual)" : "Nilai Klaim (Annual)"}
                                                            dot={{ fill: "#1D4E32", r: 5 }}
                                                            activeDot={{ r: 7 }}
                                                        />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="share_tugure_b"
                                                            stroke="#0D9488"
                                                            strokeWidth={3}
                                                            name="Share Tugure Amount (Annual)"
                                                            dot={{ fill: "#0D9488", r: 5 }}
                                                            activeDot={{ r: 7 }}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })()}
                </TabsContent>
            </Tabs>

            {/* Upload Dialog (two-step: Upload -> Preview) */}
            <Dialog
                open={showUploadDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowUploadDialog(false);
                        setParsedClaims([]);
                        setSelectedBatch("");
                        setUploadFile(null);
                        setUploadTabActive(1);
                        setPreviewValidationError("");
                        setErrorMessage("");
                        setSuccessMessage("");
                    }
                }}
            >
                <DialogContent
                    className="max-w-4xl w-full"
                    style={{
                        maxHeight: "90vh",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}
                >
                    <DialogHeader className="shrink-0">
                        <DialogTitle>
                            {uploadTabActive === 1
                                ? (isBrinsUser ? "Upload Recoveries" : "Upload Claims")
                                : (isBrinsUser ? "Recovery Preview" : "Claim Preview")}
                        </DialogTitle>
                        <DialogDescription>
                            {uploadTabActive === 1
                                ? "Pilih batch lalu upload file CSV/Excel. Preview terlebih dahulu sebelum submit."
                                : (isBrinsUser ? "Periksa data sebelum mengunggah recovery ke sistem." : "Periksa data sebelum mengunggah klaim ke sistem.")}
                        </DialogDescription>

                        {/* Stepper */}
                        <div className="flex mt-3">
                            <div
                                className={`flex items-center gap-2 flex-1 pb-3 text-sm border-b-2 transition-all duration-300 ${
                                    uploadTabActive === 1
                                        ? "border-blue-600 text-blue-600 font-medium"
                                        : "border-green-600 text-green-600"
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                                        uploadTabActive === 1
                                            ? "bg-blue-600 text-white"
                                            : "bg-green-600 text-white"
                                    }`}
                                >
                                    {uploadTabActive === 1 ? "1" : "✓"}
                                </div>
                                Upload {isBrinsUser ? "Recoveries" : "Claims"}
                            </div>
                            <div
                                className={`flex items-center gap-2 flex-1 pb-3 text-sm border-b-2 transition-all duration-300 ${
                                    uploadTabActive === 2
                                        ? "border-blue-600 text-blue-600 font-medium"
                                        : "border-gray-200 text-gray-400"
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                                        uploadTabActive === 2
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 text-gray-500"
                                    }`}
                                >
                                    2
                                </div>
                                {isBrinsUser ? "Recovery Preview" : "Claim Preview"}
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="py-4 space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
                        {/* Tab 1: Upload */}
                        {uploadTabActive === 1 && (
                            <>
                                <div>
                                    <Label>Select Batch *</Label>
                                    <Select
                                        value={selectedBatch}
                                        onValueChange={(v) => {
                                            setSelectedBatch(v);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select batch" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.isArray(batches) &&
                                                batches.map((b) => (
                                                    <SelectItem key={b.id} value={b.id}>
                                                        {b.batch_id} ({b.batch_month || ""}/{b.batch_year || ""})
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
                                                // clear previous preview
                                                setParsedClaims([]);
                                                setValidationRemarks([]);
                                                setPreviewValidationError("");
                                                setSuccessMessage("");
                                                setErrorMessage("");
                                            }
                                        }}
                                        disabled={!selectedBatch}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Excel atau CSV format</p>
                                </div>
                            </>
                        )}

                        {/* Tab 2: Preview */}
                        {uploadTabActive === 2 && (
                            <>
                                <div className="flex gap-3 flex-wrap">
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">Total Rows</p>
                                        <p className="text-xl font-medium">{parsedClaims.length}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">Batch</p>
                                        <p className="text-sm font-medium mt-1">{selectedBatch}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">File</p>
                                        <p className="text-sm font-medium mt-1">{uploadFile?.name}</p>
                                    </div>
                                </div>

                                {validationRemarks.length > 0 ? (
                                    <Alert className="bg-red-50 border-red-200">
                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                        <AlertDescription className="text-red-700">
                                            {previewValidationError || `Found ${validationRemarks.length} rows with validation issues. Please fix the source file and re-upload, or click "Back" to adjust the upload.`}
                                            <div className="mt-2">
                                                <Button variant="outline" size="sm" onClick={() => setShowValidationDetails(true)}>View details</Button>
                                            </div>
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Alert className="bg-blue-50 border-blue-200">
                                        <AlertCircle className="h-4 w-4 text-blue-600" />
                                        <AlertDescription className="text-blue-700">
                                            Below is a preview of claims that will be uploaded. Review before confirming.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "340px", border: "1px solid #e5e7eb", borderRadius: "8px", width: "100%" }}>
                                    <table className="text-xs" style={{ minWidth: "max-content", borderCollapse: "collapse" }}>
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                                {["#","nomor_peserta","policy_no","nama_tertanggung","nomor_sertifikat","nilai_klaim","share_tugure_percentage","share_tugure_amount"].map((k) => (
                                                    <th key={k} className="text-left p-2 font-medium text-gray-500 border-b whitespace-nowrap" style={{ minWidth: k === "#" ? "36px" : "140px" }}>
                                                        {k === "#" ? "#" : k.replace(/_/g, " ")}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedClaims.map((row, i) => (
                                                <tr key={i} className="hover:bg-gray-50 border-b border-gray-100">
                                                    <td className="p-2 text-gray-400 whitespace-nowrap">{i+1}</td>
                                                    <td className="p-2 whitespace-nowrap">{row.nomor_peserta ?? "-"}</td>
                                                    <td className="p-2 whitespace-nowrap">{row.policy_no ?? "-"}</td>
                                                    <td className="p-2 whitespace-nowrap">{row.nama_tertanggung ?? "-"}</td>
                                                    <td className="p-2 whitespace-nowrap">{row.nomor_sertifikat ?? "-"}</td>
                                                    <td className="p-2 whitespace-nowrap">Rp {(Number(row.nilai_klaim) || 0).toLocaleString("id-ID")}</td>
                                                    <td className="p-2 whitespace-nowrap">{row.share_tugure_percentage ?? "-"}</td>
                                                    <td className="p-2 whitespace-nowrap">{row.share_tugure_amount ?? "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {showValidationDetails && validationRemarks.length > 0 && (
                                    <div className="mt-3 p-3 border rounded bg-white" style={{ maxHeight: "220px", overflowY: "auto" }}>
                                        <p className="text-sm font-medium mb-2">Validation details (row, participant, issues)</p>
                                        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                                            <thead>
                                                <tr className="text-left text-gray-500">
                                                    <th className="p-2" style={{ width: "64px" }}>Row</th>
                                                    <th className="p-2" style={{ minWidth: "160px" }}>Participant</th>
                                                    <th className="p-2">Issues</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {validationRemarks.map((v, idx) => (
                                                    <tr key={idx} className="border-t border-gray-100">
                                                        <td className="p-2 whitespace-nowrap">{v.row}</td>
                                                        <td className="p-2 whitespace-nowrap">{v.participant}</td>
                                                        <td className="p-2">{Array.isArray(v.issues) ? v.issues.join("; ") : String(v.issues)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowUploadDialog(false);
                                setParsedClaims([]);
                                setSelectedBatch("");
                                setUploadFile(null);
                                setUploadTabActive(1);
                                setPreviewValidationError("");
                            }}
                        >
                            Cancel
                        </Button>

                        {uploadTabActive === 2 && (
                            <Button variant="outline" onClick={() => setUploadTabActive(1)}>← Back</Button>
                        )}

                        {uploadTabActive === 1 && (
                            <Button
                                onClick={async () => {
                                    if (!uploadFile || !selectedBatch) return setErrorMessage("Select batch and file first");
                                    await handleFileUpload(uploadFile);
                                    // After parsing and validation, show preview
                                    setUploadTabActive(2);
                                }}
                                disabled={processing || !uploadFile || !selectedBatch}
                            >
                                {processing ? "Processing..." : "Preview Data →"}
                            </Button>
                        )}

                        {uploadTabActive === 2 && (
                            <div className={`inline-block ${processing || (validationRemarks.length > 0) ? "hover:cursor-not-allowed" : ""}`}>
                                <Button
                                    onClick={handleBulkUpload}
                                    disabled={processing || validationRemarks.length > 0}
                                    className={`bg-green-600 text-white ${processing || validationRemarks.length > 0 ? "opacity-60" : "hover:bg-green-700"}`}
                                >
                                    {processing ? "Uploading..." : uploadFile ? `Upload ${parsedClaims.length} Claims` : "Upload"}
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
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
                onOpenChange={(open) => {
                    if (!open) {
                        setShowSubrogationDialog(false);
                        setSubrogationTabActive(1);
                        setSelectedClaim("");
                        setRecoveryAmount("");
                        setRecoveryDate("");
                        setSubrogationRemarks("");
                        setSubrogationPreviewError("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Subrogation</DialogTitle>
                        <DialogDescription>
                            Create a manual subrogation entry and preview before saving.
                        </DialogDescription>

                        <div className="flex mt-3">
                            <div
                                className={`flex items-center gap-2 flex-1 pb-3 text-sm border-b-2 transition-all duration-300 ${
                                    subrogationTabActive === 1
                                        ? "border-blue-600 text-blue-600 font-medium"
                                        : "border-gray-200 text-gray-400"
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                                        subrogationTabActive === 1
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 text-gray-500"
                                    }`}
                                >
                                    {subrogationTabActive === 1 ? "1" : "✓"}
                                </div>
                                Create Subrogation
                            </div>
                            <div
                                className={`flex items-center gap-2 flex-1 pb-3 text-sm border-b-2 transition-all duration-300 ${
                                    subrogationTabActive === 2
                                        ? "border-blue-600 text-blue-600 font-medium"
                                        : "border-gray-200 text-gray-400"
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                                        subrogationTabActive === 2
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 text-gray-500"
                                    }`}
                                >
                                    2
                                </div>
                                Preview Subrogation
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Step 1: Edit form */}
                        {subrogationTabActive === 1 && (
                            <>
                                <div>
                                    <Label>Select Claim</Label>
                                    <Select
                                        value={selectedClaim}
                                        onValueChange={(v) => {
                                            setSelectedClaim(v);
                                            const nota = notas.find(
                                                (n) =>
                                                    n.nota_type === "Claim" &&
                                                    n.reference_id === v &&
                                                    n.status === "PAID"
                                            );
                                            setRecoveryAmount(nota ? String(nota.amount) : "");
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select paid claim" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.isArray(claims) &&
                                                claims
                                                    .filter((c) =>
                                                        notas.some(
                                                            (n) =>
                                                                n.nota_type === "Claim" &&
                                                                n.reference_id === c.claim_no &&
                                                                n.status === "PAID"
                                                        )
                                                    )
                                                    .map((c) => (
                                                        <SelectItem
                                                            key={c.claim_no}
                                                            value={c.claim_no}
                                                        >
                                                            {c.claim_no} - {c.nama_tertanggung}
                                                        </SelectItem>
                                                    ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Recovery Amount</Label>
                                    <Input
                                        type="text"
                                        value={recoveryAmount ? formatRupiahAdaptive(toNumber(recoveryAmount)) : ""}
                                        onChange={(e) => {
                                            const parsed = toNumber(e.target.value);
                                            setRecoveryAmount(parsed ? String(parsed) : "");
                                        }}
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
                                <div>
                                    <Label>Remarks</Label>
                                    <Input
                                        value={subrogationRemarks}
                                        onChange={(e) => setSubrogationRemarks(e.target.value)}
                                        placeholder="Optional notes"
                                    />
                                </div>
                            </>
                        )}

                        {/* Step 2: Preview */}
                        {subrogationTabActive === 2 && (
                            <>
                                {subrogationPreviewError ? (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{subrogationPreviewError}</AlertDescription>
                                    </Alert>
                                ) : (
                                    <Alert className="bg-blue-50 border-blue-200">
                                        <AlertCircle className="h-4 w-4 text-blue-600" />
                                        <AlertDescription className="text-blue-700">
                                            Review the subrogation details below then confirm to create.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="flex gap-3 flex-wrap">
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">Claim</p>
                                        <p className="text-sm font-medium mt-1">{selectedClaim || '-'}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">Debtor</p>
                                        <p className="text-sm font-medium mt-1">{(claims.find(c => c.claim_no === selectedClaim)?.nama_tertanggung) || '-'}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">Recovery Amount</p>
                                        <p className="text-sm font-medium mt-1">{formatRupiahAdaptive(toNumber(recoveryAmount) || 0)}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">Recovery Date</p>
                                        <p className="text-sm font-medium mt-1">{recoveryDate ? new Date(recoveryDate).toLocaleDateString('id-ID') : '-'}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">Remarks</p>
                                        <p className="text-sm font-medium mt-1">{subrogationRemarks || '-'}</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {canShowActionButtons && (
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowSubrogationDialog(false);
                                    setSubrogationTabActive(1);
                                    setSubrogationPreviewError("");
                                }}
                            >
                                Cancel
                            </Button>

                            {subrogationTabActive === 2 && (
                                <Button variant="outline" onClick={() => setSubrogationTabActive(1)}>← Back</Button>
                            )}

                            {subrogationTabActive === 1 && (
                                <Button
                                    onClick={() => {
                                        // validate then show preview
                                        setSubrogationPreviewError("");
                                        if (!selectedClaim) return setSubrogationPreviewError("Select a paid claim first");
                                        if (!recoveryAmount || toNumber(recoveryAmount) <= 0) return setSubrogationPreviewError("Enter a valid recovery amount");
                                        setSubrogationTabActive(2);
                                    }}
                                >
                                    Preview Data →
                                </Button>
                            )}

                            {subrogationTabActive === 2 && (
                                <div className={`inline-block ${processing ? "hover:cursor-not-allowed" : ""}`}>
                                    <Button
                                        onClick={async () => {
                                            if (!selectedClaim || !recoveryAmount) return;
                                            setProcessing(true);
                                            try {
                                                const claim = claims.find((c) => c.claim_no === selectedClaim);
                                                const subrogationId = `SUB-${Date.now()}`;

                                                await backend.create("Subrogation", {
                                                    subrogation_id: subrogationId,
                                                    claim_id: claim.claim_no,
                                                    debtor_id: claim.debtor_id,
                                                    recovery_amount: toNumber(recoveryAmount),
                                                    recovery_date: formatDateToISO(recoveryDate),
                                                    status: "SUBMITTED",
                                                    remarks: subrogationRemarks,
                                                });

                                                // audit + notification
                                                await backend.create("AuditLog", {
                                                    action: "SUBROGATION_CREATED",
                                                    module: "SUBROGATION",
                                                    entity_type: "Subrogation",
                                                    entity_id: subrogationId,
                                                    old_value: "{}",
                                                    new_value: JSON.stringify({ claim_id: claim.claim_no, recovery_amount: recoveryAmount }),
                                                    user_email: user?.email,
                                                    user_role: user?.role,
                                                    reason: "Manual subrogation creation",
                                                });

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
                                                setSubrogationTabActive(1);
                                                setSubrogationPreviewError("");
                                                loadData();
                                            } catch (error) {
                                                console.error("Failed to create subrogation:", error);
                                                setErrorMessage("Failed to create subrogation: " + error.message);
                                            }
                                            setProcessing(false);
                                        }}
                                        disabled={processing}
                                        className={`bg-green-600 text-white ${processing ? "opacity-60" : "hover:bg-green-700"}`}
                                    >
                                        {processing ? "Creating..." : "Create"}
                                    </Button>
                                </div>
                            )}
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
