import * as XLSX from "xlsx";
import {
    toNullableString,
    toNumber,
    toBoolean,
} from "@/shared/utils/dataTransform";
import { HEADER_ALIAS_MAP } from "../utils/claimConstants";

/** Normalizes a raw header string to its canonical field name. */
function normalizeHeader(header = "") {
    const cleaned = String(header)
        .trim()
        .toLowerCase()
        .replace(/[%().\/]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
    return HEADER_ALIAS_MAP[cleaned] || cleaned;
}

/**
 * Parses a CSV/XLSX/XLS file into an array of raw claim rows.
 * Each row contains all fields mapped by header aliases.
 *
 * @param {File} file
 * @returns {Promise<Array>}
 */
export async function parseClaimFile(file) {
    const fileName = (file?.name || "").toLowerCase();
    if (
        !fileName.endsWith(".csv") &&
        !fileName.endsWith(".xlsx") &&
        !fileName.endsWith(".xls")
    ) {
        throw new Error(
            "Unsupported file format. Please upload .csv, .xlsx, or .xls",
        );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
        raw: false,
    });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
    });

    if (!Array.isArray(rows) || rows.length <= 1) {
        throw new Error("No data found in file");
    }

    const headers = (rows[0] || []).map(normalizeHeader);
    const headerIndexMap = headers.reduce((acc, header, idx) => {
        if (!acc[header]) acc[header] = [];
        acc[header].push(idx);
        return acc;
    }, {});

    const getFirst = (candidates) => {
        for (const c of candidates) {
            const arr = headerIndexMap[c];
            if (Array.isArray(arr) && arr.length > 0) return arr[0];
        }
        return -1;
    };

    const idx = {
        nomorPeserta: getFirst(["nomor_peserta"]),
        policyNo: getFirst(["policy_no", "policyno"]),
        nomorSertifikat: getFirst(["nomor_sertifikat"]),
        namaTertanggung: getFirst(["nama_tertanggung"]),
        ktp: getFirst(["no_ktp_npwp", "noktp_npwp"]),
        fasilitas: getFirst(["no_fasilitas_kredit"]),
        bdoPremi: getFirst(["bdo_premi"]),
        tanggalRealisasi: getFirst(["tanggal_realisasi_kredit"]),
        plafond: getFirst(["plafond"]),
        maxCoverage: getFirst(["max_coverage"]),
        kolDebitur: getFirst(["kol_debitur"]),
        dol: getFirst(["dol"]),
        nilaiKlaim: getFirst(["nilai_klaim"]),
        tahunPolis: getFirst(["tahun_polis"]),
        borderoKlaim: getFirst(["bordero_klaim"]),
        checkBdoPremi: getFirst(["check_bdo_premi"]),
        sharePct: getFirst(["share_tugure_percentage"]),
        shareAmt: getFirst(["share_tugure_amount"]),
    };
    const shareHeaderIndices = headerIndexMap.share_tugure || [];

    return rows.slice(1).map((rowValues, index) => {
        const vals = Array.isArray(rowValues) ? rowValues : [];
        const read = (i) => (i >= 0 ? vals[i] : "");

        const findShareValues = () => {
            if (idx.sharePct >= 0 || idx.shareAmt >= 0) {
                return {
                    percentage: read(idx.sharePct),
                    amount: read(idx.shareAmt),
                };
            }
            const candidates = [...shareHeaderIndices];
            if (candidates.length === 0) {
                const start =
                    idx.nomorSertifikat >= 0 ? idx.nomorSertifikat + 1 : 0;
                const end =
                    idx.checkBdoPremi >= 0
                        ? idx.checkBdoPremi
                        : Math.max(vals.length - 1, 0);
                for (let i = start; i < end; i++) candidates.push(i);
            }
            let percentage = null;
            let amount = null;
            for (const i of candidates) {
                const raw = read(i);
                const text = String(raw ?? "").trim();
                if (!text) continue;
                if (text.includes("%") && percentage === null) {
                    percentage = raw;
                    continue;
                }
                if (amount === null) amount = raw;
            }
            return { percentage, amount };
        };

        const share = findShareValues();
        return {
            excelRow: index + 2,
            policy_no: toNullableString(read(idx.policyNo)),
            nomor_sertifikat: toNullableString(read(idx.nomorSertifikat)),
            nama_tertanggung: toNullableString(read(idx.namaTertanggung)),
            no_ktp_npwp_raw: toNullableString(read(idx.ktp)),
            no_fasilitas_kredit: toNullableString(read(idx.fasilitas)),
            bdo_premi: toNullableString(read(idx.bdoPremi)),
            tanggal_realisasi_kredit: read(idx.tanggalRealisasi),
            plafond: toNumber(read(idx.plafond)),
            max_coverage: toNumber(read(idx.maxCoverage)),
            kol_debitur: toNullableString(read(idx.kolDebitur)),
            dol: read(idx.dol),
            nilai_klaim: toNumber(read(idx.nilaiKlaim)),
            tahun_polis: toNullableString(read(idx.tahunPolis)),
            bordero_klaim: toNullableString(read(idx.borderoKlaim)),
            share_tugure_percentage: toNumber(share.percentage),
            share_tugure_amount: toNumber(share.amount),
            check_bdo_premi: toBoolean(read(idx.checkBdoPremi)),
            nomor_peserta: toNullableString(read(idx.nomorPeserta)),
        };
    });
}
