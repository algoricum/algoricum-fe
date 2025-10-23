import { Flex } from "antd";
import Image from "next/image";
import Link from "next/link";
import BackArrow from "../BackArrow";
interface Props {
  isSidebar?: boolean;
  isCollapsed?: boolean;
  isBack?: boolean;
  textColor?: string;
}

const Logo = ({ isSidebar = false, isCollapsed = false, isBack = false, textColor = "black" }: Props) => {
  return (
    <Link href="/" className="w-fit flex">
      <Flex align="center" gap={10}>
        {isBack && <BackArrow />}
        <Flex gap={12} align="center" className="max-sm:!gap-2">
          <Image
            src={"/logo.svg"}
            width={40}
            height={40}
            alt="Algoricum Logo"
            priority // This logo appears above the fold
          />
          {!isCollapsed && (
            <p className={`${isSidebar ? "text-xl" : "text-[28px]"} max-sm:text-xl font-helvetica-700 text-Gray900 text-${textColor}`}>
              Algoricum
            </p>
          )}{" "}
        </Flex>
      </Flex>
    </Link>
  );
};

export default Logo;
