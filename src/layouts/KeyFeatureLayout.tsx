import { Button } from "@/components/elements";
import { ChatIcon } from "@/icons";
import { KeyFeaturesProps } from "@/interfaces/keyFeaturesProps";
import { Flex, Image } from "antd";
import { FC } from "react";

const KeyFeatureLayout: FC<KeyFeaturesProps> = ({ label, title, subTitle, image, keyBenefits }) => {
  return (
    <Flex className="flex flex-col md:flex-row justify-between gap-5 p-6 max-sm:p-3 rounded-[18px] border border-Gray400 bg-Gray50">
      <Flex vertical className="w-full md:w-1/2 space-y-3 sm:space-y-[22px]">
        <Flex justify="center" align="center" className="max-w-fit mb-1 rounded-[4px] px-3 py-1 bg-white">
          <p className="text-sm text-Primary1000 font-helvetica-500">{label}</p>
        </Flex>
        <p className="max-w-[600px] text-2xl sm:text-4xl font-helvetica-700 text-Gray900">{title}</p>
        <p className="text-sm text-Gray600">{subTitle}</p>
        <p className="text-base font-helvetica-700 text-Gray900">Key Benefits</p>
        <Flex vertical className="space-y-3 sm:space-y-[22px]">
          {keyBenefits.map((feature, index) => (
            <Flex gap={12} align="center" key={index}>
              <Flex justify="center" align="center" className="min-w-9 min-h-9 rounded-full border border-Gray400">
                <ChatIcon width={12} height={12} color="var(--color-primary-1000)" />
              </Flex>
              <Flex vertical justify="center">
                <p className="text-sm font-helvetica-700 text-Gray900">{feature.title}</p>
                <p className="text-sm text-Gray600">{feature.subTitle}</p>
              </Flex>
            </Flex>
          ))}
        </Flex>
        <Button className="max-w-fit">Learn More</Button>
      </Flex>
      <Flex justify="center" align="center" className="w-full md:w-1/2">
        <Image preview={false} width={"100%"} className="rounded-[18px]" src={image} alt="" />
      </Flex>
    </Flex>
  );
};

export default KeyFeatureLayout;
