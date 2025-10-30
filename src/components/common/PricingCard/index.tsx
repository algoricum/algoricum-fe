import { Button } from "@/components/elements";
import { CheckIcon } from "@/icons";
import Flex from "antd/es/flex";
import { FC } from "react";

interface PricingProps {
  icon: any;
  title: string;
  subTitle: string;
  features: string[];
}

const PricingCard: FC<PricingProps> = ({ icon, title, subTitle, features }) => {
  return (
    <Flex vertical className="p-4 gap-4 rounded-2xl border border-Gray400 bg-Gray50">
      <Flex justify="center" align="center" className="w-10 h-10 rounded-lg bg-white">
        {icon}
      </Flex>
      <p className="text-xl font-helvetica-700 text-Gray900">{title}</p>
      <p className="text-sm text-Gray700">{subTitle}</p>
      <p className="text-[28px] font-helvetica-700 flex flex-row items-center">
        Free <span className="text-sm font-helvetica py-auto ml-2 text-Gray600">Monthly</span>
      </p>
      <Button>Get Started for Free</Button>
      <p className="text-sm font-helvetica-700 text-Gray900">Features:</p>
      <Flex vertical gap={16}>
        {features.map((feature, index) => (
          <Flex key={index} align="center" gap={16}>
            <Flex justify="center" align="center" className="min-w-6 min-h-6 rounded-full border border-Primary300">
              <CheckIcon color="#4C2EEB" />
            </Flex>
            <p>{feature}</p>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
};

export default PricingCard;
