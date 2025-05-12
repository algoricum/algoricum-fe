import { CrossIcon } from "@/icons";
import { Button, Flex } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PreviewHeader = () => {
  const [isCrossHover, setIsCrossHover] = useState(false);
  const { back } = useRouter();

  const navigateToContent = () => {
    back();
  };
  return (
    <Flex className="bg-white w-full py-4 px-4 border-b border-Gray400" justify="space-between" align="center">
      <Flex vertical>
        <p className="text-header text-Gray900 font-helvetica-700 ml-2">Preview Content</p>
      </Flex>
      <Button
        onMouseEnter={() => setIsCrossHover(true)}
        onMouseLeave={() => setIsCrossHover(false)}
        className="!bg-white p-2 !border-none hover:!bg-danger !rounded-full"
        onClick={navigateToContent}
      >
        <CrossIcon width={16} height={16} color={isCrossHover ? "white" : "var(--color-gray-600)"} />
      </Button>
    </Flex>
  );
};

export default PreviewHeader;
