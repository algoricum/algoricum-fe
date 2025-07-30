import React, { ReactNode } from "react";

interface ThemeWrapperProps {
  children: ReactNode | ReactNode[];
}

const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ children }) => {

  // useEffect(() => {
  //   // Safe check for primaryColor with optional chaining and default to defaultTheme
  //   const primaryColor = clinic?.dashboard_theme?.primary_color;
  //   const theme = selectTheme(primaryColor);
  //   updateTheme(theme); // Apply the selected theme or default theme
  // }, [clinic]);

  return <>{children}</>;
};

export default ThemeWrapper;
