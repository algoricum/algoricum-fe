import { IconProps } from "@/interfaces/iconProps";

const PlusIcon = ({ color = "black", width = 16, height = 16 }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.99972 0.142822C7.47311 0.142822 7.85686 0.526578 7.85686 0.999965V6.14282H12.9997C13.4731 6.14282 13.8569 6.52658 13.8569 6.99996C13.8569 7.47335 13.4731 7.85711 12.9997 7.85711H7.85686V13C7.85686 13.4734 7.47311 13.8571 6.99972 13.8571C6.52633 13.8571 6.14258 13.4734 6.14258 13V7.85711H0.999721C0.526334 7.85711 0.142578 7.47335 0.142578 6.99996C0.142578 6.52658 0.526334 6.14282 0.999721 6.14282H6.14258V0.999965C6.14258 0.526578 6.52633 0.142822 6.99972 0.142822Z"
        fill={color}
      />
    </svg>
  );
};

export default PlusIcon;
