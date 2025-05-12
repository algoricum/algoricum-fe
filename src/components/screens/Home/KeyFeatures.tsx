import { keyFeatures } from "@/constants/home";
import KeyFeatureLayout from "@/layouts/KeyFeatureLayout";
import { Flex } from "antd";

const KeyFeatures = () => {
  return (
    <Flex className="flex flex-col gap-10 py-10 sm:gap-28 sm:py-28">
      {keyFeatures.map((feature, index) => (
        <KeyFeatureLayout key={index} {...feature} />
      ))}
    </Flex>
  );
};

export default KeyFeatures;
