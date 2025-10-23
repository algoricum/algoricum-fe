import Flex from "antd/es/flex";

const StreamlineYourSupport = () => {
  return (
    <Flex vertical align="center" className="flex flex-col gap-5 sm:gap-14 relative bg-black py-10 md:py-16 px-4 sm:px-0">
      <div className="top-custom-blurred-circle" />
      <Flex vertical gap={12} className="max-w-[673px] text-white text-center z-10">
        <p className="text-2xl sm:text-4xl font-helvetica-700">Streamline Your Support with AI-Powered Efficiency</p>
        <p className="text-sm">
          HashBot is a comprehensive support management platform powered by advanced AI that transforms the way businesses handle customer
          support.
        </p>
      </Flex>

      <div
        className="w-full max-w-[1300px] h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px]"
        style={{
          backgroundImage: `url("/streamline-main-image.png")`,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          width: "100%",
        }}
      />

      <div
        className="w-full max-w-[1000px] h-7 min-[500px]:h-[100px]"
        style={{
          backgroundImage: `url("/streamline-bottom-image.png")`,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          width: "100%",
        }}
      />
    </Flex>
  );
};

export default StreamlineYourSupport;
