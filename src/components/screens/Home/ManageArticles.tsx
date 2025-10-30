import Flex from "antd/es/flex";
import Image from "next/image";

const ManageArticles = () => {
  return (
    <Flex className="2xl:container">
      <Flex className="w-full h-[800px]">
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <Image
            alt="Algoricum Healthcare Management Platform"
            src="/home-main-image.png"
            className="rounded-lg"
            fill
            style={{ objectFit: "cover" }}
            priority // Hero image should load first
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
          />
        </div>
      </Flex>
    </Flex>
  );
};

export default ManageArticles;
