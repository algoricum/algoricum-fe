import { BellIcon } from "@/icons";
import Flex from "antd/es/flex";
import Typography from "antd/es/typography";

const { Text } = Typography;
interface HeaderProps {
  title?: string;
  description?: string;
}
const DashboardHeader = ({ title = "", description = "" }: HeaderProps) => {
  return (
    <Flex className="w-full bg-white py-4 px-4 sm:px-5" justify="space-between" align="center" gap={2}>
      <Flex vertical>
        <Text className="text-xl sm:text-header font-helvetica-700 text-Gray900">{title}</Text>
        <Text className="text-xs sm:text-sm font-helvetica text-Gray600 line-clamp-2 hover:line-clamp-6">{description}</Text>
      </Flex>
      <Flex gap={12} align="center">
        <Flex justify="center" align="center" className="w-8 h-8 sm:w-11 sm:h-11 rounded-full border border-Gray600 cursor-pointer">
          <BellIcon />
        </Flex>
      </Flex>
    </Flex>
  );
};

export default DashboardHeader;
