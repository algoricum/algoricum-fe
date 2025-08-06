import { ChatIcon, TicketIcon } from "@/icons";
import { DashboardIcon } from "@/icons";
import { StaffManagementIcon } from "@/icons";
// import { CalendarIcon } from "@/icons";
import { BillingIcon } from "@/icons";

const menuItems = [
  {
    key: "dashboard",
    icon: <DashboardIcon />,
    selectedicon: <DashboardIcon color="#FFFFFF" />,
    label: "Dashboard",
    disabled: false,
  },
  {
    key: "leads",
    icon: <ChatIcon />,
    selectedicon: <ChatIcon color="#FFFFFF" />,
    label: "Lead Management",
    disabled: false,
  },
  {
    key: "appointments",
    icon: <TicketIcon />,
    selectedicon: <TicketIcon color="#FFFFFF" />,
    label: "Appointments",
    disabled: false,
  },
  {
    key: "staff",
    icon: <StaffManagementIcon />,
    selectedicon: <StaffManagementIcon color="#FFFFFF" />,
    label: "Staff Management",
    disabled: false,
  },
  {
    key: "billing",
    icon: <BillingIcon />,
    selectedicon: <BillingIcon color="#FFFFFF" />,
    label: "Billing",
    disabled: false,
  },
];

export default menuItems;
