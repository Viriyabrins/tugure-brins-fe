// ─── Column normalisation ────────────────────────────────────────────────────

export const DEBTOR_HEADER_ALIAS_MAP = {
    premium_425: "premium_amount",
    premium_42_5: "premium_amount",
    premium: "premium_amount",
    ric_325: "ric_amount",
    ric_32_5: "ric_amount",
    komisi: "ric_amount",
    bf_25: "bf_amount",
    bf_2_5: "bf_amount",
    nominal_komisi_broker: "bf_amount",
    flag_restruktur: "flag_restruk",
    policyno: "policy_no",
};

export const REQUIRED_UPLOAD_COLUMNS = ["batch_id", "nomor_peserta", "nama_peserta"];

export const NUMERIC_UPLOAD_COLUMNS = [
    "plafon",
    "nominal_premi",
    "premi_percentage",
    "premium_amount",
    "ric_percentage",
    "ric_amount",
    "bf_percentage",
    "bf_amount",
    "net_premi",
];

export const INTEGER_UPLOAD_COLUMNS = [
    "status_aktif",
    "flag_restruk",
    "flag_restruktur",
    "kolektabilitas",
];

export const DATE_UPLOAD_COLUMNS = [
    "tanggal_mulai_covering",
    "tanggal_akhir_covering",
    "tanggal_terima",
    "tanggal_validasi",
    "teller_premium_date",
];

export const FLAG_COLUMNS = ["status_aktif", "flag_restruk", "flag_restruktur"];

// ─── Template headers ─────────────────────────────────────────────────────────

export const DEBTOR_TEMPLATE_HEADERS = [
    "BATCH_ID",
    "COVER_ID", "PROGRAM_ID", "NOMOR_REKENING_PINJAMAN", "NOMOR_PESERTA", "POLICY_NO",
    "LOAN_TYPE", "CIF_REKENING_PINJAMAN", "JENIS_PENGAJUAN_DESC",
    "JENIS_COVERING_DESC", "TANGGAL_MULAI_COVERING", "TANGGAL_AKHIR_COVERING",
    "PLAFON", "NOMINAL_PREMI", "PREMIUM", "KOMISI", "NET_PREMI",
    "NOMINAL_KOMISI_BROKER", "UNIT_CODE", "UNIT_DESC", "BRANCH_DESC",
    "REGION_DESC", "NAMA_PESERTA", "ALAMAT_USAHA", "NOMOR_PERJANJIAN_KREDIT",
    "TANGGAL_TERIMA", "TANGGAL_VALIDASI", "TELLER_PREMIUM_DATE",
    "STATUS_AKTIF", "REMARK_PREMI", "FLAG_RESTRUK", "KOLEKTABILITAS",
];

export const DEBTOR_PREVIEW_ALLOWED_HEADERS = [
    "batch_id", "cover_id", "program_id", "nomor_rekening_pinjaman", "nomor_peserta",
    "loan_type", "cif_rekening_pinjaman", "jenis_pengajuan_desc", "jenis_covering_desc",
    "tanggal_mulai_covering", "tanggal_akhir_covering", "plafon", "nominal_premi",
    "premium", "komisi", "net_premi", "nominal_komisi_broker", "unit_code",
    "unit_desc", "branch_desc", "region_desc", "nama_peserta", "alamat_usaha",
    "nomor_perjanjian_kredit", "tanggal_terima", "tanggal_validasi",
    "teller_premium_date", "status_aktif", "remark_premi", "flag_restruk",
    "kolektabilitas",
];

// ─── Filters ──────────────────────────────────────────────────────────────────

export const DEFAULT_DEBTOR_FILTER = {
    contract: "all",
    batch: "",
    submitStatus: "all",
    name: "",
};

// ─── Role constants ───────────────────────────────────────────────────────────

export const DEBTOR_PAGE_SIZE = 10;
