import { AllHelpCenterIcon } from "@/icons";

const contentMenuItems = [
  {
    key: "articles",
    icon: <AllHelpCenterIcon />,
    selectedicon: <AllHelpCenterIcon color="var(--color-primary-1000)" />,
    label: "Articles",
    route: "/content/articles",
  },
  {
    key: "sections",
    icon: <AllHelpCenterIcon />,
    selectedicon: <AllHelpCenterIcon color="var(--color-primary-1000)" />,
    label: "Sections",
    route: "/content/sections",
  },
];
export default contentMenuItems;
