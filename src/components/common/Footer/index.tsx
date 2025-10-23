import Footermenus from "@/constants/FooterMenus";
import { EmailIcon, FacebookIcon, LinkedinIcon, TwitterIcon } from "@/icons";
import Button from "antd/es/button";
import Flex from "antd/es/flex";
import Image from "next/image";
import Link from "next/link";
import React from "react";

const Footer = () => {
  interface SocialButtonProps {
    icon: React.ReactElement<any>; // Expecting a React element
    className?: string;
  }
  const SocialButton = ({ icon, className = "" }: SocialButtonProps) => (
    <Button className={`social-btn !border !border-Gray700 hover:!border-white  ${className}`} type="default" icon={icon} />
  );

  const SocialButtons = () => (
    <Flex gap={20}>
      <SocialButton icon={<LinkedinIcon color={"var(--color-gray-400)"} />} />
      <SocialButton icon={<TwitterIcon color={"var(--color-gray-400)"} />} />
      <SocialButton icon={<FacebookIcon color={"var(--color-gray-400)"} />} />
      <SocialButton icon={<EmailIcon color={"var(--color-gray-400)"} />} />
    </Flex>
  );

  const FooterMenuItems = ({ heading = "", menus = [] }: { heading: string; menus: any }) => {
    return (
      <Flex vertical gap={32} className="w-32">
        <h1 className="text-white font-helvetica-500 leading-[16px] text-[12px]">{heading}</h1>
        {menus.map((menu: any) => (
          <Link
            href="/"
            key={menu.key}
            className="text-Gray400 leading-[20px] font-helvetica text-[12px] hover:!text-white hover:!underline"
          >
            {menu?.label}
          </Link>
        ))}
      </Flex>
    );
  };

  return (
    <Flex gap={61} vertical className="w-auto bg-Gray900 border border-Gray700 py-10 sm:py-28 px-[40px] md:px-[144px]">
      <Flex justify="space-between" className="w-auto flex flex-wrap gap-5 md:gap-0  max-w-[1312px]">
        <Flex className="" vertical gap={12}>
          <Flex align="center" gap={12}>
            <Image
              width={40}
              height={40}
              src={"/logo.svg"}
              alt="Algoricum Logo"
              loading="lazy" // Footer loads later
            />
            <h1 className="font-helvetica-700 text-[20px] leading-[27px] text-white">Algoricum</h1>
          </Flex>
          <SocialButtons />
        </Flex>
        <FooterMenuItems heading="Documentation" menus={Footermenus?.getStarted} />
        <FooterMenuItems heading="Company" menus={Footermenus?.company} />
        <FooterMenuItems heading="Resources" menus={Footermenus?.resources} />
        <FooterMenuItems heading="Legal" menus={Footermenus?.legal} />
      </Flex>
      <Image
        alt="Algoricum Brand Background"
        width={1400}
        height={402}
        src={"/logo-2.svg"}
        style={{ width: "100%", height: "auto" }}
        loading="lazy" // Background image can load later
      />
    </Flex>
  );
};

export default Footer;
