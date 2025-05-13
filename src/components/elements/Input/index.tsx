import { Input as AntdInput, InputProps } from "antd";
import React from "react";

interface CustomInputProps extends InputProps {
  className?: string;
  visibilityToggle?: () => {};
  inputRef?: any;
}

const Input: React.FC<CustomInputProps> = props => {
  const { className = "", inputRef = null, ...inputProps } = props;

  return (
    <AntdInput
      ref={inputRef}
      className={`custom-input h-[44px] border-Black hover:!border-Primary1000 focus-within:!border-Primary1000 focus-within:!shadow-sm ${className}`}
      {...inputProps}
    />
  );
};

export default Input;
