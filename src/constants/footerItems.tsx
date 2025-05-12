import { SetupIcon } from "@/icons";
import LogoutIcon from "@/icons/LogoutIcon";

const footerItems = [
  {
    key: "setup",
    icon: <SetupIcon />,
    selectedIcon: <SetupIcon color="var(--color-primary-1000)" />,
    label: "Setup",
  },
  {
    key: "logout",
    icon: <LogoutIcon />,
    selectedIcon: <LogoutIcon color="var(--color-primary-1000)" />,
    label: "Logout",
  },
];

export default footerItems;
