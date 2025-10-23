import Flex from "antd/es/flex";
import { ReactNode } from "react";

interface Props {
  keyValue: string;
  label: string;
  icon?: ReactNode;
  isBackground?: boolean;
}

const KeyLabelItem = ({ keyValue, label, icon, isBackground = false }: Props) => {
  return (
    <Flex justify="between" align="center">
      <Flex className="w-1/2">
        <p className="text-sm font-helvetica text-Gray600">{keyValue}</p>
      </Flex>
      <Flex align="center" gap={6} className={`w-1/2 max-w-fit ${isBackground && "px-2 py-1 rounded-[40px] bg-Gray100"}`}>
        {icon}
        <p className="text-sm font-helvetica text-Gray900">{label}</p>
      </Flex>
    </Flex>
  );
};

export default KeyLabelItem;
