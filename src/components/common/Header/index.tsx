"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flex, Typography, Dropdown, MenuProps, Avatar, Spin } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { signOut } from "@/utils/supabase/auth-helper";
import { ErrorToast, SuccessToast } from "@/helpers/toast";

const { Text } = Typography;

interface HeaderProps {
  title?: string;
  description?: string;
}

const Header = ({ title = "", description = "" }: HeaderProps) => {
  const { push } = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const menuHandler = async (key: string) => {
    switch (key) {
      case "settings":
        return push("/settings/widget");
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

  const dropdownItems: MenuProps["items"] = [
    { key: "settings", label: "Settings" },
    { type: "divider" },
    {
      key: "logout",
      label: isLoggingOut ? <Spin size="small" /> : "Logout",
      disabled: isLoggingOut,
    },
  ];

  return (
    <Flex className="w-full bg-white px-4 py-3" justify="space-between" align="center">
      <Flex vertical>
        <Text className="text-xl sm:text-header font-helvetica-700 text-Gray900">{title}</Text>
        <Text className="text-xs sm:text-sm font-helvetica text-Gray600">{description}</Text>
      </Flex>
      <Dropdown
        menu={{ items: dropdownItems, onClick: ({ key }) => menuHandler(key) }}
        placement="bottomRight"
        arrow
      >
        <Avatar
          className="cursor-pointer"
          size="large"
          icon={<UserOutlined />}
        />
      </Dropdown>
    </Flex>
  );
};

export default Header;
