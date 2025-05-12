"use client";
import "@/styles/input.css";
import { Flex, Typography } from "antd";
import "react-quill/dist/quill.snow.css";
const { Text } = Typography;
const PreviewContent = (props: any) => {
  const { title, description, content_body } = props;
  return (
    <Flex className="w-full h-full overflow-auto flex flex-col p-8 mt-16">
      <Text className="font-helvetica-700 text-[2.2rem]">{title}</Text>
      <Text className="input font-helvetica-300 text-[1.3rem]" aria-placeholder="Description">
        {description || "No description available"}
      </Text>

      <div
        className="input font-helvetica-300 text-[1.3rem]"
        dangerouslySetInnerHTML={{ __html: content_body || "No content available" }}
      />
    </Flex>
  );
};

export default PreviewContent;
