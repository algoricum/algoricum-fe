"use client";
import { BackgroundWrapper, Footer, TransformSupport } from "@/components/common";
import { Header } from "@/components/screens/Home";
import { ContentSection, PolicyPageDetails } from "@/components/screens/PrivacyPolicy";
import { Flex, Layout } from "antd";

const PrivacyPolicy = () => {
  return (
    <Layout className="flex flex-col bg-white">
      <BackgroundWrapper className="!h-[526px]">
        <Flex vertical className="z-10 px-[10px] md:px-[149px] h-full">
          <Header />
          <Flex vertical justify="center" align="center" className="h-full">
            <PolicyPageDetails />
          </Flex>
        </Flex>
      </BackgroundWrapper>
      <ContentSection />
      <TransformSupport />
      <Footer />
    </Layout>
  );
};

export default PrivacyPolicy;
