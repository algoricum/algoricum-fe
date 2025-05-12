"use client";
import { Table } from "@/components/elements";
import { actionMenu } from "@/constants/actionMenu";
import ActionIcon from "@/icons/ActionIcon";
import formatDateToDayMonthYear from "@/utils/formatDate";
import type { TableProps } from "antd";
import { Dropdown } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

interface ContentTableProps {
  articles: any;
  total: any;
  page: number;
  // eslint-disable-next-line no-unused-vars
  handleDeleteModal: (articleId: string) => void;
  // eslint-disable-next-line no-unused-vars
  handlePagination: (page: number) => void;
  pageSize: number;
  isLoading: boolean;
}

const ContentTable: React.FC<ContentTableProps> = ({ pageSize, handleDeleteModal, articles, total, page, handlePagination, isLoading }) => {
  const { push } = useRouter();
  const columns: TableProps["columns"] = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text, record) => (
        <Link className="hover:!text-Primary1000" href={`/content/articles/${record?.id}`}>
          {text}
        </Link>
      ),
    },
    {
      title: "Section",
      dataIndex: ["section", "title"],
      key: "section",
      render: section => (section == null ? "NA" : section),
    },
    {
      title: "Status",
      dataIndex: "is_published",
      key: "is_published",
      render: is_published => (is_published == false ? "draft" : "published"),
    },
    {
      title: "Last updated at",
      dataIndex: "updated_at",
      key: "updated_at",
      render: updated_at => formatDateToDayMonthYear(updated_at),
    },
    {
      title: "Action",
      dataIndex: "id",
      key: "id",
      render: (id: string) => (
        <Dropdown trigger={["click"]} menu={{ items: actionMenu, onClick: (event: any) => actionHandler(event, id) }}>
          <div className="cursor-pointer">
            <ActionIcon width={16} height={16} />
          </div>
        </Dropdown>
      ),
    },
  ];

  const actionHandler = (event: any, id: string) => {
    if (event?.key == "edit-btn") {
      push(`/content/articles/${id}/edit`);
    } else {
      handleDeleteModal(id);
    }
  };

  return (
    <div className="bg-white h-full rounded-xl">
      <Table
        pagination={{
          defaultPageSize: pageSize,
          pageSize: pageSize,
          current: page,
          total: total,
          onChange: (page: number) => handlePagination(page),
        }}
        loading={isLoading}
        dataSource={articles}
        columns={columns}
      />
    </div>
  );
};
export default ContentTable;
