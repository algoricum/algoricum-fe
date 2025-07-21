"use client";
import { Header } from "@/components/screens/Home";

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
      <div className="flex justify-center h-screen items-center bg-green-200">Algoricum</div>
    </>
  );
}
