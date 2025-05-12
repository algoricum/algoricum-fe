import Loading from "@/app/loading";
import NewContentActionButtons from "@/components/common/NewContentActionButtons";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { Article } from "@/redux/models/article_model";
import ArticleService from "@/services/articles";
import { Drawer, Flex, Form } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "react-query";
import ContentForm from "./ContentForm";
import ContentHeader from "./ContentHeader";
import DetailsPane from "./DetailsPane";

const EditContentPage = () => {
  const [form] = Form.useForm();
  const { back } = useRouter();
  const { id: articleId } = useParams<{ id: string }>();
  const [open, setOpen] = useState(window.innerWidth <= 1024);

  const tranformArticle = (article: Article) => {
    const transformData = {
      id: article?.id,
      title: article?.title,
      description: article?.description,
      content_body: article?.content_body,
      section_id: article?.section_id,
      updated_at: article?.updated_at,
      is_published: article?.is_published,
    };
    return transformData;
  };

  const {
    data: article,
    refetch: articleRefech,
    isLoading,
  } = useQuery(["article", articleId], () => ArticleService.fetchArticle(articleId), {
    select: tranformArticle,
    onError: (error: any) => {
      ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred while Fetching Article");
    },
  });

  const { mutate } = useMutation("editArticle", (data: Article & { is_draft: boolean }) => ArticleService.editArticle(data, articleId), {
    onSuccess: (data, variables) => {
      if (variables?.is_published) {
        SuccessToast("Content Published  Successfully");
        back();
      } else if (variables?.is_draft) {
        SuccessToast("Content Move to Draft");
      } else {
        SuccessToast("Content Unpublished  Successfully");
      }
      articleRefech();
    },
    onError: (error: any) => {
      ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred while Editing Content");
    },
  });

  const onFinish = (values: any) => {
    mutate({ ...values, is_draft: true });
  };

  const onFinishPublish = () => {
    const values = form.getFieldsValue();
    if (article?.is_published) {
      mutate({ ...values, is_published: false });
    } else {
      mutate({ ...values, is_published: true });
    }
  };

  const showDrawer = () => {
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      <Form
        form={form}
        name="EditContentForm"
        className="relative w-full min-h-screen flex flex-row"
        initialValues={article}
        onFinish={onFinish}
      >
        <Flex vertical className="w-full">
          <ContentHeader is_published={article!?.is_published} onFinishPublish={onFinishPublish} showDrawer={showDrawer} />
          <Flex justify="flex-end" gap={12} className="px-4 py-3 lg:hidden">
            <NewContentActionButtons is_published={article!?.is_published} onFinishPublish={onFinishPublish} />
          </Flex>
          <ContentForm />
        </Flex>
        <Flex className="w-full hidden lg:block lg:max-w-[280px] xl:max-w-[340px]" justify="space-between">
          <DetailsPane article={article} />
        </Flex>
        <Flex className="hidden">
          <Drawer
            title="Details"
            placement={"right"}
            width={window.innerWidth <= 600 ? 300 : 340}
            onClose={onClose}
            open={open}
            className="content-drawer"
          >
            <DetailsPane article={article} onClose={onClose} />
          </Drawer>
        </Flex>
      </Form>
    </>
  );
};

export default EditContentPage;
