import CustomerRatingCard from "@/components/common/CustomerRatingCard";
import CustomerReviewCard from "@/components/common/CustomerReviewCard";
import { reviews } from "@/constants/home";
import { Col, Flex, Row } from "antd";

const OurCustomersSaying = () => {
  return (
    <Flex vertical className="my-10 gap-10 sm:gap-16 sm:my-28">
      <p className="text-center text-2xl sm:text-4xl font-helvetica-700">What Our Customers Are Saying</p>
      <Flex vertical gap={16} justify="center" align="center">
        <Row className="w-full" gutter={[16, 16]}>
          <Col sm={12} lg={6} className="w-full">
            <CustomerRatingCard rating="5X" label="Faster ticket resolution" message="HappyHelp" bg="#ECFFF5" />
          </Col>
          <Col sm={12} lg={6} className="w-full">
            <CustomerRatingCard rating="5X" label="Faster ticket resolution" message="HappyHelp" bg="#FFEDE3" />
          </Col>
          <Col sm={24} lg={12} className="w-full">
            <CustomerReviewCard
              profile={reviews[0].profile}
              name={reviews[0].name}
              designation={reviews[0].designation}
              message={reviews[0].message}
            />
          </Col>
        </Row>
        <Row className="w-full" gutter={[16, 16]}>
          <Col sm={24} lg={12} className="w-full">
            <CustomerReviewCard
              profile={reviews[1].profile}
              name={reviews[1].name}
              designation={reviews[1].designation}
              message={reviews[1].message}
            />
          </Col>
          <Col sm={12} lg={6} className="w-full">
            <CustomerRatingCard rating="5X" label="Faster ticket resolution" message="HappyHelp" bg="#ECFFF5" />
          </Col>
          <Col sm={12} lg={6} className="w-full">
            <CustomerRatingCard rating="5X" label="Faster ticket resolution" message="HappyHelp" bg="#FFEDE3" />
          </Col>
        </Row>
        <Row className="w-full" gutter={[16, 16]}>
          <Col sm={12} lg={6} className="w-full">
            <CustomerRatingCard rating="5X" label="Faster ticket resolution" message="HappyHelp" bg="#ECFFF5" />
          </Col>
          <Col sm={12} lg={6} className="w-full">
            <CustomerRatingCard rating="5X" label="Faster ticket resolution" message="HappyHelp" bg="#FFEDE3" />
          </Col>
          <Col sm={24} lg={12} className="w-full">
            <CustomerReviewCard
              profile={reviews[2].profile}
              name={reviews[2].name}
              designation={reviews[2].designation}
              message={reviews[2].message}
              isTheme={true}
            />
          </Col>
        </Row>
      </Flex>
    </Flex>
  );
};

export default OurCustomersSaying;
