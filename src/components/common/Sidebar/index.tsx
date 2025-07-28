"use client";
import footerItems from "@/constants/footerItems";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useState } from "react";
import { signOut } from "@/utils/supabase/auth-helper";
import menuItems from "@/constants/menuItems";

interface SidebarProps {
  sidebarOpen: boolean;
  // eslint-disable-next-line no-unused-vars
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const { push } = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const menuHandler = async (key: string) => {
    switch (key) {
      case "leads":
        return push("/leads");
      case "dashboard":
        return push("/dashboard");
      case "appointments":
        return push("/appointments");
      case "staff":
        return push("/staff");
      case "profileSettings":
        return push("/settings/lead-capturing-form");
      case "setup":
        return push("/setup");
      case "logout":
        try {
          setIsLoggingOut(true);
          const success = await signOut();
          if (success) {
            SuccessToast("Logout Successfully");
            setTimeout(() => {
              push("/login");
            }, 300);
          } else {
            ErrorToast("Logout failed. Please try again.");
          }
        } catch (error) {
          console.error("Logout error:", error);
          ErrorToast("Logout failed. Please try again.");
        } finally {
          setIsLoggingOut(false);
        }
        return;
      default:
        return push("/content/articles");
    }
  };

  const isSelected = useCallback(
    (route: string) => {
      if (route === "profileSettings") {
        return pathname.includes("/settings");
      }
      return pathname.includes(route);
    },
    [pathname],
  );

  return (
    <div
      className={`${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
    >
      {/* Header of side bar*/}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
          <div className="ml-3">
            <div className="text-lg font-semibold text-gray-900">Algoricum</div>
            <div className="text-xs text-gray-500">Healthcare AI</div>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-500">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 mt-8">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Main Navigation</div>

        {/* Main Menu Items */}
        <div className="space-y-2">
          {menuItems.map(item => {
            const isActive = pathname.includes(item.key);
            return (
              <button
                key={item.key}
                onClick={() => menuHandler(item.key)}
                disabled={item.disabled}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive ? "bg-purple-600 text-white" : "text-gray-700 hover:bg-gray-100"
                } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="w-5 h-5 mr-3 flex items-center justify-center">{isActive ? item.selectedicon : item.icon}</div>
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Footer Items */}
        <div className="absolute bottom-6 left-4 right-4">
          <div className="space-y-2">
            {footerItems.map((item, index) => {
              const isActive = isSelected(item.key);
              return (
                <button
                  key={index}
                  onClick={() => menuHandler(item.key)}
                  disabled={isLoggingOut && item.key === "logout"}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive ? "bg-purple-600 text-white" : "text-gray-700 hover:bg-gray-100"
                  } ${isLoggingOut && item.key === "logout" ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="w-5 h-5 mr-3 flex items-center justify-center">{isActive ? item.selectedicon : item.icon}</div>
                  {isLoggingOut && item.key === "logout" ? "Logging out..." : item.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;
