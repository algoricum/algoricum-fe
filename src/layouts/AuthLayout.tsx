import { Logo } from "@/components/common";
import { Flex, type LayoutProps } from "antd";

interface Props extends LayoutProps {
  isBack?: boolean;
}

const AuthLayout = ({ children, isBack }: Props) => {
  return (
    <div className="flex w-full min-h-screen">
      {/* Left side - Scrollable content */}
      <div className="w-full md:w-1/2 min-h-screen overflow-y-auto">
        <Flex justify="center" className="p-6 md:p-8">
          <Flex vertical className="w-full max-w-[535px]">
            {/* Logo */}
            <div className="mb-6 md:mb-8 pt-2">
              <Logo isBack={isBack} />
            </div>

            {/* Content */}
            <Flex vertical className="w-full pb-8">
              {children}
            </Flex>
          </Flex>
        </Flex>
      </div>

      {/* Right side - Fixed hero image */}
      <div className="hidden md:block fixed top-0 right-0 w-1/2 h-screen">
        <div className="w-full h-full p-6">
          <div className="w-full h-full rounded-xl layout-onboarding relative overflow-hidden shadow-lg">
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 to-brand-secondary/50"></div>

            {/* Text positioned at the bottom */}
            <div className="absolute top-0 left-0 text-white p-12 z-10 max-w-md">
              <h2 className="text-4xl font-bold mb-4">Turn Clicks Into Care.</h2>
              <p className="text-xl">Your Clinic&apos;s AI Growth Assistant Starts Here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
