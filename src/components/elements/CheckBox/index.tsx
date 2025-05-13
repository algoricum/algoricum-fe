import { Checkbox as AntCheckBox } from "antd";
const CheckBox = (props: any) => {
  const { classname = "", ...inputProps } = props;
  return (
    <AntCheckBox className={`custom-check font-helvetica text-[12px]${classname}`} {...inputProps}>
      Card
    </AntCheckBox>
  );
};

export default CheckBox;
