// import { Sidebar } from "@/components/common";
import MobileFooter from "@/components/common/MobileFooter";
import { Flex, Layout, type LayoutProps } from "antd";
import type { ReactNode } from "react";

interface DashboardLayoutProps extends LayoutProps {
  header?: ReactNode;
}

const DashboardLayout = ({ children, header }: DashboardLayoutProps) => {
  return (
    <div className="h-screen overflow-hidden">
      <Layout className="h-full flex flex-row">
        {/* <Sidebar /> */}
        <Layout className="flex-1">
          {header && (
            <Flex className="w-full border-b border-Gray400" style={{ height: "60px", flexShrink: 0 }}>
              {header}
            </Flex>
          )}

          {children}
          <MobileFooter />
        </Layout>
      </Layout>
    </div>
  );
};

export default DashboardLayout;
