import menuItems from "@/constants/menuItems";
import { Col, Flex, Row } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

interface MobileFooterProps {
  isSiteDashboard?: boolean;
}

const MobileFooter = ({ isSiteDashboard = false }: MobileFooterProps) => {
  const { push } = useRouter();

  const [expanded, setExpanded] = useState(false);
  const path = usePathname();

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const isSelected = useCallback(
    (route: string) => {
      return path.includes(route);
    },
    [path],
  );

  const menuHandler = (key: string) => {
    switch (key) {
      case "content":
        return push("/content/articles");
      case "settings":
        return push("/settings/widget");
      default:
        return push("/content/articles");
    }
  };

  return (
    <div className="fixed bottom-3 left-0 right-0 m-auto md:w-3/4 xs:w-[94%] min-[821px]:hidden">
      <Row
        className={`w-full ${isSiteDashboard ? "bg-white border border-Gray400 shadow-2xl" : "bg-Primary1000"} rounded-xl px-2 pt-1 pb-[19px] overflow-y-hidden ${expanded ? "h-auto" : "h-[80px]"}`}
        gutter={8}
        justify="center"
        align="middle"
      >
        {menuItems.map((item, index) => (
          <>
            {!item.disabled && (
              <Col span={6} key={index}>
                <Flex
                  vertical
                  align="center"
                  className={`w-full px-4 py-2 cursor-pointer group hover:border-b-2 border-Gray300 hover:${isSiteDashboard ? "border-b-2 border-b-Primary1000" : "bg-Primary900"} rounded-xl ${
                    isSelected(item?.key) && `!bg-white rounded shadow-2xl ${isSiteDashboard && "border-b border-b-Primary1000"}`
                  } `}
                  gap={8}
                  onClick={() => menuHandler(item.key)}
                >
                  {isSelected(item?.key) ? item.selectedIcon : item.icon}
                  <p
                    className={`min-w-[80px] capitalize font-PoppinsSemiBold sm:text-xs text-[10px] text-center ${isSelected(item?.key) ? "text-Primary1000" : "text-Gray500"}`}
                  >
                    {item.label}
                  </p>
                </Flex>
              </Col>
            )}
          </>
        ))}
      </Row>
      {menuItems.length > 4 && (
        <Flex
          justify="center"
          align="center"
          className={`${isSiteDashboard ? "bg-Primary1000" : "bg-Gray900"} rounded-[30px] py-1 px-[10px] relative bottom-3 transform -translate-x-1/2 left-1/2 w-[120px] cursor-pointer mt-[4px]`}
          onClick={toggleExpand}
        >
          <p className="text-[10px] font-Poppins text-center text-white">{expanded ? "View Less" : "View More Options"}</p>
        </Flex>
      )}
    </div>
  );
};

export default MobileFooter;
