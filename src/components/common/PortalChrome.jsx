import React from "react";
import { Shield } from "lucide-react";

export function PortalHeader() {
    return (
        <header className="relative z-10 flex items-center justify-between px-8 py-5">
            <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-white/80" />
                <span className="text-sm text-white/80 tracking-wide">
                    Insurance Service Portal
                </span>
            </div>
            <span className="text-sm text-white/60">
                © 2026 BRInsurance &amp; Tugure
            </span>
        </header>
    );
}

export function PortalFooter() {
    return (
        <footer className="relative z-10 py-4 text-center">
            <p className="text-xs text-white/40">
                PT BRI Insurance Indonesia · PT Tugure Insurance Indonesia
            </p>
        </footer>
    );
}
