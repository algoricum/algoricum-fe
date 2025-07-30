import { ChatIcon, TicketIcon } from "@/icons";
import { DashboardIcon } from "@/icons";
import { StaffManagementIcon } from "@/icons";
// import { CalendarIcon } from "@/icons";
import { BillingIcon } from "@/icons";

const menuItems = [
  {
    key: "dashboard",
    icon: <DashboardIcon />,
    selectedicon: <DashboardIcon color="var(--color-primary-1000)" />,
    label: "Dashboard",
    disabled: false,
  },
  {
    key: "leads",
    icon: <ChatIcon />,
    selectedicon: <ChatIcon color="var(--color-primary-1000)" />,
    label: "Lead Management",
    disabled: false,
  },
  {
    key: "appointments",
    icon: <TicketIcon />,
    selectedicon: <TicketIcon color="var(--color-primary-1000)" />,
    label: "Appointments",
    disabled: false,
  },
  {
    key: "staff",
    icon: <StaffManagementIcon />,
    selectedicon: <StaffManagementIcon color="var(--color-primary-1000)" />,
    label: "Staff Management",
    disabled: false,
  },
  {
    key: "billing",
    icon: <BillingIcon />,
    selectedicon: <BillingIcon color="var(--color-primary-1000)" />,
    label: "Billing",
    disabled: false,
  },
];

export default menuItems;
