import { Flex } from "antd";
import Image from "next/image";

interface SocialButtonProps {
  isGoogle?: boolean;
  label: string;
  onClick?: () => void;
}

const SocialButton = ({ isGoogle, label,onClick }: SocialButtonProps) => {
  return (
    <Flex
      justify="center"
      align="center"
      gap={12}
      className="min-h-10 flex-1 w-full py-2 max-w-60 rounded-lg border bg-gray-50 hover:!bg-brand-primary text-black border-gray-200 hover:text-white cursor-pointer"
      onClick={onClick}
    >
      <Image src={isGoogle ? "/google-logo.svg" : "/apple-logo.svg"} width={16} height={16} alt="Logo" />
      <p className="text-sm font-Poppins cursor-pointer">{label}</p>
    </Flex>
  );
};

export default SocialButton;
