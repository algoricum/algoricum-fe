import { InformationList } from "@/components/common";
import { InformationListingData, InformationListingDataRights } from "@/constants";
import { Divider, Flex } from "antd";
const ContentSection = () => {
  const Title = ({ title }: { title: string }) => (
    <h1 className="text-Gray900 text-[28px] sm:text-[36px] font-helvetica-700 leading-[49px]">{title}</h1>
  );
  const SubText = ({ boldText, text }: { boldText?: string; text?: string }) => (
    <Flex gap={10}>
      {boldText && <p className="text-sm font-helvetica-500  leading-[23px] text-Gray900">{boldText}</p>}
      {text && <p className="text-Gray700 text-sm font-helvetica leading-[23px] ">{text}</p>}
    </Flex>
  );

  return (
    <Flex vertical gap={64} className="px-[14px] md:px-[144px]  mt-20 ">
      {/* Introduction */}
      <Flex vertical>
        <Flex vertical>
          <Title title="Introduction" />
          <SubText
            text={`At Hashbot, we value your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect,
          use, share, and safeguard your information when you use our platform.`}
          />
        </Flex>
        <Divider />
      </Flex>
      {/* What Information We Collect */}
      <Flex vertical>
        <Flex vertical gap={18}>
          <Title title="What Information We Collect" />
          <SubText
            boldText="Personal Information"
            text={`Your name, email address, contact information, and account credentials when you sign up.`}
          />
          <SubText
            boldText="Usage Data"
            text={`Details of how you interact with Hashbot, including IP address, device information, and browser type.`}
          />
          <SubText boldText="Support Content" text={`Messages, queries, or articles submitted via the Help Center.`} />
        </Flex>
        <Divider />
      </Flex>
      {/* How We Use Your Information */}
      <Flex vertical>
        <Flex vertical gap={18}>
          <Title title="How We Use Your Information" />
          <SubText boldText="We use the collected data to" />
          <InformationList data={InformationListingData} />
        </Flex>
        <Divider />
      </Flex>

      {/* Sharing Information */}
      <Flex vertical>
        <Flex vertical gap={18}>
          <Title title="Sharing Your Information" />
          <SubText text="We do not sell your personal data. However, we may share information with" />
          <SubText
            boldText="Service Providers"
            text={`Third-party partners who help us deliver our services (e.g., cloud storage providers).`}
          />
          <SubText boldText="Legal Authorities" text={`When required by law to comply with legal obligations.`} />
          <SubText boldText="Analytics Providers" text={`For analyzing platform usage and improving performance.`} />
        </Flex>
        <Divider />
      </Flex>

      {/* Sharing Information */}
      <Flex vertical>
        <Flex vertical gap={18}>
          <Title title="Your Data Rights" />
          <SubText boldText="You have the right to:" />
          <InformationList className="ml-2" listStyle="circle" data={InformationListingDataRights} />
          <SubText text="To exercise your rights, contact us at privacy@hashbot.com." />
        </Flex>
        <Divider />
      </Flex>

      <Flex vertical>
        <Flex vertical gap={18}>
          <Title title="Data Security" />
          <SubText text="We use encryption, secure servers, and regular audits to protect your data. While we strive to safeguard your information, no system is 100% secure, and we recommend safeguarding your credentials." />
        </Flex>
        <Divider />
      </Flex>
    </Flex>
  );
};

export default ContentSection;
