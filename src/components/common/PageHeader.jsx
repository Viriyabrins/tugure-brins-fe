import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getUserRoles } from "@/lib/keycloak";

export default function PageHeader({ 
  title, 
  subtitle, 
  backUrl, 
  actions,
  breadcrumbs 
}) {
  const roles = Array.isArray(getUserRoles && getUserRoles()) ? getUserRoles() : [];
  const isBrinsUser = Array.isArray(roles) && roles.some((r) => String(r || "").toLowerCase().includes("brins"));

  const transformLabel = (text) => {
    if (!text || !isBrinsUser || typeof text !== 'string') return text;
    return String(text)
      .replace(/\bClaims\b/gi, (m) => (m[0] === m[0].toUpperCase() ? 'Recoveries' : 'recoveries'))
      .replace(/\bClaim\b/gi, (m) => (m[0] === m[0].toUpperCase() ? 'Recovery' : 'recovery'));
  };
  return (
    <div className="mb-6">
      {breadcrumbs && (
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span>/</span>}
              {crumb.url ? (
                <Link 
                  to={createPageUrl(crumb.url)} 
                  className="hover:text-gray-900 transition-colors"
                >
                  {transformLabel(crumb.label)}
                </Link>
              ) : (
                <span className="text-gray-900">{transformLabel(crumb.label)}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {backUrl && (
            <Link to={createPageUrl(backUrl)}>
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{transformLabel(title)}</h1>
            {subtitle && (
              <p className="text-gray-500 mt-1">{transformLabel(subtitle)}</p>
            )}
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}