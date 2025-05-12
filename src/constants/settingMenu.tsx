import { AllHelpCenterIcon } from "@/icons";

const settingMenuItems = [
  {
    key: "widget",
    icon: <AllHelpCenterIcon />,
    selectedIcon: <AllHelpCenterIcon color="var(--color-primary-1000)" />,
    label: "Widget Setup",
    route: "/settings/widget",
  },
];
export default settingMenuItems;
