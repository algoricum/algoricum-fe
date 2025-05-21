"use client";
import footerItems from "@/constants/footerItems";
import menuItems from "@/constants/menuItems";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { CollapseIcon } from "@/icons";
import { Flex, Layout, Menu } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import Logo from "../Logo";
import { useAuth } from "@/hooks/useAuth"
import { signOut } from "@/utils/supabase/auth-helper";
import { clearAll } from "@/helpers/storage-helper";
const Sidebar = () => {
  const { Sider } = Layout;
  const { push } = useRouter();
  let path = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const selectedPath = path.startsWith("/content") ? "content" : path.split("/")[1];
  const pathMatch = path.includes("content") || path.includes("settings");
  const [isCollapsed, setIsCollapsed] = useState<boolean>(pathMatch);
  const { logout } = useAuth()
  const menuHandler = async (key: string) => {
    switch (key) {
      case "settings":
        return push("/settings/chatbot");
      case "profileSettings":
        return push("/settings/chatbot");
      case "setup":
        return push("/setup");
      case "logout":
        try {
          // Disable the logout button or show loading state
          setIsLoggingOut(true); // Add this state
          const success = await signOut();

          if (success) {
            SuccessToast("Logout Successfully");
            // Add a slight delay before navigation
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
          setIsLoggingOut(false); // Reset loading state
        }
        return;
      default:
        return push("/content/articles");
    }
  };

  const isSelected = useCallback(
    (route: string) => {
      return path.includes(route);
    },
    [path],
  );

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };
  return (
    <Sider
      width={280}
      collapsedWidth={80}
      collapsible
      collapsed={isCollapsed}
      className="hidden md:block p-[18px] min-h-screen bg-white border-b border-r border-Gray400"
    >
      <Flex vertical className="h-full">
        <Logo isSidebar={true} isCollapsed={isCollapsed} />

        {(!path.includes("content") || !path.includes("settings")) && (
          <Flex
            justify="center"
            align="center"
            className={`rounded-full absolute top-[55px] right-0 cursor-pointer ${isCollapsed && "rotate-180"}`}
            onClick={toggleCollapsed}
          >
            {<CollapseIcon />}
          </Flex>
        )}

        <div className="w-full h-[1px] my-6 bg-Gray400" />

        <Flex vertical justify="space-between" className="flex-1">
          <Menu
            onClick={({ key }) => menuHandler(key)}
            selectedKeys={[selectedPath]}
            mode="vertical"
            theme="light"
            className={`flex flex-col space-y-3 ${!isCollapsed ? "sidebarmenu" : "sidebarmenu-collapsed"}`}
          // items={menuItems}
          />
          <div className="flex flex-col justify-end items-center gap-2">
            {footerItems.map(({ key, label, icon: Icon, selectedIcon }, index) => (
              <div
                key={index}
                className={`w-full flex flex-row items-center py-2 gap-2 ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} border-b-2 border-transparent !border  hover:border-Primary900 rounded hover:!bg-Primary50  ${isSelected(key) && "!bg-Primary50 !rounded !border-Primary900"
                  } ${isCollapsed ? "justify-center" : "px-4"}`}
                onClick={() => menuHandler(key)}
              >
                {isSelected(key) ? selectedIcon : Icon}
                {!isCollapsed && (
                  <p className={`${isSelected(key) ? "text-Primary1000  font-PoppinsSemiBold" : "text-Gray600"}`}>{label}</p>
                )}
              </div>
            ))}
          </div>
        </Flex>
      </Flex>
    </Sider>
  );
};

export default Sidebar;
