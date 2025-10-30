import { Button } from "@/components/elements";
import Flex from "antd/es/flex";
import Image from "next/image";

const TransformSupport = () => {
  return (
    <Flex vertical align="center" justify="center" className=" relative bg-Black100 py-10 sm:py-32 ">
      {/* <div className="absolute top-[25%] left-[35%] w-full h-full max-w-[397px] max-h-[397px]">
        <div className="relative w-full h-full rounded-full">
          <div className="absolute inset-0 rounded-full bg-Primary1000 opacity-[50%] blur-[220px] border border-white z-10"></div>
          <Image src="./mask.svg" width={500} height={500} alt="Mask Image" className="absolute inset-0 w-full h-full z-20" />
        </div>
      </div> */}

      <Flex vertical align="center" className="mask-image w-auto max-w-[673px] " gap={12}>
        <Image src={"./logo-transform.svg"} width={145} height={155} alt="logo-transform" />
        <h1 className="text-white text-center text-[28px] sm:text-[36px] font-helvetica-700 leading-[49px]">
          Ready to Transform Your Support?
        </h1>
        <p className="text-white text-center font-helvetica text-sm leading-[23px]">
          Discover the power of AI-driven solutions with Hashbot. Join thousands of businesses already revolutionizing their customer
          service.
        </p>

        <Button className="w-[160px] h-[40px] !border-none">Start Your Free Trial</Button>
      </Flex>
    </Flex>
  );
};

export default TransformSupport;
