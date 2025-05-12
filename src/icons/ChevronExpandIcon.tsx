import { IconProps } from "@/interfaces/iconProps";

const ChevronExpandIcon = ({ color = "#718096", width = 16, height = 16 }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.64645 9.14645C3.84171 8.95118 4.15829 8.95118 4.35355 9.14645L8 12.7929L11.6464 9.14645C11.8417 8.95118 12.1583 8.95118 12.3536 9.14645C12.5488 9.34171 12.5488 9.65829 12.3536 9.85355L8.35355 13.8536C8.15829 14.0488 7.84171 14.0488 7.64645 13.8536L3.64645 9.85355C3.45118 9.65829 3.45118 9.34171 3.64645 9.14645Z"
        fill={color}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.64645 6.85355C3.84171 7.04882 4.15829 7.04882 4.35355 6.85355L8 3.20711L11.6464 6.85355C11.8417 7.04882 12.1583 7.04882 12.3536 6.85355C12.5488 6.65829 12.5488 6.34171 12.3536 6.14645L8.35355 2.14645C8.15829 1.95118 7.84171 1.95118 7.64645 2.14645L3.64645 6.14645C3.45118 6.34171 3.45118 6.65829 3.64645 6.85355Z"
        fill={color}
      />
    </svg>
  );
};

export default ChevronExpandIcon;
