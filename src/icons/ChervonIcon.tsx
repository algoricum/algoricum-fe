import { IconProps } from "@/interfaces/iconProps";

const ChervonIcon = ({ width = 16, height = 16, color = "black" }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.484835 0.234835C0.631282 0.0883883 0.868718 0.0883883 1.01517 0.234835L5.51516 4.73484C5.66161 4.88128 5.66161 5.11872 5.51516 5.26516L1.01517 9.76517C0.868718 9.91161 0.631282 9.91161 0.484835 9.76517C0.338388 9.61872 0.338388 9.38128 0.484835 9.23483L4.71967 5L0.484835 0.765165C0.338388 0.618718 0.338388 0.381282 0.484835 0.234835Z"
        fill={color}
      />
    </svg>
  );
};

export default ChervonIcon;
