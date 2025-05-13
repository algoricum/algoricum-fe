"use client";
import { TextArea } from "@/components/common";
import "@/styles/input.css";
import { Flex, Form, Input } from "antd";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const ContentForm = () => {
  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ["bold", "italic", "underline", "strike", "blockquote"],
      [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
      ["link", "image", "video"],
      ["clean"],
    ],
  };
  return (
    <Flex className="w-full h-full flex flex-col p-8 max-sm:p-4 bg-Gray100" gap={24}>
      <Flex gap={6} vertical>
        <Form.Item name="title">
          <Input className="input font-helvetica-700 text-[2.2rem]" placeholder="Enter the title of your article" autoFocus />
        </Form.Item>
        <Form.Item name="description">
          <TextArea
            autoSize={{ maxRows: 5, minRows: 1 }}
            placeholder="Enter a short description of your article"
            className="input font-helvetica-300 text-[1.3rem]"
          />
        </Form.Item>
      </Flex>
      <Form.Item name="content_body">
        <ReactQuill
          theme="snow"
          placeholder="Start Writing...."
          modules={modules}
          formats={["header", "bold", "italic", "underline", "strike", "blockquote", "list", "bullet", "indent", "link", "image"]}
        />
      </Form.Item>
    </Flex>
  );
};

export default ContentForm;
