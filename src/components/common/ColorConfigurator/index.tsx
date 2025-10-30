import { ColorPicker } from "@/components/elements";
import Flex from "antd/es/flex";

interface ColorConfiguratorProps {
  description?: string;
  heading: string;
  color?: string;
  fieldName: string;
  value?: string;

  onChange?: (value: string) => void;
}

const ColorConfigurator = ({ heading = "", description = "", value, onChange }: ColorConfiguratorProps) => {
  return (
    <Flex vertical gap={8}>
      <p className="text-Gray900 font-helvetica-500 text-sm leading-[23px]">{heading}</p>
      {description && <p className="text-Gray600 font-helvetica-400 text-sm leading-[23px]">{description}</p>}
      <ColorPicker size="small" value={value} onChange={color => onChange?.("#" + color.toHex())} />
    </Flex>
  );
};

export default ColorConfigurator;
