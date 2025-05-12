import { IconProps } from "@/interfaces/iconProps";

const ChatWidgetIcon = ({ color = "#191919", width = 12, height = 12 }: IconProps) => {
  return (
    <svg width={width} height={height} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M1 2C1 1.44772 1.44772 1 2 1H4.5C5.05228 1 5.5 1.44772 5.5 2V5.5C5.5 6.05228 5.05228 6.5 4.5 6.5H2C1.44772 6.5 1 6.05228 1 5.5V2ZM4.5 2H2V5.5H4.5V2Z"
        fill={color}
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M6.5 2C6.5 1.44772 6.94772 1 7.5 1H10C10.5523 1 11 1.44772 11 2V3.5C11 4.05228 10.5523 4.5 10 4.5H7.5C6.94772 4.5 6.5 4.05228 6.5 3.5V2ZM10 2H7.5V3.5H10V2Z"
        fill={color}
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M6.5 6.5C6.5 5.94772 6.94772 5.5 7.5 5.5H10C10.5523 5.5 11 5.94772 11 6.5V10C11 10.5523 10.5523 11 10 11H7.5C6.94772 11 6.5 10.5523 6.5 10V6.5ZM10 6.5H7.5V10H10V6.5Z"
        fill={color}
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M1 8.5C1 7.94772 1.44772 7.5 2 7.5H4.5C5.05228 7.5 5.5 7.94772 5.5 8.5V10C5.5 10.5523 5.05228 11 4.5 11H2C1.44772 11 1 10.5523 1 10V8.5ZM4.5 8.5H2V10H4.5V8.5Z"
        fill={color}
      />
    </svg>
  );
};

export default ChatWidgetIcon;
