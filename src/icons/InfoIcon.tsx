import { IconProps } from "@/interfaces/iconProps";

const InfoIcon = ({ color = "#191919", width = 12, height = 12 }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 3 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.9307 3.58789L0.639687 3.875L0.557656 4.25586L1.00883 4.33789C1.3018 4.4082 1.36039 4.51367 1.29594 4.80664L0.557656 8.27539C0.364297 9.17188 0.663125 9.59375 1.36625 9.59375C1.91117 9.59375 2.54398 9.3418 2.83109 8.99609L2.91898 8.58008C2.71977 8.75586 2.4268 8.82617 2.23344 8.82617C1.95805 8.82617 1.85844 8.63281 1.92875 8.29297L2.9307 3.58789Z"
        fill={color}
      />
      <circle cx="2" cy="1.5" r="1" fill={color} />
    </svg>
  );
};

export default InfoIcon;
