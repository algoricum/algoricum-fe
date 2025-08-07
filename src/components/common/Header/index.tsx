"use client";
import { Flex, Typography } from "antd";

const { Text } = Typography;

interface HeaderProps {
  title?: string;
  description?: string;
}

const Header = ({ title = "", description = "" }: HeaderProps) => {

  return (
    <Flex className="w-full bg-white px-4 py-3" justify="space-between" align="center">
      <Flex vertical>
        <Text className="text-xl mt-2 sm:text-header font-helvetica-700 text-Gray900">{title}</Text>
        <Text className="text-xs mb-2 sm:text-sm font-helvetica text-Gray600">{description}</Text>
      </Flex>
    </Flex>
  );
};

export default Header;
