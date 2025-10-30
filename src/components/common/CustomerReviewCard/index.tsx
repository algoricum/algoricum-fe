import Flex from "antd/es/flex";
import Image from "next/image";
import { FC } from "react";

interface Props {
  profile: string;
  name: string;
  designation: string;
  message: string;
  isTheme?: boolean;
}

const CustomerReviewCard: FC<Props> = ({ profile, name, designation, message, isTheme = false }) => {
  return (
    <Flex
      vertical
      gap={16}
      justify="space-between"
      className={`w-full p-6 h-full rounded-[18px] ${!isTheme ? "border border-Gray400 bg-Gray50" : "border border-Primary1000"}`}
    >
      <p className={`md:text-2xl lg:text-[28px] ${!isTheme ? "text-Gray900" : "text-Primary1000"}`}>{message}</p>

      <Flex gap={16}>
        <Image src={profile} alt="Profile" width={42} height={42} className="rounded-md" />
        <Flex vertical justify="center">
          <p className="text-sm text-Gray900">{name}</p>
          <p className="text-sm text-Gray600">{designation}</p>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default CustomerReviewCard;
