import type React from "react"
import { Flex } from "antd"
import { CheckCircleOutlined, FileTextOutlined, BankOutlined, FileImageOutlined } from "@ant-design/icons"
import { Logo } from "@/components/common"

interface OnboardingLayoutProps {
    children: React.ReactNode
    currentStep: number
}

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({ children, currentStep }) => {
    return (
        <Flex className="h-screen">
            {/* Left side - Form content */}
            <div className="flex-1 p-12 overflow-auto hide-scrollbar">{children}</div>

            {/* Right side - Progress indicator */}
            <Flex className="w-[50%] h-full hidden md:flex items-center justify-center p-6" style={{ minWidth: "450px" }}>
                <div className="w-full h-full rounded-xl layout-onboarding relative overflow-hidden shadow-lg pt-12 pl-12">
                    {/* Logo */}
                    <div className="flex items-center mb-24">
                        <div className="mb-8">
                            <Logo textColor={"white"} />
                        </div>
                    </div>
                    {/* Progress steps */}
                    <div className="relative">
                        {/* Vertical line connecting steps */}
                        <div className="absolute left-6 top-6 w-0.5 h-[calc(100%-24px)] bg-gray-300/30"></div>

                        {/* Step 1 */}
                        <div className="flex items-start mb-16 relative z-10">
                            <div
                                className={`rounded-full w-12 h-12 flex items-center justify-center outline  border-2 border-brand-primary outline-2 ${currentStep === 1
                                    ? "bg-white outline-white"
                                    : currentStep > 1
                                        ? "bg-success outline-success"
                                        : "bg-black30 outline-black30"
                                    }`}
                            >
                                {currentStep > 1 ? (
                                    <CheckCircleOutlined className="text-white" size={20} />
                                ) : (
                                    <FileTextOutlined className={currentStep === 1 ? "text-brand-primary" : "text-white"} size={20} />
                                )}
                            </div>
                            <div className="ml-4">
                                <div className={`text-sm ${currentStep === 1 ? "text-gray-200" : "text-gray-400"}`}>Step 1/3</div>
                                <div className={`font-medium ${currentStep === 1 ? "text-white" : "text-gray-300"}`}>
                                    Clinic Information
                                </div>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex items-start mb-16 relative z-10">
                            <div
                                className={`rounded-full w-12 h-12 flex items-center justify-center outline  border-2 border-brand-primary outline-2 ${currentStep === 2 ? "bg-white outline-white" : currentStep > 2 ? "bg-success outline-success" : "bg-Black30 outline-Black30"
                                    }`}
                            >
                                {currentStep > 2 ? (
                                    <CheckCircleOutlined className="text-white" size={20} />
                                ) : (
                                    <BankOutlined className={currentStep === 2 ? "text-brand-primary" : "text-white"} size={20} />
                                )}
                            </div>
                            <div className="ml-4">
                                <div className={`text-sm ${currentStep === 2 ? "text-gray-200" : "text-gray-400"}`}>Step 2/3</div>
                                <div className={`font-medium ${currentStep === 2 ? "text-white" : "text-gray-300"}`}>
                                    Registered Address
                                </div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex items-start relative z-10">
                            <div
                                className={`rounded-full w-12 h-12 flex items-center justify-center outline  border-2 border-brand-primary outline-2 ${currentStep === 3 ? "bg-white outline-white" : currentStep > 3 ? "bg-success outline-success" : "bg-Black30 outline-Black30"
                                    }`}
                            >
                                <FileImageOutlined className={currentStep === 3 ? "text-brand-primary" : "text-white"} size={20} />
                            </div>
                            <div className="ml-4">
                                <div className={`text-sm ${currentStep === 3 ? "text-gray-200" : "text-gray-400"}`}>Step 3/3</div>
                                <div className={`font-medium ${currentStep === 3 ? "text-white" : "text-gray-300"}`}>
                                    Brand Configuration
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Flex>
        </Flex>
    )
}

export default OnboardingLayout

