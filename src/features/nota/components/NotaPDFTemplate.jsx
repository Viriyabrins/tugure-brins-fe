import React from "react";
import logoLeftUrl from "@/assets/mari.png";
import logoRightUrl from "@/assets/brins.png";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_ID = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER",
];

function parseNumberSafe(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return isNaN(value) || !isFinite(value) ? 0 : value;
    const cleaned = value.toString().trim().replace(/,/g, "").replace(/[^\d.-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) || !isFinite(num) ? 0 : num;
}

function fmt(val) {
    const n = typeof val === "number" ? val : parseNumberSafe(val);
    const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `(${s})` : s;
}

function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

// ─── Template ─────────────────────────────────────────────────────────────────

/**
 * HTML template for Nota PDF generation via html2canvas + jsPDF.
 * Rendered off-screen in a hidden container, then captured as an image.
 * Matches the layout of the programmatic jsPDF version in NotaManagement.jsx.
 */
export default function NotaPDFTemplate({ nota, contract }) {
    const now = new Date();
    const dateStr = `JAKARTA, ${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`;

    const periodStart = fmtDate(contract?.contract_start_date);
    const periodEnd = fmtDate(contract?.contract_end_date);
    const periodLine = periodStart && periodEnd
        ? `For The Period Of ${periodStart} - ${periodEnd}`
        : "";

    const kindText = nota?.reference_id || nota?.contract_id || "AUTO FACULTATIVE CREDIT COMMERCIAL";

    const netDueDisplayValue = nota?.nota_type === "Claim"
        ? -Math.abs(parseNumberSafe(nota?.net_due))
        : parseNumberSafe(nota?.net_due);

    // ── Shared column grid for table header + data row ──────────────────────
    const tableGrid = "1fr 88px 95px 82px 82px 82px";

    return (
        <div style={{
            width: "794px",
            minHeight: "1123px",
            padding: "19px 57px 57px",
            fontFamily: "Helvetica, Arial, sans-serif",
            fontSize: "9.5pt",
            color: "#000000",
            backgroundColor: "#ffffff",
            boxSizing: "border-box",
        }}>
            {/* ── Logos ─────────────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <img src={logoLeftUrl} alt="Mari" crossOrigin="anonymous" style={{ height: "38px", width: "auto", display: "block" }} />
                <img src={logoRightUrl} alt="BRINS" crossOrigin="anonymous" style={{ height: "38px", width: "auto", display: "block" }} />
            </div>

            {/* ── Title ─────────────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "5px" }}>
                <div style={{
                    fontSize: "12pt",
                    fontWeight: "bold",
                    borderBottom: "1.5px solid #000000",
                    lineHeight: "2",
                    paddingBottom: "2px",
                }}>
                    TREATY NOTE
                </div>
            </div>
            <div style={{ textAlign: "center", fontSize: "10pt", marginBottom: "4px" }}>
                XXX/XX/XX/XX/XXXXXX
            </div>
            <div style={{ textAlign: "center", fontSize: "9.5pt", marginBottom: "22px", minHeight: "16px" }}>
                {periodLine}
            </div>

            {/* ── Name / Address ────────────────────────────────────────── */}
            <div style={{ marginBottom: "18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "72px 12px 1fr", lineHeight: "1.75", fontSize: "9.5pt" }}>
                    <span style={{ fontWeight: "bold" }}>NAME</span>
                    <span>:</span>
                    <span>PT Tugu Reasuransi Indonesia (O01TR00001)</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "72px 12px 1fr", lineHeight: "1.75", fontSize: "9.5pt" }}>
                    <span style={{ fontWeight: "bold" }}>ADDRESS</span>
                    <span>:</span>
                    <div>
                        <div>Gedung TUGURE</div>
                        <div>Jl. Raden Saleh No 50 Menteng, Jakarta Pusat</div>
                    </div>
                </div>
            </div>

            {/* ── Table ─────────────────────────────────────────────────── */}
            <div>
                {/* Top border */}
                <div style={{ borderTop: "1.5px solid #000000", marginBottom: "0" }} />

                {/* Column headers */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: tableGrid,
                    padding: "6px 0 4px",
                    fontWeight: "bold",
                    fontSize: "9.5pt",
                }}>
                    <span>Kind Of Treaty</span>
                    <span style={{ textAlign: "right" }}>Premium</span>
                    <span style={{ textAlign: "right" }}>Commission</span>
                    <span style={{ textAlign: "right" }}>Claim</span>
                    <span style={{ textAlign: "right" }}>Total</span>
                    <span style={{ textAlign: "right" }}>Net Due</span>
                </div>

                {/* Sub-header border */}
                <div style={{ borderTop: "0.8px solid #000000", marginBottom: "5px" }} />

                {/* Currency row */}
                <div style={{ fontSize: "8pt", marginBottom: "4px" }}>Currency : IDR</div>

                {/* Data row */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: tableGrid,
                    padding: "4px 0",
                    fontSize: "8pt",
                    minHeight: "24px",
                    alignItems: "start",
                }}>
                    <span style={{ wordBreak: "break-word", paddingRight: "8px" }}>{kindText}</span>
                    <span style={{ textAlign: "right" }}>{fmt(nota?.premium)}</span>
                    <span style={{ textAlign: "right" }}>{fmt(-Math.abs(parseNumberSafe(nota?.commission)))}</span>
                    <span style={{ textAlign: "right" }}>{fmt(nota?.claim)}</span>
                    <span style={{ textAlign: "right" }}>{fmt(nota?.total)}</span>
                    <span style={{ textAlign: "right" }}>{fmt(netDueDisplayValue)}</span>
                </div>

                {/* Double bottom border */}
                <div style={{ borderTop: "0.8px solid #000000", marginTop: "4px" }} />
                <div style={{ borderTop: "0.8px solid #000000", marginTop: "2px" }} />
            </div>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div style={{ marginTop: "28px", textAlign: "right", fontSize: "9.5pt" }}>
                <div>{dateStr}</div>
                <div style={{ marginTop: "52px" }}>Authorized Signature</div>
            </div>
        </div>
    );
}
