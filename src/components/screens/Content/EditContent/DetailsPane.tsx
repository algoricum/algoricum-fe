"use client";
import KeyLabelItem from "@/components/common/KeyLabelItem";
import Select from "@/components/common/Select";
import { ErrorToast } from "@/helpers/toast";
import { CollapseIcon, PublicArticleIcon } from "@/icons";
import CrossIcon from "@/icons/CrossIcon";
import { Article } from "@/redux/models/article_model";
import { Section } from "@/redux/models/section_modal";
import SectionService from "@/services/section";
import { getTimeSinceCreation } from "@/utils/timeSinceCreation";
import { Button, Collapse, Flex, Form, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "react-query";
const { Text } = Typography;

interface Props {
  onClose?: () => void;
  article: Article | undefined;
}

const DetailsPane = ({ article, onClose }: Props) => {
  const [isCrossHover, setIsCrossHover] = useState(false);
  const { back } = useRouter();

  const transformSectionData = (data: { sections: Section[] }) => {
    const { sections } = data;
    const transformSection = sections.map((section: Section) => {
      return { value: section.id, label: section.title };
    });
    return transformSection;
  };

  const { data: sections } = useQuery(["sections"], SectionService.fetchSections, {
    select: transformSectionData,
    onError: (error: any) => {
      ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred while fetching Section");
    },
  });

  const handleNavigateContent = () => {
    back();
  };

  const DataSection = (
    <Flex vertical gap={16}>
      <KeyLabelItem keyValue="Type" label="Public article" icon={<PublicArticleIcon width={12} height={12} />} isBackground={true} />
      <KeyLabelItem keyValue="Status" label={article?.is_published ? "Published" : "Draft"} isBackground={true} />
      <KeyLabelItem keyValue="Language" label="English" />
      <KeyLabelItem keyValue="Created on" label="12-12-2024" />
      <KeyLabelItem keyValue="Last updated" label={getTimeSinceCreation(article?.updated_at || "")} />
    </Flex>
  );

  const FolderItems = (
    <Flex vertical gap={10}>
      <Flex justify="space-between">
        <Text>
          Reprehenderit earum quisquam ut at aut. Error nulla perspiciatis voluptas tenetur velit. Et maxime distinctio sit non totam
          aliquid.
        </Text>
      </Flex>
      <Form.Item name="section_id">
        <Select className="w-full" placeholder={"Select the Section"} optionFilterProp="label" options={sections} />
      </Form.Item>
    </Flex>
  );

  return (
    <Flex vertical className=" overflow-auto w-full min-h-screen  bg-white border border-Gray200">
      <Flex justify="space-between" align="center" className="min-h-16 px-2 border-b border-Gray400">
        <Flex
          justify="center"
          align="center"
          className={`bg-Black100 rounded-full absolute bottom-0 lg:hidden cursor-pointer rotate-180`}
          onClick={onClose}
        >
          {<CollapseIcon />}
        </Flex>
        <Text className="text-lg !font-helvetica-700">Details</Text>

        <Button
          onMouseEnter={() => setIsCrossHover(true)}
          onMouseLeave={() => setIsCrossHover(false)}
          className="!bg-white p-2 !border-none hover:!bg-danger !rounded-full"
          onClick={handleNavigateContent}
        >
          <CrossIcon width={16} height={16} color={isCrossHover ? "white" : "var(--color-gray-600)"} />
        </Button>
      </Flex>
      <Collapse
        ghost={true}
        size={"large"}
        className="w-full !p-0"
        expandIconPosition="end"
        items={[
          { key: "1", label: <p className="font-bold">Data</p>, children: DataSection },
          { key: "2", label: <p className="font-bold">Sections</p>, children: FolderItems },
        ]}
      />
    </Flex>
  );
};

export default DetailsPane;
