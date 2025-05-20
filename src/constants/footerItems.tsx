import { SettingIcon, SetupIcon } from "@/icons";
import LogoutIcon from "@/icons/LogoutIcon";

const footerItems = [
  {
    key: "profileSettings",
    icon: <SettingIcon />,
    selectedIcon: <SettingIcon color="var(--color-primary-1000)" />,
    label: "Profile Settings",
  },
  {
    key: "logout",
    icon: <LogoutIcon />,
    selectedIcon: <LogoutIcon color="var(--color-primary-1000)" />,
    label: "Logout",
  },
];

export default footerItems;
