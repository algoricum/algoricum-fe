import HashbotWorkCard from "@/components/common/HashbotWorkCard";
import { Button } from "@/components/elements";
import { howHashbotWorksData } from "@/constants/home";
import Col from "antd/es/col";
import Flex from "antd/es/flex";
import Row from "antd/es/row";

const HowHashbotWorks = () => {
  return (
    <Flex vertical align="center" className="bg-black z-10">
      <Flex vertical align="center" className="relative py-8 sm:py-16 gap-16 px-3 md:px-5 sm:container">
        <div className="hashbot-blurred-circle" />
        <Flex gap={12} vertical align="center" className="max-w-[675px] text-center text-white">
          <p className="text-2xl sm:text-4xl font-helvetica-700">How Hashbot Works</p>
          <p className="text-sm">
            Algoricum is a comprehensive support management platform powered by advanced AI that transforms the way businesses handle
            customer support.
          </p>
          <Button className="border-none">Start Your Free Trial</Button>
        </Flex>
        <Row className="w-full" gutter={[16, 16]}>
          {howHashbotWorksData.map(({ title, subTitle }, index) => (
            <Col sm={24} md={12} lg={8} key={index} className="w-full">
              <HashbotWorkCard title={title} subTitle={subTitle} />
            </Col>
          ))}
        </Row>
      </Flex>
    </Flex>
  );
};

export default HowHashbotWorks;
