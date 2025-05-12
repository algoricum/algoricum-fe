import NewContentActionButtons from "@/components/common/NewContentActionButtons";
import { CollapseIcon } from "@/icons";
import { Flex } from "antd";

interface ContentHeaderProps {
  onFinishPublish: any;
  showDrawer: () => void;
  is_published: boolean;
}

const ContentHeader = ({ is_published, onFinishPublish, showDrawer }: ContentHeaderProps) => {
  return (
    <Flex className="w-full bg-white px-4 py-3 border-b border-Gray400" justify="space-between" align="center">
      <Flex vertical>
        <p className="text-xl xl:text-header text-Gray900 font-helvetica-700">Create New Content</p>
      </Flex>

      <Flex className="hidden lg:flex">
        <NewContentActionButtons is_published={is_published} onFinishPublish={onFinishPublish} />
      </Flex>

      <Flex
        justify="center"
        align="center"
        className={`bg-Black100 rounded-full absolute right-0 lg:hidden cursor-pointer`}
        onClick={showDrawer}
      >
        {<CollapseIcon />}
      </Flex>
    </Flex>
  );
};

export default ContentHeader;
