"use client";
import { Flex } from "antd";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useState } from "react";

interface menuTypeProps {
  key: string;
  icon: React.ReactNode | React.ReactNode[];
  selectedicon: React.ReactNode | React.ReactNode[];
  label: string;
  route: string;
}
interface ContentSidebarProps {
  menuItems: menuTypeProps[];
}
const SecondaryMenusMobile = ({ menuItems = [] }: ContentSidebarProps) => {
  const { push } = useRouter();
  const [isCollapsed] = useState<boolean>(false);

  const path = usePathname();

  const isSelected = useCallback(
    (route: string) => {
      return path.includes(route);
    },
    [path],
  );

  return (
    <Flex gap={10} className="scroll-auto lg:hidden">
      {menuItems.map(({ label, icon: Icon, selectedicon, route }, index) => (
        <div
          key={index}
          onClick={() => push(route)}
          className={`min-w-fit flex flex-row items-center p-2 gap-2 cursor-pointer border border-transparent hover:bg-Primary50 hover:border-Primary900 rounded-lg ${isSelected(route) && "bg-Primary50 border-Primary900"}`}
        >
          {isSelected(route) ? selectedicon : Icon}
          {!isCollapsed && <p className={`${isSelected(route) ? "text-Primary1000 font-PoppinsSemiBold" : "text-Gray600"}`}>{label}</p>}
        </div>
      ))}
    </Flex>
  );
};

export default SecondaryMenusMobile;
