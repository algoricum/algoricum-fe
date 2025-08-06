import { Sidebar } from "@/components/common";
import MobileFooter from "@/components/common/MobileFooter";
import { Flex, Layout, type LayoutProps } from "antd";
import type { ReactNode } from "react";
import { useState } from "react";

const { Content } = Layout;

interface DashboardLayoutProps extends LayoutProps {
  header?: ReactNode;
}

const DashboardLayout = ({ children, header }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="h-screen overflow-hidden">
      <Layout className="h-full flex flex-row">
        {/* <Sidebar /> */}
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <Layout className="flex-1">
          {header && (
            <Flex className="w-full border-b border-Gray300" style={{ height: "64px", flexShrink: 0 }}>
              {header}
            </Flex>
          )}

          <Content
            className="bg-white p-4"
            style={{
              height: header ? "calc(100vh - 60px - 60px)" : "calc(100vh - 60px)", // Subtract header and footer height
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            {children}
          </Content>

          <MobileFooter />
        </Layout>
      </Layout>
    </div>
  );
};

export default DashboardLayout;
