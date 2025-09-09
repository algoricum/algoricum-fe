import { LogoutIcon, SettingIcon } from "@/icons";

const footerItems = [
  {
    key: "profileSettings",
    icon: <SettingIcon color="#9564E9" width={16} height={16} />,
    selectedicon: <SettingIcon color="white" width={16} height={16} />,
    label: "Profile Settings",
  },
  {
    key: "logout",
    icon: <LogoutIcon color="#9564E9" width={16} height={16} />,
    selectedicon: <LogoutIcon color="white" width={16} height={16} />,
    label: "Logout",
  },
];

export default footerItems;
