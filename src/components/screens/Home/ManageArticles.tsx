import { Flex } from "antd";
import Image from "next/image";

const ManageArticles = () => {
  return (
    <Flex className="2xl:container">
      <Flex className="w-full h-[800px]">
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <Image alt="Home" src="/home-main-image.png" className="rounded-lg" layout="fill" />
        </div>
      </Flex>
    </Flex>
  );
};

export default ManageArticles;
