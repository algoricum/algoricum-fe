import { ChatIcon, SettingIcon } from "@/icons";
import { DashboardIcon } from "@/icons";
import { StaffManagementIcon } from "@/icons";

const menuItems = [
  {
    key: "dashboard",
    icon: <DashboardIcon />,
    selectedicon: <DashboardIcon color="var(--color-primary-1000)" />,
    label: "Dashboard",
    disabled: false,
  },
  {
    key: "staff-managment",
    icon: <StaffManagementIcon />,
    selectedicon: <StaffManagementIcon color="var(--color-primary-1000)" />,
    label: "Staff-Managment",
    disabled: false,
  },
  {
    key: "leads",
    icon: <ChatIcon />,
    selectedicon: <ChatIcon color="var(--color-primary-1000)" />,
    label: "Leads",
    disabled: false,
  },
  {
    key: "profileSettings",
    icon: <SettingIcon />,
    selectedicon: <SettingIcon color="var(--color-primary-1000)" />,
    label: "Profile Settings",
  },
];
export default menuItems;
