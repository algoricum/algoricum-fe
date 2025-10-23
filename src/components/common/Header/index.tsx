"use client";
import { Button } from "@/components/elements";
import { dashboardHeaderLinks } from "@/constants";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { BurgerIcon } from "@/icons";
import { signOut } from "@/utils/supabase/auth-helper";
import Dropdown from "antd/es/dropdown";
import Flex from "antd/es/flex";
import Typography from "antd/es/typography";
import type { MenuProps } from "antd/es/menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const { Text } = Typography;

interface HeaderProps {
  title?: string;
  description?: string;
  showHamburgerMenu?: boolean;
}

const Header = ({ title = "", description = "", showHamburgerMenu = false }: HeaderProps) => {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      const success = await signOut();
      if (success) {
        // localStorage.clear();
        SuccessToast("Logout Successfully");
        router.push("/login");
      } else {
        ErrorToast("Logout failed. Please try again.");
      }
    } catch (error) {
      console.error("Logout error:", error);
      ErrorToast("Logout failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const mobileMenu: MenuProps["items"] = [
    ...dashboardHeaderLinks.map(({ label, href }, index) => ({
      key: index,
      label: (
        <Link href={href} className="text-sm text-Gray600 hover:!text-Primary1000">
          {label}
        </Link>
      ),
    })),
    { type: "divider" },
    {
      key: "settings",
      label: "Settings",
      children: [
        {
          key: "settings:chatbot",
          label: (
            <Link href="/settings/chatbot" className="text-sm text-Gray600 hover:!text-Primary1000">
              Chatbot Setting
            </Link>
          ),
        },
        {
          key: "settings:clinic",
          label: (
            <Link href="/settings/clinic-setting" className="text-sm text-Gray600 hover:!text-Primary1000">
              Clinic Setting
            </Link>
          ),
        },
      ],
    },
    { type: "divider" },
    {
      key: "logout",
      label: (
        <Button outline className="w-full" onClick={handleLogout} disabled={isLoggingOut} aria-disabled={isLoggingOut}>
          {isLoggingOut ? "Logging out..." : "Log out"}
        </Button>
      ),
    },
  ];

  return (
    <Flex className="w-full bg-white px-4 py-1" justify="space-between" align="center">
      {/* Title and Description */}
      <Flex vertical className="min-w-0">
        <Text className="mt-7 text-xl font-helvetica-700 text-Gray900 sm:text-header truncate">{title}</Text>
        <Text className="mb-2 text-xs font-helvetica text-Gray600 sm:text-sm truncate">{description}</Text>
      </Flex>

      {/* Mobile hamburger */}
      {showHamburgerMenu && (
        <Dropdown menu={{ items: mobileMenu }} placement="bottomRight" trigger={["click"]} getPopupContainer={() => document.body}>
          <button type="button" aria-label="Open menu" className="md:hidden" style={{ outline: "none" }}>
            <Flex className="h-8 w-8 cursor-pointer rounded-full bg-Primary50" justify="center" align="center">
              <BurgerIcon />
            </Flex>
          </button>
        </Dropdown>
      )}
    </Flex>
  );
};

export default Header;
export { Header };
