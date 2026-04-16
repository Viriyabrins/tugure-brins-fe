export const CLAIM_PAGE_SIZE = 10;

export const CLAIM_STATUSES = ["SUBMITTED", "CHECKED_BRINS", "APPROVED_BRINS", "CHECKED_TUGURE", "APPROVED", "REVISION"];

export const DEFAULT_CLAIM_FILTER = {
    contract: "all",
    batch: "",
    claimStatus: "all",
    subrogationStatus: "all",
};

export const CLAIM_ACTION_ROLES = ["maker-brins-role", "checker-brins-role"];

export const CLAIM_TEMPLATE_HEADERS = [
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
    "share_tugure_amount",
];

export const CLAIM_TEMPLATE_SAMPLE =
    "Grace;;4;45831;131.194.944,00;811514102502483;1115141023000261;3;324623;0000K.01199.2025.11.00001.1.1;Dec-1;43,50%;57.069.800,64";

export const UPLOAD_PREVIEW_COLUMNS = [
    "#",
    "nomor_peserta",
    "policy_no",
    "nama_tertanggung",
    "nomor_sertifikat",
    "nilai_klaim",
    "share_tugure_percentage",
    "share_tugure_amount",
];

export const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Maps common header name variants to canonical field names. */
export const HEADER_ALIAS_MAP = {
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
