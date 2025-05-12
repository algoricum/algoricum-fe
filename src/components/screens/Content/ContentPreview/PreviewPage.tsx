import Loading from "@/app/loading";
import { ErrorToast } from "@/helpers/toast";
import ArticleService from "@/services/articles";
import { Flex, Form } from "antd";
import { useParams } from "next/navigation";
import { useQuery } from "react-query";
import ContentPreview from "./PreviewContent";
import PreviewHeader from "./PreviewHeader";

const PreviewPage = () => {
  const [form] = Form.useForm();
  const { id: articleId } = useParams<{ id: string }>();

  const tranformArticle = (article: any) => {
    const transformData = {
      title: article?.title,
      description: article?.description,
      content_body: article?.content_body,
      section_id: article?.section_id,
    };
    return transformData;
  };

  const { data: article, isLoading } = useQuery(["article", articleId], () => ArticleService.fetchArticle(articleId), {
    select: tranformArticle,
    onError: (error: any) => {
      ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred while Fetching Article");
    },
  });

  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      <Form form={form} name="PreviewContentForm" className="w-full min-h-screen flex flex-row">
        <Flex vertical className="w-full">
          <PreviewHeader />
          <ContentPreview {...article} />
        </Flex>
      </Form>
    </>
  );
};

export default PreviewPage;
