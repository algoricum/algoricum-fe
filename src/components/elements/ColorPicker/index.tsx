import { themeColors } from "@/utils/themeUtils";
import { ColorPicker as AntColorPicker, ColorPickerProps } from "antd";
import React from "react";

interface CustomInputProps extends ColorPickerProps {
  className?: string;
}

const ColorPicker: React.FC<CustomInputProps> = props => {
  const { className = "", ...inputProps } = props;
  return (
    <AntColorPicker
      defaultValue="#151109"
      size="small"
      placement="left"
      presets={themeColors}
      panelRender={(panel, { components: { Presets } }) => {
        return (
          <div className="custom-panel">
            {/* <Picker /> */}
            <Presets />
          </div>
        );
      }}
      showText
      className={`custom-picker p-[8px] flex flex-row-reverse items-center w-[140px] h-[36px] !border !border-Black5 !rounded-xl justify-between ${className}`}
      {...inputProps}
    />
  );
};

export default ColorPicker;
