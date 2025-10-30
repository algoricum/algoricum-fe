import { Button } from "@/components/elements";
import { PlusIcon } from "@/icons";
import Flex from "antd/es/flex";
import Typography from "antd/es/typography";

const { Text } = Typography;
interface SetupHeaderProps {
  handleOpen: () => void;
}
const SetupHeader = ({ handleOpen }: SetupHeaderProps) => {
  return (
    <Flex justify="space-between" align="start">
      <Text className="text-sm  font-helvetica-700">Api Keys</Text>
      <Button onClick={handleOpen}>
        <PlusIcon color="white" />
        <span>Create new secret key</span>
      </Button>
    </Flex>
  );
};

export default SetupHeader;
