import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, LogOut, Menu, X, Shield } from "lucide-react";
import { useKeycloakAuth } from './lib/KeycloakContext';

export default function AdminLayout({ children, currentPageName }) {
  const { user, logout, tokenParsed, isSuperAdmin } = useKeycloakAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Menu structure for admin only
  const menuItems = [
    { name: 'Admin Dashboard', icon: Activity, path: 'AdminDashboard' }
  ];

  const renderMenuItem = (item) => {
    const isActive = currentPageName === item.path;
    const Icon = item.icon;

    return (
      <Link
        key={item.path}
        to={`/admin/${item.path}`}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
          isActive
            ? 'bg-purple-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Icon size={20} />
        <span className="text-sm font-medium">{item.name}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ease-out`}
      >
        {/* Logo / Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600" />
            <span className="font-bold text-lg text-gray-900">Admin Panel</span>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map(renderMenuItem)}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200 space-y-3">
          <Separator className="bg-gray-200" />
          <Button
            onClick={() => logout()}
            variant="outline"
            className="w-full text-red-600 border-red-300 hover:bg-red-50"
          >
            <LogOut size={18} className="mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-700"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              {user?.name || 'Admin'}
            </Badge>
            <Badge variant="outline" className="border-purple-300 text-purple-700">
              Super Admin
            </Badge>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
