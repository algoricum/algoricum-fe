import Flex from "antd/es/flex";

const PolicyPageDetails = () => {
  return (
    <Flex vertical align="center" gap={24}>
      <h1 className="font-helvetica-700 text-[28px] md:text-[53px]  leading-[56px] !m-0">Hashbot Policy Page</h1>
      <Flex gap={24}>
        <p className="text-[17px] font-helvetica leading-[24px]">Effective Date</p>
        <p className="text-[17px] font-helvetica leading-[24px]">12-12-2024</p>
      </Flex>
    </Flex>
  );
};

export default PolicyPageDetails;
