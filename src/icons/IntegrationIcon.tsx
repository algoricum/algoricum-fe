import { IconProps } from "@/interfaces/iconProps";

const IntegrationIcon = ({ color = "#718096", width = 24, height = 24, ...props }: IconProps) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Integration"
      {...props}
    >
      {/* Central hub circle */}
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" fill="none" />
      
      {/* Top connection */}
      <path d="M12 9V3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="3" r="2" stroke={color} strokeWidth="1.5" fill="none" />
      
      {/* Right connection */}
      <path d="M15 12h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="21" cy="12" r="2" stroke={color} strokeWidth="1.5" fill="none" />
      
      {/* Bottom connection */}
      <path d="M12 15v6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="21" r="2" stroke={color} strokeWidth="1.5" fill="none" />
      
      {/* Left connection */}
      <path d="M9 12H3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="3" cy="12" r="2" stroke={color} strokeWidth="1.5" fill="none" />
      
      {/* Diagonal connections */}
      <path d="m14.12 9.88 4.24-4.24" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="18.36" cy="5.64" r="1.5" stroke={color} strokeWidth="1.5" fill="none" />
      
      <path d="m14.12 14.12 4.24 4.24" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="18.36" cy="18.36" r="1.5" stroke={color} strokeWidth="1.5" fill="none" />
      
      <path d="m9.88 14.12-4.24 4.24" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5.64" cy="18.36" r="1.5" stroke={color} strokeWidth="1.5" fill="none" />
      
      <path d="m9.88 9.88-4.24-4.24" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5.64" cy="5.64" r="1.5" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
};

export default IntegrationIcon;