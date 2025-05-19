import { SecondaryMenusMobile, SecondarySidebar, Sidebar } from "@/components/common";
import MobileFooter from "@/components/common/MobileFooter";
import contentMenuItems from "@/constants/contentMenuItems";
import settingMenuItems from "@/constants/settingMenu";
import { Flex, Layout, LayoutProps } from "antd";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";
declare global {
  interface Window {
    BOTSDK?: {
      initialize: (options: {
        apiKey: string;
        name: string;
        userId: string;
      }) => void;
    };
  }
}
const { Content } = Layout;

interface DashboardLayoutProps extends LayoutProps {
  header?: ReactNode; // Optional header prop
}

const DashboardLayout = ({ children, header }: DashboardLayoutProps) => {
  const path = usePathname();

   useEffect(() => {
    if (window.BOTSDK) {
      window.BOTSDK.initialize({
        apiKey: '3d2f8dc7ff0d42164f00e9040c8931904fbbb524a19241a12ee7dbfa72e55691',
        name: 'Hassan Shahzad',
        userId: '6af9e11b-4108-404f-92cb-8cf151d9b847',
      });
    } else {
      console.error("BOTSDK is not defined");
    }
  }, []);
  return (
    <div className="min-h-screen">
      <Layout className="h-screen flex flex-row overflow-x-hidden">
        <Sidebar />
        {path.includes("content") && <SecondarySidebar menuItems={contentMenuItems} />}
        {path.includes("settings") && <SecondarySidebar menuItems={settingMenuItems} heading="Settings" />}

        <Layout className="px-0 py-0 flex-shrink-0 max-w-full flex-1 overflow-hidden">
          <Flex className="w-full border-b border-Gray400">{header}</Flex>
          <Content className="flex flex-col p-4 gap-4 relative overflow-y-auto max-[820px]:mb-[120px]">
            {path.includes("content") && <SecondaryMenusMobile menuItems={contentMenuItems} />}
            {path.includes("settings") && <SecondaryMenusMobile menuItems={settingMenuItems} />}

            {children}
          </Content>
          {/* Footer */}
          <MobileFooter />
        </Layout>
      </Layout>
    </div>
  );
};

export default DashboardLayout;
