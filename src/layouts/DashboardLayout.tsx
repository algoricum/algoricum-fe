"use client";

import { useState, type ReactNode } from "react";
import { Layout, Flex, type LayoutProps } from "antd";
import { Sidebar } from "@/components/common";

const { Content } = Layout;

interface DashboardLayoutProps extends LayoutProps {
  header?: ReactNode;
}

const DashboardLayout = ({ children, header }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-svh w-full overflow-x-hidden">
      <Layout className="h-full w-full flex flex-row">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Right side: header + content + footer as a column */}
        <Layout className="flex min-w-0 flex-1 flex-col">
          {header && (
            <div className="sticky top-0 z-40 w-full bg-white">
              <Flex className="w-full border-b-8 border-gray-300" style={{ height: 64, flexShrink: 0 }} align="center" justify="space-between">
                {header}
              </Flex>
            </div>
          )}

          {/* Content should scroll, header stays fixed */}
          <Content className="min-h-0 flex-1 overflow-y-auto bg-white ">{children}</Content>
        </Layout>
      </Layout>
    </div>
  );
};

export default DashboardLayout;
