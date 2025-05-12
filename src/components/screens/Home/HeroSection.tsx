import { Button } from "@/components/elements";
import { heroSectionTabs } from "@/constants/heroSectionTabs";
import { CheckIcon } from "@/icons";
import { Flex } from "antd";

const HeroSection = () => {
  return (
    <Flex align="center" className="flex flex-col gap-6 py-12 px-4 md:px-5">
      <Flex className="px-3 py-2 rounded-[4px] bg-white text-sm">AI-Powered Assistance, Seamless Support.</Flex>
      <p className="max-w-[800px] text-[54px] text-center font-helvetica-700 max-sm:text-2xl">
        Revolutionize Support Management with Algoricum
      </p>
      <p className="text-base text-center max-sm:text-xs">
        Empowered by AI to streamline support, create knowledge, and drive customer satisfaction.
      </p>
      <Flex gap={6} align="center" wrap="wrap" justify="center" className="sm:space-x-6 sm:space-y-6">
        {heroSectionTabs.map(({ icon, label }, index) => (
          <Flex align="center" gap={6} key={index} className="px-2 py-1 rounded-full bg-white cursor-pointer">
            {icon}
            <p className="text-sm">{label}</p>
          </Flex>
        ))}
      </Flex>
      <Flex gap={12}>
        <Button>Get Started Now</Button>
        <Button light>View Demo</Button>
      </Flex>
      <Flex align="center" className="flex flex-row gap-9">
        <Flex align="center" className="flex flex-row gap-3">
          <CheckIcon color="black" />
          <p className="text-sm">free 14-days trials</p>
        </Flex>
        <Flex align="center" className="flex flex-row gap-3">
          <CheckIcon color="black" />
          <p className="text-sm">No credit card required</p>
        </Flex>
      </Flex>
      <Flex justify="center" className="w-full px-3 relative">
        <div
          className="w-full max-w-[1200px] h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] z-10"
          style={{
            backgroundImage: `url("/home-main-image.png")`,
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            width: "100%",
          }}
        />
        <div className="hidden md:block custom-blurred-circle-left" />
        <div className="hidden md:block custom-blurred-circle-right" />
      </Flex>
    </Flex>
  );
};

export default HeroSection;
