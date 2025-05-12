import { IconProps } from "@/interfaces/iconProps";

const BackArrowIcon = ({ color = "#1A202C", width = 16, height = 12 }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 4C8 3.72386 7.77614 3.5 7.5 3.5H1.70711L3.85355 1.35355C4.04882 1.15829 4.04882 0.841708 3.85355 0.646446C3.65829 0.451184 3.34171 0.451184 3.14645 0.646446L0.146446 3.64645C-0.0488157 3.84171 -0.0488157 4.15829 0.146446 4.35355L3.14645 7.35355C3.34171 7.54882 3.65829 7.54882 3.85355 7.35355C4.04882 7.15829 4.04882 6.84171 3.85355 6.64645L1.70711 4.5H7.5C7.77614 4.5 8 4.27614 8 4Z"
        fill={color}
      />
    </svg>
  );
};

export default BackArrowIcon;
