import { IconProps } from "@/interfaces/iconProps";

const ActionIcon = ({ color = "black", width = 16, height = 16 }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.75 13C9.75 13.8284 9.07843 14.5 8.25 14.5C7.42157 14.5 6.75 13.8284 6.75 13C6.75 12.1716 7.42157 11.5 8.25 11.5C9.07843 11.5 9.75 12.1716 9.75 13ZM9.75 8C9.75 8.82843 9.07843 9.5 8.25 9.5C7.42157 9.5 6.75 8.82843 6.75 8C6.75 7.17157 7.42157 6.5 8.25 6.5C9.07843 6.5 9.75 7.17157 9.75 8ZM9.75 3C9.75 3.82843 9.07843 4.5 8.25 4.5C7.42157 4.5 6.75 3.82843 6.75 3C6.75 2.17157 7.42157 1.5 8.25 1.5C9.07843 1.5 9.75 2.17157 9.75 3Z"
        fill={color}
      />
    </svg>
  );
};

export default ActionIcon;
