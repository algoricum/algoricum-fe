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
