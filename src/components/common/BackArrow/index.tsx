"use client";
import { BackArrowIcon } from "@/icons";
import Flex from "antd/es/flex";
import { useRouter } from "next/navigation";

const BackArrow = () => {
  const router = useRouter();

  return (
    <Flex
      justify="center"
      align="center"
      className="w-10 h-10 rounded-xl bg-Gray200 cursor-pointer flex md:hidden"
      onClick={() => router.back()}
    >
      <BackArrowIcon />
    </Flex>
  );
};

export default BackArrow;
