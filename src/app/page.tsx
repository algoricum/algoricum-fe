"use client";
import { BackgroundWrapper, Footer, TransformSupport } from "@/components/common";
import {
  Header,
  HeroSection,
  HowHashbotWorks,
  KeyFeatures,
  OurCustomersSaying,
  Pricing,
  StreamlineYourSupport,
  TrustedLeaders,
} from "@/components/screens/Home";
import { Flex } from "antd";

const styles = "z-10 px-3 md:px-5 sm:container";

export default function Home() {
  return (
    // <BackgroundWrapper>
    //   <Flex vertical className={styles}>
    //   </Flex>
    //   <HeroSection />
    //   <TrustedLeaders />
    //   <StreamlineYourSupport />
    //   <Flex vertical className={styles}>
    //     <KeyFeatures />
    //   </Flex>
    //   <HowHashbotWorks />
    //   <Flex vertical className={styles}>
    //     <Pricing />
    //     <OurCustomersSaying />
    //   </Flex>
    //   <TransformSupport />
    //   <Footer />
    // </BackgroundWrapper>
    <>
      <Header />
    <div className="flex justify-center h-screen items-center bg-green-200">
      Algoricum
    </div>
    </>
  );
}
