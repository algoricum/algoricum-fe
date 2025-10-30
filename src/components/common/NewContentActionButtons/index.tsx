import { Button } from "@/components/elements";
import Flex from "antd/es/flex";
import { useRouter } from "next/navigation";

interface ContentHeaderProps {
  onFinishPublish: any;
  is_published: boolean;
}

const NewContentActionButtons = ({ is_published, onFinishPublish }: ContentHeaderProps) => {
  const { back } = useRouter();

  const navigateToContent = () => {
    back();
  };
  return (
    <Flex className="flex flex-row gap-2 xl:gap-3">
      <Button onClick={navigateToContent} className="!bg-Gray100 !text-Gray900 !border !border-Gray400">
        Cancel
      </Button>
      <Button htmlType="submit" className="!bg-white !text-Gray600 !border !border-Gray400">
        Save As Draft
      </Button>
      <Button onClick={onFinishPublish} className="">
        {is_published ? "Unpublish" : "Publish"}
      </Button>
    </Flex>
  );
};

export default NewContentActionButtons;
