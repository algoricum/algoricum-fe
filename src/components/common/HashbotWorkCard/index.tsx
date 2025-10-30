import { ChatIcon } from "@/icons";
import Flex from "antd/es/flex";
import { FC } from "react";

interface Props {
  title: string;
  subTitle: string;
}

const HashbotWorkCard: FC<Props> = ({ title, subTitle }) => {
  return (
    <Flex vertical className="relative overflow-hidden text-white pt-[170px] border border-Gray700 rounded-2xl p-4 z-10">
      {/* Outer Circle */}
      <div className="flex justify-center items-center w-24 h-24 absolute -left-[13px] -top-[13px]">
        <div className="w-full h-full rounded-full border border-Gray700 bg-white opacity-5 z-10 " />
        <div className="absolute z-20">
          <Flex justify="center" align="center" className="w-11 h-11 rounded-full bg-Primary1000">
            <ChatIcon color="white" />
          </Flex>
        </div>
      </div>

      {/* Background Circle */}
      <div className="w-[214px] h-[214px] absolute -left-[65px] -top-[65px] rounded-full border border-Gray700 opacity-5 bg-white" />

      <Flex vertical gap={16}>
        <p className="text-xl font-helvetica-700">{title}</p>
        <p className="text-sm max-w-[360px] text-Gray300">{subTitle}</p>
      </Flex>
      <div className="hashbot-work-card-blurred-circle" />
    </Flex>
  );
};

export default HashbotWorkCard;
