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
    <Flex vertical gap={8} className="">
      <p className="text-Gray900 font-helvetica-500 text-sm leading-[23px]">{heading}</p>
      <Form.Item
        name={fieldName}
        getValueFromEvent={color => {
          return "#" + color.toHex();
        }}
      >
        <Flex
          className="justify-between items-center rounded-[72px] border border-[#EDF2F7] px-3 py-2 bg-[#FFFFFF]">
          {description && <p className="text-Gray600 font-helvetica-400 text-sm leading-[23px]">{description || ""}</p>}
          <ColorPicker size="small" />
        </Flex>
      </Form.Item>
    </Flex>
  );
};

export default ColorConfigurator;
