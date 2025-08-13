import { ChatIcon, TicketIcon } from "@/icons";
import { DashboardIcon } from "@/icons";
import { StaffManagementIcon } from "@/icons";
// import { CalendarIcon } from "@/icons";
import { BillingIcon } from "@/icons";
import IntegrationIcon from "@/icons/IntegrationIcon";

const menuItems = [
  {
    key: "dashboard",
    icon: <DashboardIcon color="#9564E9" width={16} height={16} />,
    selectedicon: <DashboardIcon color="white" width={16} height={16} />,
    label: "Dashboard",
    disabled: false,
  },
  {
    key: "leads",
    icon: <ChatIcon color="#9564E9" width={16} height={16} />,
    selectedicon: <ChatIcon color="white" width={16} height={16} />,
    label: "Lead Management",
    disabled: false,
  },
  {
    key: "appointments",
    icon: <TicketIcon color="#9564E9" width={16} height={16} />,
    selectedicon: <TicketIcon color="white" width={16} height={16} />,
    label: "Appointments",
    disabled: false,
  },
  {
    key: "staff",
    icon: <StaffManagementIcon color="#9564E9" width={16} height={16} />,
    selectedicon: <StaffManagementIcon color="white" width={16} height={16} />,
    label: "Staff Management",
    disabled: false,
  },
  {
    key: "billing",
    icon: <BillingIcon color="#9564E9" width={16} height={16} />,
    selectedicon: <BillingIcon color="white" width={16} height={16} />,
    label: "Billing",
    disabled: false,
  },
  {
    key: "integrations",
    icon: <IntegrationIcon color="#9564E9" width={16} height={16} />,
    selectedicon: <IntegrationIcon color="white" width={16} height={16} />,
    label: "Integrations",
    disabled: false,
  },
  
];

export default menuItems;
