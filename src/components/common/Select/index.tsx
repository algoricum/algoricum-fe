import { Select as AntSelect, SelectProps } from "antd";
import React from "react";

interface SelectCustomProps extends SelectProps {
  className?: string;
}
const Select: React.FC<SelectCustomProps> = props => {
  const { className, ...inputProps } = props;

  return <AntSelect popupClassName="custom-select-popup" className={`w-full custom-select  ${className}`} {...inputProps} />;
};

export default Select;
