import { ColorPicker } from "@/components/elements";
import { Flex, Form } from "antd";

interface ColorConfiguratorProps {
  description?: string;
  heading: string;
  color?: string;
  fieldName: string;
}
const ColorConfigurator = ({ fieldName = "", heading = "", description = "" }: ColorConfiguratorProps) => {
  return (
    <Flex vertical gap={8}>
      <p className="text-Gray900 font-helvetica-500 text-sm leading-[23px]">{heading}</p>
      {description && <p className="text-Gray600 font-helvetica-400 text-sm leading-[23px]">{description || ""}</p>}
      <Form.Item
        name={fieldName}
        getValueFromEvent={color => {
          return "#" + color.toHex();
        }}
      >
        <ColorPicker size="small" />
      </Form.Item>
    </Flex>
  );
};

export default ColorConfigurator;
