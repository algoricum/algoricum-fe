import { SettingIcon, LogoutIcon } from "@/icons";

const footerItems = [
  {
    key: "profileSettings",
    icon: <SettingIcon />,
    selectedicon: <SettingIcon color="var(--color-primary-1000)" />,
    label: "Profile Settings",
  },
  {
    key: "logout",
    icon: <LogoutIcon />,
    selectedicon: <LogoutIcon color="var(--color-primary-1000)" />,
    label: "Logout",
  },
];

export default footerItems;
