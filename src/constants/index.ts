import { MenuProps } from "antd";

export const avatarmenu: MenuProps["items"] = [
  {
    key: "1",
    label: "My WorkSpace",
    disabled: true,
  },
  {
    type: "divider",
  },
  {
    key: "2",
    label: "Select WorkSpace",
    children: [],
  },
  {
    key: "3",
    danger: false,
    label: "Settings",
  },
  {
    key: "4",
    danger: true,
    label: "Logout",
  },
];
export const BOOKING_LINK = "https://calendly.com/algoricum/onboarding";

export const protectedRoutes = ["/content/articles", "/content/sections", "/setup"];

export const headerLinks = [
  {
    href: "/",
    label: "Product",
  },
  {
    href: "/",
    label: "Resources",
  },
  {
    href: "/",
    label: "Pricing",
  },
  {
    href: "/",
    label: "Contact sales",
  },
];

export const dashboardHeaderLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
  },
  {
    href: "/appointments",
    label: "Appointment",
  },
  {
    href: "/staff",
    label: "Staff",
  },
  {
    href: "/leads",
    label: "Leads",
  },
  {
    href: "/billing",
    label: "Billing",
  },
];

export const publicRoutes = ["/login", "/signup", "/forgot-password", "/clinic", "/verify-otp", "/reset-password"];

export const liveEnvironments = ["production", "development"];

export const PAGE_SIZE = 5;

export const InformationListingData = [
  "Provide and improve our services, including Help Center functionalities.",
  "Respond to user queries, process tickets, and ensure seamless support.",
  "Enhance platform performance and develop new features.",
  "Send important updates, notifications, or marketing communications (with consent).",
  "Ensure compliance with legal requirements.",
];

export const InformationListingDataRights = [
  "Access and review your personal information.",
  "Update or delete your account data.",
  "Opt-out of marketing communications.",
  "Request a copy of your data.",
];

export const TIME_OPTIONS = [
  "6:00 AM",
  "6:30 AM",
  "7:00 AM",
  "7:30 AM",
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
  "7:30 PM",
  "8:00 PM",
  "8:30 PM",
  "9:00 PM",
  "9:30 PM",
  "10:00 PM",
];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const CLINIC_FIELDS: [string, string][] = [
  ["Legal Business Name", "legal_business_name"],
  ["DBA Name", "dba_name"],
  ["Email", "email"],
  ["Phone", "phone"],
  ["Address", "address"],
  ["Booking Link", "calendly_link"],
  ["Clinic Type", "clinic_type"],
];

export const questions = [
  {
    id: "selectedCrm",
    type: "select",
    question: "Do you use a CRM to manage your leads?",
    options: ["HubSpot", "Pipedrive", "GoHighLevel", "NextHealth", "None of these"],
  },
  {
    id: "adsConnections",
    type: "select",
    question: "Are you running ads that generate leads?",
    options: ["Facebook Lead Ads", "Google Ads Lead Forms", "None of these"],
  },
  {
    id: "leadCaptureForms",
    type: "select",
    question: "Do you collect leads through lead capture forms?",
    options: ["Google Forms", "Typeform", "Jotform", "Gravity Forms", "None of these"],
  },
  {
    id: "uploadLeads",
    type: "radio",
    question: "Do you want to upload any other leads via CSV?",
    subtitle: "Importing your current leads means we can start following up immediately. No waiting, no missed opportunities.",
    options: ["Yes", "No"],
  },
];
