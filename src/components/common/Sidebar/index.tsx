"use client";
import footerItems from "@/constants/footerItems";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useState, useEffect } from "react";
import { signOut } from "@/utils/supabase/auth-helper";
import menuItems from "@/constants/menuItems";
import { createClient } from "@/utils/supabase/config/client";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner"; // Import your LoadingSpinner
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
interface SidebarProps {
  sidebarOpen: boolean;
   
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const supabase = createClient();
  const { push } = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true); // Add loading state

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data?.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setIsUserLoading(false); // Set loading to false after fetch completes
      }
    };

    fetchUser();
  }, [supabase.auth]);

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
      case "billing":
        return push("/billing");
      case "integrations":
        return push("/integrations");
      case "profileSettings":
        return push("/settings/clinic-setting");
      case "setup":
        return push("/setup");
      case "logout":
        try {
          setIsLoggingOut(true);
          const success = await signOut();
          if (success) {
            localStorage.clear(); // Clear local storage on logout
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

  // Filter menu items based on user role
  const getFilteredMenuItems = () => {
    return menuItems.filter(item => {
      if (
        (item.key === "staff" || item.key === "billing") &&
        user &&
        Object.hasOwn(user, "user_metadata") &&
        (user as any).user_metadata?.is_staff
      ) {
        return false; // hide Staff and Billing for staff users
      }
      return true;
    });
  };

  return (
    <div
      className={`${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-lg border-r-2 border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
    >
      {/* Header of side bar*/}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
            <Image src="/logo.svg" alt="Logo" width={48} height={48} />
          </div>
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
      <nav className="flex-1 px-3 mt-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Main Navigation</div>

        {/* Show loading spinner while fetching user data */}
        {isUserLoading ? (
          <div className="flex justify-center items-center py-8">
            <LoadingSpinner message="Loading menu..." size="sm" />
          </div>
        ) : (
          /* Main Menu Items */
          <div className="space-y-2">
            {getFilteredMenuItems().map(item => {
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
                  <div className="w-4 h-4 mr-3 flex items-center justify-center">{isActive ? item.selectedicon : item.icon}</div>
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

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
                  <div className="w-4 h-4 mr-3 flex items-center justify-center">{isActive ? item.selectedicon : item.icon}</div>
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
