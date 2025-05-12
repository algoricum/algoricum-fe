import { Logo } from "@/components/common"
import { Flex, type LayoutProps } from "antd"

interface Props extends LayoutProps {
  isBack?: boolean
}

const AuthLayout = ({ children, isBack }: Props) => {
  return (
    <Flex gap={0} className="w-full h-screen overflow-auto">
      {/* Left side - Login form */}
      <Flex justify="center" className="flex-1 p-8 max-w-full h-full">
        <Flex vertical className="max-w-[535px] w-full justify-center">
          {/* Logo */}
          <div className="mb-8">
            <Logo isBack={isBack} />
          </div>

          {/* Content */}
          <Flex vertical className="">
            {children}
          </Flex>
        </Flex>
      </Flex>
 
      {/* Right side - Hero image with text */}
      <Flex className="w-[50%] h-full hidden md:flex items-center justify-center p-6" style={{ minWidth: "450px" }}>
        <div className="w-full h-full rounded-xl layout-onboarding relative overflow-hidden shadow-lg">
          {/* Optional: Add a subtle pattern or gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 to-brand-secondary/50"></div>

          {/* Text positioned at the bottom */}
          <div className="absolute bottom-0 left-0 text-white p-12 z-10 max-w-md">
            <h2 className="text-4xl font-bold mb-4">Turn Clicks Into Care.</h2>
            <p className="text-xl">Your Clinic's AI Growth Assistant Starts Here.</p>
          </div>
        </div>
      </Flex>
    </Flex>
  )
}

export default AuthLayout
