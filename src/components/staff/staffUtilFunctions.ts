// Utility functions
export const mapDatabaseStatusToFrontend = (dbStatus: string): string => {
  if (dbStatus === "Active" || dbStatus === "TRUE") return "active";
  return "inactive";
};

export const mapFrontendStatusToDatabase = (frontendStatus: string): boolean => {
  return frontendStatus === "active";
};

export const getInitials = (name: string): string =>
  name
    .split(" ")
    .map(w => w.charAt(0).toUpperCase())
    .join("")
    .substring(0, 2);
