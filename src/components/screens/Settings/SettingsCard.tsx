import Flex from "antd/es/flex";
import { ReactNode } from "react";

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

const SettingsCard = ({ title, description, children }: SettingsCardProps) => {
  return (
    <Flex vertical gap={12} className="bg-Gray100 p-3 rounded-xl w-full">
      <p className="text-Gray900 font-helvetica-500 text-sm leading-[23px]">{title}</p>
      {description && <p className="text-Gray600 font-helvetica-400 text-sm leading-[23px]">{description}</p>}
      {children}
    </Flex>
  );
};

export default SettingsCard;
