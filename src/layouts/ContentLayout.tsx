import { Sidebar } from "@/components/common";
import MobileFooter from "@/components/common/MobileFooter";
import { Flex, LayoutProps } from "antd";

const ContentLayout = ({ children }: LayoutProps) => {
  return (
    <div className="flex w-full">
      <Sidebar />
      <Flex vertical className="flex w-full space-y-3 h-screen">
        {children}
      </Flex>
      <MobileFooter />
    </div>
  );
};

export default ContentLayout;
