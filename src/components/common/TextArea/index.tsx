import { Input } from "antd";
import { TextAreaProps } from "antd/es/input";
import React from "react";

const { TextArea: AntTextArea } = Input;

const TextArea: React.FC<TextAreaProps> = props => {
  const { className = "", ...inputProps } = props;

  return (
    <AntTextArea
      className={`border focus:!border-Primary1000 focus:!shadow-sm focus-within:!border-Primary1000 focus-within:!shadow-sm ${className}`}
      {...inputProps}
    />
  );
};

export default TextArea;
