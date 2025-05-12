import { IconProps } from "@/interfaces/iconProps";

const ChatPageIcon = ({ color = "#191919", width = 12, height = 12 }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M2.5 2C2.22386 2 2 2.22386 2 2.5V9.5C2 9.77614 2.22386 10 2.5 10H9.5C9.77614 10 10 9.77614 10 9.5V2.5C10 2.22386 9.77614 2 9.5 2H2.5ZM1 2.5C1 1.67157 1.67157 1 2.5 1H9.5C10.3284 1 11 1.67157 11 2.5V9.5C11 10.3284 10.3284 11 9.5 11H2.5C1.67157 11 1 10.3284 1 9.5V2.5Z"
        fill={color}
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M1 4.5C1 4.22386 1.22386 4 1.5 4H10.5C10.7761 4 11 4.22386 11 4.5C11 4.77614 10.7761 5 10.5 5H1.5C1.22386 5 1 4.77614 1 4.5Z"
        fill={color}
      />
    </svg>
  );
};

export default ChatPageIcon;
