import { Button } from "@/components/elements";
import { FolderIcon } from "@/icons";
import { Flex, Typography } from "antd";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const { Text } = Typography;

interface SectionPreviewProps {
  handleOpen: () => void;
}

const SectionPreviewHeader: React.FC<SectionPreviewProps> = ({ handleOpen }) => {
  const [isHover, setIsHover] = useState({ sectionHover: false, articleHover: false });
  const { push } = useRouter();

  const handleNavigateArticles = () => {
    push("/content/articles");
  };
  return (
    <Flex justify="space-between" align="center" className="w-full max-sm:flex-wrap" gap={8}>
      <Text className="text-sm font-helvetica-700">Configure & Style Your Help Center</Text>
      <Flex gap={10}>
        <Button
          onMouseEnter={() => setIsHover(state => ({ ...state, sectionHover: true }))}
          onMouseLeave={() => setIsHover(state => ({ ...state, sectionHover: false }))}
          onClick={handleOpen}
          className="group font-helvetica-700 !bg-white"
        >
          <span>
            <FolderIcon color={isHover.sectionHover ? "white" : "var(--color-gray-900)"} width={12} height={10} />
          </span>
          <Text className="text-sm group-hover:text-white">New Section</Text>
        </Button>
        <Button
          onMouseEnter={() => setIsHover(state => ({ ...state, articleHover: true }))}
          onMouseLeave={() => setIsHover(state => ({ ...state, articleHover: false }))}
          onClick={handleNavigateArticles}
          className="group font-helvetica-700 bg-white !text-Gray900 border-none"
        >
          <span>
            <FolderIcon color={isHover.articleHover ? "white" : "var(--color-gray-900)"} width={12} height={10} />
          </span>
          <Text className="text-sm  group-hover:text-white">View All Articles</Text>
        </Button>
      </Flex>
      {/* <Flex gap={5}>
        <Button>Live</Button>
        <Button>Preview</Button>
        <Button>
          <span>
            <SettingIcon color="white" />
          </span>
          <span>Configure & style</span>
        </Button>
      </Flex> */}
    </Flex>
  );
};

export default SectionPreviewHeader;
