import { AllHelpCenterIcon } from "@/icons";

const settingMenuItems = [
  {
    key: "widget",
    icon: <AllHelpCenterIcon />,
    selectedicon: <AllHelpCenterIcon color="var(--color-primary-1000)" />,
    label: "Widget Setup",
    route: "/settings/chatbot",
  },
];
export default settingMenuItems;
