import { defaultTheme, themes } from "@/constants/themes";
import { Theme } from "@/interfaces/themeType";

export const updateTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.style.setProperty("--color-primary-1000", theme.Primary1000);
  root.style.setProperty("--color-primary-900", theme.Primary900);
  root.style.setProperty("--color-primary-800", theme.Primary800);
  root.style.setProperty("--color-primary-700", theme.Primary700);
  root.style.setProperty("--color-primary-600", theme.Primary600);
  root.style.setProperty("--color-primary-500", theme.Primary500);
  root.style.setProperty("--color-primary-400", theme.Primary400);
  root.style.setProperty("--color-primary-300", theme.Primary300);
  root.style.setProperty("--color-primary-200", theme.Primary200);
  root.style.setProperty("--color-primary-100", theme.Primary100);
  root.style.setProperty("--color-primary-50", theme.Primary50);
};

export const themeColors = [
  {
    label: "Theme Colors",
    colors: [...themes.map((theme: any) => theme.theme.Primary1000)],
  },
];

export const selectTheme = (colorCode: string | null | undefined): Theme => {
  const matchedTheme = themes.find(
    (theme: any) => theme?.theme.Primary1000?.toLowerCase() == colorCode?.toLowerCase() && theme?.theme,
  )?.theme;
  return matchedTheme || defaultTheme;
};
