import { Flex } from "antd";

const AuthSeparator = () => {
  return (
    <Flex justify="space-between" align="center" gap={8} className="w-full">
      <div className="flex-1 w-full h-[1px] bg-[#D9D9D9]" />
      <p className="text-sm font-normal text-Gray600">or</p>
      <div className="flex-1 w-full h-[1px] bg-[#D9D9D9]" />
    </Flex>
  );
};

export default AuthSeparator;
