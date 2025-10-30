import { industriesLogos } from "@/constants/industriesLogos";
import Flex from "antd/es/flex";
import Image from "next/image";
import { useState } from "react";
import Slider from "react-infinite-logo-slider";

const menus = ["Overview", "Features", "Benefits", "Pricing", "Testimonials", "FAQs"];

const TrustedLeaders = () => {
  const [selectedMenu, setSelectedMenu] = useState<string>("Overview");

  return (
    <Flex vertical className="w-full py-10 md:py-[100px]">
      <p className="text-xs text-Gray600 text-center pb-6">Trusted by industry leaders</p>
      <Slider width="75px" duration={40} pauseOnHover={true} blurBorders={false}>
        {industriesLogos.map((logo, index) => (
          <Slider.Slide key={index}>
            <Image src={logo} alt="Industry Logo" width={30} height={30} />
          </Slider.Slide>
        ))}
      </Slider>
      <Flex className="flex flex-row justify-start sm:justify-center items-center flex-wrap gap-3 sm:gap-5 p-3 bg-Gray100 mt-10 md:mt-[100px]">
        {menus.map((menu, index) => (
          <p
            key={index}
            className={`text-xs sm:text-sm cursor-pointer ${selectedMenu === menu ? "text-Gray900" : "text-Gray700"}`}
            onClick={() => setSelectedMenu(menu)}
          >
            {menu}
          </p>
        ))}
      </Flex>
    </Flex>
  );
};

export default TrustedLeaders;
