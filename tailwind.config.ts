import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      screens: {
        xl: "1300px",
      },
    },
    // Override the default fontFamily to make HelveticaNeue the default
    fontFamily: {
      // Set HelveticaNeue as the default sans-serif font family
      sans: ["HelveticaNeue", ...defaultTheme.fontFamily.sans],
      // Keep your custom font families
      Poppins: ["Poppins", ...defaultTheme.fontFamily.sans],
      HennyPenny: ["HennyPenny", ...defaultTheme.fontFamily.sans],
      helvetica: ["HelveticaNeue", ...defaultTheme.fontFamily.sans],
      "helvetica-500": ["HelveticaNeue-500", ...defaultTheme.fontFamily.sans],
      "helvetica-700": ["HelveticaNeue-700", ...defaultTheme.fontFamily.sans],
      // You can also keep other default font families
      serif: defaultTheme.fontFamily.serif,
      mono: defaultTheme.fontFamily.mono,
    },
    extend: {
      screens: {
        xs: "320px",
        ...defaultTheme.screens,
        md: "821px",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        Primary50: "var(--color-primary-50)",
        Primary100: "var(--color-primary-100)",
        Primary200: "var(--color-primary-200)",
        Primary300: "var(--color-primary-300)",
        Primary400: "var(--color-primary-400)",
        Primary500: "var(--color-primary-500)",
        Primary600: "var(--color-primary-600)",
        Primary700: "var(--color-primary-700)",
        Primary800: "var(--color-primary-800)",
        Primary900: "var(--color-primary-900)",
        Primary1000: "var(--color-primary-1000)",
        Black5: "var(--color-black-5)",
        Black10: "var(--color-black-10)",
        Black20: "var(--color-black-20)",
        Black30: "var(--color-black-30)",
        Black40: "var(--color-black-40)",
        Black50: "var(--color-black-50)",
        Black60: "var(--color-black-60)",
        Black70: "var(--color-black-70)",
        Black80: "var(--color-black-80)",
        Black90: "var(--color-black-90)",
        Black100: "var(--color-black-100)",
        Gray50: "var(--color-gray-50)",
        Gray100: "var(--color-gray-100)",
        Gray200: "var(--color-gray-200)",
        Gray300: "var(--color-gray-300)",
        Gray400: "var(--color-gray-400)",
        Gray500: "var(--color-gray-500)",
        Gray600: "var(--color-gray-600)",
        Gray700: "var(--color-gray-700)",
        Gray800: "var(--color-gray-800)",
        Gray900: "var(--color-gray-900)",
        danger: "var(--color-danger)",
        dangerSoft: "var(--color-danger-soft)",
        dangerDark: "var(--color-danger-dark)",
        warningSoft: "var(--color-warning-soft)",
        warningDark: "var(--color-warning-dark)",
        warning: "var(--color-warning)",
        success: "var(--color-success)",
        successSoft: "var(--color-success-soft)",
        successDark: "var(--color-success-dark)",
        brand: {
          primary: "var(--color-brand-primary)", // Emerald green primary color
          primary50: "var(--color-brand-primary-50)",
          primary100: "var(--color-brand-primary-100)",
          primary200: "var(--color-brand-primary-200)",
          primary300: "var(--color-brand-primary-300)",
          primary400: "var(--color-brand-primary-400)",
          primary500: "var(--color-brand-primary-500)",
          primary600: "var(--color-brand-primary-600)",
          primary700: "var(--color-brand-primary-700)",
          primary800: "var(--color-brand-primary-800)",
          primary900: "var(--color-brand-primary-900)",
          primary1000: "var(--color-brand-primary-1000)",
          secondary: "#26046e", // Darker shade for hover states
          light: "#E6F2EF", // Light shade for backgrounds
          accent: "#1A8870", // Accent color for highlights
        },
      },
      boxShadow: {
        ...defaultTheme.boxShadow,
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-default)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
      },
      fontSize: {
        ...defaultTheme.fontSize,
        header: ["28px", "38.09px"],
      },
    },
  },
  plugins: [
    function ({ addBase }: { addBase: any }) {
      addBase({
        // Force HelveticaNeue on ALL elements
        "*": {
          fontFamily: 'HelveticaNeue, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
        "html, body": {
          fontFamily: 'HelveticaNeue, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
        "p, input, textarea, select, button, div, span, label": {
          fontFamily: 'HelveticaNeue, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
        "h1, h2, h3, h4, h5, h6": {
          fontFamily: 'HelveticaNeue-700, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
        // ALL Ant Design components
        '[class*="ant-"]': {
          fontFamily: 'HelveticaNeue, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
        '[class*="ant-"] *': {
          fontFamily: 'HelveticaNeue, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
        // Specific Ant Design components
        ".ant-form, .ant-form *": {
          fontFamily: 'HelveticaNeue, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
        ".ant-input, .ant-input *": {
          fontFamily: 'HelveticaNeue, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
        ".ant-input::placeholder": {
          fontFamily: 'HelveticaNeue, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
        ".ant-select, .ant-select *": {
          fontFamily: 'HelveticaNeue, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
        ".ant-btn, .ant-btn *": {
          fontFamily: 'HelveticaNeue, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        },
      });
    },
  ],
} satisfies Config;
