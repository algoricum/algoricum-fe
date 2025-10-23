import PricingCard from "@/components/common/PricingCard";
import { pricingPlanData } from "@/constants/pricingPlanData";
import Col from "antd/es/col";
import Flex from "antd/es/flex";
import Row from "antd/es/row";

const Pricing = () => {
  return (
    <Flex vertical align="center" className="mt-10 sm:mt-28 gap-10 sm:gap-16">
      <Flex vertical align="center" className="text-center">
        <p className="text-2xl sm:text-4xl font-helvetica-700 text-Gray900">Simple and Transparent Pricing</p>
        <p className="text-sm text-Gray600">
          Choose a plan that fits your business needs and scale effortlessly with Hashbot`s AI-powered solutions.
        </p>
      </Flex>
      <Row className="w-full" gutter={[16, 16]}>
        {pricingPlanData.map((pricing, index) => (
          <Col sm={24} md={12} lg={8} key={index} className="w-full">
            <PricingCard icon={pricing.icon} title={pricing.title} subTitle={pricing.subTitle} features={pricing.features} />
          </Col>
        ))}
      </Row>
    </Flex>
  );
};

export default Pricing;
