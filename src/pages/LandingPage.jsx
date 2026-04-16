import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Lock, X, ExternalLink } from "lucide-react";
import briInsuranceLogo from "@/assets/BRI.png";
import { PortalHeader, PortalFooter } from "@/components/common/PortalChrome";
import tugureLogo from "@/assets/tugure-logo.png";

const MODAL_STYLES = `
  @keyframes lp-backdrop-in  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes lp-backdrop-out { from { opacity: 1 } to { opacity: 0 } }
  @keyframes lp-modal-in     { from { opacity: 0; transform: translateY(28px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
  @keyframes lp-modal-out    { from { opacity: 1; transform: translateY(0) scale(1) } to { opacity: 0; transform: translateY(28px) scale(0.96) } }
  @keyframes lp-btn-pulse    {
    0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(167,139,250,0.7); }
    40%  { transform: scale(0.97); box-shadow: 0 0 0 8px rgba(167,139,250,0.2); }
    100% { transform: scale(1);    box-shadow: 0 0 0 18px rgba(167,139,250,0); }
  }
`;

function AdminModal({ onClose }) {
    const modalRef = useRef(null);
    const firstButtonRef = useRef(null);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 220);
    };

    useEffect(() => {
        firstButtonRef.current?.focus();

        const handleKeyDown = (e) => {
            if (e.key === "Escape") handleClose();

            if (e.key === "Tab" && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                );
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isClosing]);

    const adminOptions = [
        {
            label: "Login as Admin — Brins",
            url: "https://202.155.91.210:9003/admin/brins/console/#/brins/realms",
            description:
                "Access the Keycloak Admin Console for the Brins realm",
            color: "#f5a623",
        },
        {
            label: "Login as Admin — Tugure",
            url: "https://202.155.91.210:9003/admin/tugure/console/#/tugure/realms",
            description:
                "Access the Keycloak Admin Console for the Tugure realm",
            color: "#a78bfa",
        },
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
                animation: isClosing
                    ? "lp-backdrop-out 220ms ease forwards"
                    : "lp-backdrop-in 220ms ease forwards",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-modal-title"
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose();
            }}
        >
            <div
                ref={modalRef}
                className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
                style={{
                    background: "rgba(20, 10, 50, 0.97)",
                    border: "1px solid rgba(167,139,250,0.3)",
                    animation: isClosing
                        ? "lp-modal-out 220ms cubic-bezier(0.4,0,1,1) forwards"
                        : "lp-modal-in 300ms cubic-bezier(0,0,0.2,1) forwards",
                }}
            >
                {/* Top accent */}
                <div
                    className="h-1.5 w-full"
                    style={{
                        background:
                            "linear-gradient(90deg, #a78bfa 0%, #c4b5fd 50%, #a78bfa 100%)",
                    }}
                />

                <div className="px-8 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Lock size={18} className="text-purple-300" />
                            <h2
                                id="admin-modal-title"
                                className="text-white font-semibold"
                                style={{ fontSize: "1.05rem" }}
                            >
                                Choose Admin Console
                            </h2>
                        </div>
                        <button
                            onClick={handleClose}
                            aria-label="Close modal"
                            className="text-white rounded-full p-1 transition-colors"
                            style={{ opacity: 0.6 }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.opacity = "1")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.opacity = "0.6")
                            }
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <p
                        className="text-white mb-6"
                        style={{
                            fontSize: "0.8rem",
                            opacity: 0.55,
                            lineHeight: 1.6,
                        }}
                    >
                        Choose one of the options below. The selected Admin
                        Console will open in a new browser tab.
                    </p>

                    {/* Options */}
                    <div className="flex flex-col gap-3">
                        {adminOptions.map((opt, i) => (
                            <a
                                key={opt.label}
                                ref={i === 0 ? firstButtonRef : undefined}
                                href={opt.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${opt.label} — Opens in a new tab`}
                                className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl transition-all duration-200"
                                style={{
                                    background: "rgba(255,255,255,0.07)",
                                    border: `1.5px solid ${opt.color}40`,
                                    textDecoration: "none",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background =
                                        "rgba(255,255,255,0.13)";
                                    e.currentTarget.style.borderColor = `${opt.color}80`;
                                    e.currentTarget.style.transform =
                                        "translateY(-1px)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background =
                                        "rgba(255,255,255,0.07)";
                                    e.currentTarget.style.borderColor = `${opt.color}40`;
                                    e.currentTarget.style.transform =
                                        "translateY(0)";
                                }}
                            >
                                <div>
                                    <p
                                        className="text-white font-medium"
                                        style={{ fontSize: "0.9rem" }}
                                    >
                                        {opt.label}
                                    </p>
                                    <p
                                        style={{
                                            fontSize: "0.75rem",
                                            color: opt.color,
                                            opacity: 0.85,
                                        }}
                                    >
                                        {opt.description}
                                    </p>
                                </div>
                                <ExternalLink
                                    size={16}
                                    style={{
                                        color: opt.color,
                                        opacity: 0.8,
                                        flexShrink: 0,
                                    }}
                                />
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LandingPage() {
    const navigate = useNavigate();
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminBtnActive, setAdminBtnActive] = useState(false);

    const handleAdminClick = () => {
        if (adminBtnActive) return;
        setAdminBtnActive(true);
        setTimeout(() => {
            setAdminBtnActive(false);
            setShowAdminModal(true);
        }, 280);
    };

    return (
        <div className="min-h-screen w-full relative overflow-hidden flex flex-col">
            <style>{MODAL_STYLES}</style>
            {showAdminModal && (
                <AdminModal onClose={() => setShowAdminModal(false)} />
            )}

            {/* Background Gradient */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    background:
                        "linear-gradient(135deg, #0a1f6e 0%, #1a4bbd 40%, #2563eb 70%, #3b82f6 100%)",
                }}
            />

            {/* Decorative Circles (match Home.jsx) */}
            <div className="absolute top-[-120px] right-[-120px] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #60a5fa, transparent)" }} />
            <div className="absolute bottom-[80px] left-[-80px] w-[300px] h-[300px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #93c5fd, transparent)" }} />

            {/* Decorative Wave Bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-0 opacity-10">
                <svg
                    viewBox="0 0 1440 200"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M0 100C240 20 480 180 720 100C960 20 1200 180 1440 100V200H0V100Z"
                        fill="rgba(255,255,255,0.05)"
                    />
                </svg>
            </div>

            {/* Header */}
            <PortalHeader />

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10">
                {/* Card Container */}
                <div
                    className="w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
                    style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                >
                    {/* Top Accent Bar */}
                    <div
                        className="h-1.5 w-full"
                        style={{
                            background:
                                "linear-gradient(90deg, #f5a623 0%, #f7c948 50%, #f5a623 100%)",
                        }}
                    />

                    <div className="px-10 py-12 flex flex-col items-center justify-center">
                        {/* Welcome Text */}
                        <p
                            className="text-white mb-8 tracking-widest uppercase"
                            style={{
                                fontSize: "0.75rem",
                                opacity: 0.7,
                                letterSpacing: "0.15em",
                            }}
                        >
                            Welcome to
                        </p>

                        {/* Logos */}
                        <div className="flex items-center gap-4 mb-10 w-full">
                            <div
                                className="flex-1 flex items-center justify-center px-4 py-9 rounded-2xl"
                                style={{
                                    background: "rgba(255, 255, 255, 0.95)",
                                    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                                }}
                            >
                                <img
                                    src={briInsuranceLogo}
                                    alt="BRInsurance Logo"
                                    className="h-12 object-contain w-full"
                                    style={{ maxWidth: "160px" }}
                                />
                            </div>

                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                <div
                                    className="w-px h-6"
                                    style={{
                                        background: "rgba(255,255,255,0.25)",
                                    }}
                                />
                                <span
                                    className="text-white"
                                    style={{
                                        fontSize: "0.75rem",
                                        opacity: 0.6,
                                    }}
                                >
                                    &amp;
                                </span>
                                <div
                                    className="w-px h-6"
                                    style={{
                                        background: "rgba(255,255,255,0.25)",
                                    }}
                                />
                            </div>

                            <div
                                className="flex-1 flex items-center justify-center px-4 py-4 rounded-2xl"
                                style={{
                                    background: "rgba(255, 255, 255, 0.95)",
                                    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                                }}
                            >
                                <img
                                    src={tugureLogo}
                                    alt="Tugure Logo"
                                    className="h-35 object-contain" // was h-16, now larger
                                    style={{ maxWidth: "280px" }} // optionally increase max width
                                />
                            </div>
                        </div>

                        {/* Subtitle */}
                        <p
                            className="text-white text-center mb-10"
                            style={{
                                fontSize: "0.9rem",
                                opacity: 0.75,
                                lineHeight: 1.7,
                            }}
                        >
                            A secure, reliable, and trusted digital reinsurance
                            management platform.
                        </p>

                        {/* Buttons */}
                        <div className="w-full flex flex-col gap-4">
                            {/* User Login */}
                            <button
                                onClick={() => navigate("/Home")}
                                aria-label="Login as User — go to login page"
                                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl transition-all duration-200 active:scale-[0.98]"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #f5a623 0%, #f0c040 100%)",
                                    boxShadow:
                                        "0 4px 20px rgba(245, 166, 35, 0.35)",
                                    color: "#003087",
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: "pointer",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow =
                                        "0 6px 28px rgba(245, 166, 35, 0.55)";
                                    e.currentTarget.style.transform =
                                        "translateY(-1px)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow =
                                        "0 4px 20px rgba(245, 166, 35, 0.35)";
                                    e.currentTarget.style.transform =
                                        "translateY(0)";
                                }}
                            >
                                <Users size={20} />
                                <span>Login as User</span>
                            </button>

                            {/* Admin Login */}
                            <button
                                onClick={handleAdminClick}
                                aria-label="Login as Admin — choose admin console"
                                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl"
                                style={{
                                    background: adminBtnActive
                                        ? "rgba(167,139,250,0.25)"
                                        : "rgba(255,255,255,0.12)",
                                    border: "1.5px solid rgba(255,255,255,0.4)",
                                    color: "#ffffff",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    animation: adminBtnActive
                                        ? "lp-btn-pulse 280ms cubic-bezier(0.4,0,0.6,1) forwards"
                                        : "none",
                                    transition: adminBtnActive
                                        ? "none"
                                        : "background 200ms, transform 200ms",
                                }}
                                onMouseEnter={(e) => {
                                    if (adminBtnActive) return;
                                    e.currentTarget.style.background =
                                        "rgba(255,255,255,0.22)";
                                    e.currentTarget.style.transform =
                                        "translateY(-1px)";
                                }}
                                onMouseLeave={(e) => {
                                    if (adminBtnActive) return;
                                    e.currentTarget.style.background =
                                        "rgba(255,255,255,0.12)";
                                    e.currentTarget.style.transform =
                                        "translateY(0)";
                                }}
                            >
                                <Lock size={20} />
                                <span>Login as Admin</span>
                            </button>
                        </div>

                        {/* Help Link */}
                        <p
                            className="text-white mt-8"
                            style={{ fontSize: "0.8rem", opacity: 0.5 }}
                        >
                            {/* Need help?{" "} */}
                            <span
                                className="cursor-pointer underline underline-offset-2"
                                style={{ opacity: 0.8 }}
                            >
                                {/* Contact Support */}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Feature Pills */}
                <div className="flex flex-wrap justify-center gap-3 mt-8">
                    {[
                        { icon: "🔒", text: "Security Assured" },
                        { icon: "⚡", text: "Fast Access" },
                        { icon: "📊", text: "Real-time Reports" },
                    ].map((item) => (
                        <div
                            key={item.text}
                            className="flex items-center gap-2 px-4 py-2 rounded-full"
                            style={{
                                background: "rgba(255,255,255,0.1)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                color: "rgba(255,255,255,0.75)",
                                fontSize: "0.8rem",
                            }}
                        >
                            <span>{item.icon}</span>
                            <span>{item.text}</span>
                        </div>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <PortalFooter />
        </div>
    );
}
