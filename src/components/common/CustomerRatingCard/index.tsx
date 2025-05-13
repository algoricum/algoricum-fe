import { Flex } from "antd";
import { FC } from "react";

interface Props {
  rating: string;
  label: string;
  message: string;
  bg: string;
}

const CustomerRatingCard: FC<Props> = ({ rating, label, message, bg }) => {
  return (
    <Flex
      vertical
      className="w-full p-6 aspect-square rounded-[18px] border border-Gray400"
      style={{
        background: bg,
      }}
    >
      <p className="text-4xl font-helvetica-700 text-Gray900">{rating}</p>
      <p className="text-sm text-Gray600">{label}</p>
      <p className="text-sm text-Gray900 mt-auto font-HennyPenny">{message}</p>
    </Flex>
  );
};

export default CustomerRatingCard;
