import { IconProps } from "@/interfaces/iconProps";

const BillingIcon = ({ color = "#718096", width = 16, height = 16 }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm.75 17.25h-1.5v-1.48c-1.818-.22-3.25-1.37-3.25-2.77h1.5c0 .68.91 1.31 2.25 1.31s2.25-.63 2.25-1.31c0-.72-.85-1.12-2.25-1.38-1.945-.36-3.75-1.07-3.75-2.87 0-1.37 1.25-2.53 3.25-2.75V5.75h1.5v1.44c1.677.22 2.92 1.28 2.92 2.56h-1.5c0-.68-.81-1.24-1.92-1.24-1.23 0-2.07.56-2.07 1.26 0 .68.91 1.02 2.25 1.28 2.145.4 3.75 1.13 3.75 2.97 0 1.49-1.31 2.61-3.25 2.83v1.42z"
        fill={color}
      />
    </svg>
  );
};

export default BillingIcon;
