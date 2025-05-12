import { IconProps } from "@/interfaces/iconProps";

const CollapseIcon = ({ color = "#4A5568", width = 32, height = 36 }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 8C0 3.58172 3.58172 0 8 0H32V36H8C3.58172 36 0 32.4183 0 28V8Z" fill="#F7FAFC" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.8536 13.6464C20.0488 13.8417 20.0488 14.1583 19.8536 14.3536L16.2071 18L19.8536 21.6464C20.0488 21.8417 20.0488 22.1583 19.8536 22.3536C19.6583 22.5488 19.3417 22.5488 19.1464 22.3536L15.1464 18.3536C14.9512 18.1583 14.9512 17.8417 15.1464 17.6464L19.1464 13.6464C19.3417 13.4512 19.6583 13.4512 19.8536 13.6464Z"
        fill={color}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.5 11C12.2239 11 12 11.2239 12 11.5L12 24.5C12 24.7761 12.2239 25 12.5 25C12.7761 25 13 24.7761 13 24.5L13 11.5C13 11.2239 12.7761 11 12.5 11Z"
        fill={color}
      />
    </svg>
  );
};

export default CollapseIcon;
