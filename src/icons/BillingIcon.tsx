import { IconProps } from "@/interfaces/iconProps";

const BillingIcon = ({ color = "#718096", width = 24, height = 24, ...props }: IconProps) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Billing"
      {...props}
    >
      <path d="M12 3v16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M16 8c0-2-2-3-4-3s-4 1-4 3c0 1.5 2 2 4 2.5 2 .5 4 1 4 2.5 0 2-2 3-4 3s-4-1-4-3"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default BillingIcon;
