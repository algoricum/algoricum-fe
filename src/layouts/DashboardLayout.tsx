import { SecondaryMenusMobile, SecondarySidebar, Sidebar } from "@/components/common";
import MobileFooter from "@/components/common/MobileFooter";
import contentMenuItems from "@/constants/contentMenuItems";
import settingMenuItems from "@/constants/settingMenu";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Flex, Layout, LayoutProps } from "antd";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";

const { Content } = Layout;

interface DashboardLayoutProps extends LayoutProps {
  header?: ReactNode; // Optional header prop
}

const DashboardLayout = ({ children, header }: DashboardLayoutProps) => {
  const path = usePathname();
  const { user } = useSupabaseAuth();

  useEffect(() => {
    if (window.BOTSDK && user) {
      window.BOTSDK.initialize({
        apiKey:
          "1d10bb50-6c2b-4e20-8152-a832dc08e4ab.a6ZSYfSRvy8Lwx6937nvKVNP8l7eoqQC9Vl62DzBhJPcPPDosEk8mfC8ep35SyT0Ea7TGVuc2-8uEr_B-W5p5w",
        name: user.name,
        userId: user.id,
      });
    } else {
      console.error("BOTSDK is not defined");
    }
  }, [user]);
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
