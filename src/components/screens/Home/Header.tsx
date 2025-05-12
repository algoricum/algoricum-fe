import { Logo } from "@/components/common";
import { Button } from "@/components/elements";
import { headerLinks } from "@/constants";
import { BurgerIcon } from "@/icons";
import { Dropdown, Flex, MenuProps } from "antd";
import Link from "next/link";

const Header = () => {
  const mobileMenu: MenuProps["items"] = [
    ...headerLinks.map(({ label, href }, index) => ({
      key: index,
      label: (
        <Link href={href} className="text-sm text-Gray600 hover:!text-Primary1000">
          {label}
        </Link>
      ),
    })),
    {
      type: "divider",
    },
    ...[
      {
        key: "login",
        label: (
          <Link href="login">
            <Button outline className="w-full">
              Log in
            </Button>
          </Link>
        ),
      },
      {
        key: "signup",
        label: (
          <Link href="signup">
            <Button>Try for Free</Button>
          </Link>
        ),
      },
    ],
  ];

  return (
    <Flex justify="space-between" align="center" className="mt-5 p-2 rounded-lg bg-white">
      <Logo />
      <Flex align="center" gap={32} className="max-md:hidden">
        {headerLinks.map(({ label, href }, index) => (
          <Link key={index} href={href} className="text-sm text-Gray600 hover:!text-Primary1000">
            {label}
          </Link>
        ))}
      </Flex>
      <Flex align="center" gap={12} className="max-md:hidden">
        <Link href="login">
          <Button outline>Log in</Button>
        </Link>
        <Link href="signup">
          <Button>Try for Free</Button>
        </Link>
      </Flex>
      <Dropdown
        menu={{
          items: mobileMenu,
        }}
      >
        <Flex className="bg-Primary50 rounded-full w-8 h-8 md:hidden" justify="center" align="center">
          <BurgerIcon />
        </Flex>
      </Dropdown>
    </Flex>
  );
};

export default Header;
