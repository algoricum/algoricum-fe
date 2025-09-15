import { IconProps } from "@/interfaces/iconProps";
const UserIcon = ({ width = 16, height = 16, color = "black" }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="8" cy="5" r="3" stroke={color} strokeWidth="1.2" />
      {/* Shoulders */}
      <path
        d="M2.66669 13.3333C2.66669 10.756 5.05071 8.66667 8.00002 8.66667C10.9493 8.66667 13.3334 10.756 13.3334 13.3333"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
};
export default UserIcon;
