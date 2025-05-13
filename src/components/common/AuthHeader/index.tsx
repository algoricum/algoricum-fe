"use client";
import { Flex } from "antd";
import { usePathname } from "next/navigation";

const loginHeader = {
  heading: "Welcome back to Hashbot!",
  subHeading: "Sign in to manage your chatbot and enhance your customer experience.",
};

const signUpHeader = {
  heading: "Create Your Hashbot Account",
  subHeading: "Sign in to manage your chatbot and enhance your customer experience.",
};

const forgotPasswordHeader = {
  heading: "Forgot Your Password?",
  subHeading: "Sign in to manage your chatbot and enhance your customer experience.",
};

const resetPasswordHeader = {
  heading: "Reset Your Password?",
  subHeading: "Sign in to manage your chatbot and enhance your customer experience.",
};

const verifyOtpHeader = {
  heading: "Verify Your Email",
  subHeading: "Sign in to manage your chatbot and enhance your customer experience.",
};

const clinicHeader = {
  heading: "Set Up Your Clinic",
  subHeading: "Sign in to manage your chatbot and enhance your customer experience.",
};

const header = (path: string) => {
  switch (path) {
    case "/login":
      return loginHeader.heading;
    case "/signup":
      return signUpHeader.heading;
    case "/forgot-password":
      return forgotPasswordHeader.heading;
    case "/reset-password":
      return resetPasswordHeader.heading;
    case "/verify-otp":
      return verifyOtpHeader.heading;
    case "/clinic":
      return clinicHeader.heading;
    default:
      return loginHeader.heading;
  }
};

const subHeader = (path: string) => {
  switch (path) {
    case "/login":
      return loginHeader.subHeading;
    case "/signup":
      return signUpHeader.subHeading;
    case "/forgot-password":
      return forgotPasswordHeader.subHeading;
    case "/reset-password":
      return resetPasswordHeader.subHeading;
    case "/verify-otp":
      return verifyOtpHeader.subHeading;
    case "/clinic":
      return clinicHeader.subHeading;
    default:
      return loginHeader.subHeading;
  }
};

const AuthHeader = () => {
  const path = usePathname();

  return (
    <Flex vertical className="gap-1 sm:gap-3">
      <h1 className="text-xl sm:text-4xl text-Gray900 font-helvetica-700">{header(path)}</h1>
      <p className="text-xs font-helvetica text-Gray600">{subHeader(path)}</p>
    </Flex>
  );
};

export default AuthHeader;
