import { IconProps } from "@/interfaces/iconProps";

const BurgerIcon = ({ color = "var(--color-primary-1000)", width = 16, height = 13 }: IconProps) => (
  <svg width={width} height={height} viewBox="0 0 16 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect y="0.61792" width="16" height="2" rx="1" fill={color} />
    <rect y="5.61792" width="16" height="2" rx="1" fill={color} />
    <rect y="10.6179" width="16" height="2" rx="1" fill={color} />
  </svg>
);

export default BurgerIcon;
