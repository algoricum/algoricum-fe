import { IconProps } from "@/interfaces/iconProps";

const MailIcon = ({ width = 16, height = 16, color = "black" }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12.875 13.25H3.125C1.40188 13.25 0 11.8481 0 10.125V3.875C0 2.15188 1.40188 0.75 3.125 0.75H12.875C14.5981 0.75 16 2.15188 16 3.875V10.125C16 11.8481 14.5981 13.25 12.875 13.25ZM3.125 2C2.09113 2 1.25 2.84113 1.25 3.875V10.125C1.25 11.1589 2.09113 12 3.125 12H12.875C13.9089 12 14.75 11.1589 14.75 10.125V3.875C14.75 2.84113 13.9089 2 12.875 2H3.125Z"
        fill={color}
      />
    </svg>
  );
};

export default MailIcon;
