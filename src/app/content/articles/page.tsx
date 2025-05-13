"use client";
import { DeleteModal, Header } from "@/components/common";
import { PAGE_SIZE } from "@/constants";
import { ErrorToast } from "@/helpers/toast";
import DashboardLayout from "@/layouts/DashboardLayout";
import ArticleService from "@/services/articles";
import { Flex } from "antd";
import { debounce } from "lodash";
import dynamic from "next/dynamic";
import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "react-query";

const ContentPreviewHeader = dynamic(() => import("@/components/screens/Content/ContentPreviewHeader"), {
  ssr: false,
});
const ContentTable = dynamic(() => import("@/components/screens/Content/ContentTable"), {
  ssr: false,
});

const Page = () => {
  const [search, setSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(PAGE_SIZE);

  const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);
  const [articleId, setArticleId] = useState<string>();

  const {
    data,
    refetch,
    isLoading: isArticleLoading,
  } = useQuery(["articles", search, currentPage], () => ArticleService.fetchArticles(currentPage, 5, search), {
    onSuccess: (data: any) => {
      let { articles = [] } = data;
      if (!articles.length && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    },
  });
  let { articles = [], total_count = 0 } = data || {};

  const { mutate } = useMutation(() => ArticleService.delete(articleId || ""), {
    onSuccess: () => {
      setOpenDeleteModal(false);
      refetch();
    },
    onError: (error: any) => {
      ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred while Delete Article");
    },
  });

  const debounceFetchArticles = useMemo(() => {
    return debounce((value: string) => {
      setSearch(value); // Update search state
    }, 1000);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    debounceFetchArticles(event.target.value); // Debounce input changes
  };

  const handlePaginationChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleDeleteModalOpen = (articleId: string) => {
    setOpenDeleteModal(true);
    setArticleId(articleId);
  };

  const handleDeleteModalClose = () => {
    setOpenDeleteModal(false);
    setArticleId("");
  };

  return (
    <DashboardLayout
      header={
        <Header
          title={"Manage Your Articles"}
          description={"Create, edit, and organize your articles to empower your users with helpful information."}
        />
      }
    >
      <Flex className="w-full h-full" vertical gap={18}>
        <ContentPreviewHeader onSearch={handleInputChange} />
        <ContentTable
          handleDeleteModal={handleDeleteModalOpen}
          page={currentPage}
          handlePagination={handlePaginationChange}
          total={total_count}
          articles={articles}
          pageSize={pageSize}
          isLoading={isArticleLoading}
        />
      </Flex>
      <DeleteModal handleCancel={handleDeleteModalClose} open={openDeleteModal} onConfirm={mutate} />
    </DashboardLayout>
  );
};

export default Page;
