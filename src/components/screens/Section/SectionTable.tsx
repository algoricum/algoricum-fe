import { actionMenu } from "@/constants/actionMenu";
import { ChervonIcon, DownArrowIcon, EllipsisIcon, FolderIcon } from "@/icons";
import { Section } from "@/redux/models/section_modal";
import formatDateToDayMonthYear from "@/utils/formatDate";
import type { TableColumnsType } from "antd";
import { Dropdown, Flex, Table, Typography } from "antd";
import Link from "next/link";
import React from "react";

const { Text } = Typography;

const expandedRowRender = (record: Section) => {
  const articles = record.articles || [];
  return <Table columns={expandedColumns} dataSource={articles} pagination={false} />;
};

interface SectionTableProps {
  data: any;
  handleSectionModals: any;
  currentPage: number;
  total: number;
  // eslint-disable-next-line no-unused-vars
  handlePagination: (page: number) => void;
  pageSize: number;
}
const expandedColumns: TableColumnsType = [
  {
    title: "Article Name",
    dataIndex: "title",
    key: "title",
    render: (text, record) => (
      <Link className="hover:!text-Primary1000" href={`/content/articles/${record?.id}`}>
        {text}
      </Link>
    ),
  },
  {
    title: "Status",
    dataIndex: "is_published",
    key: "is_published",
    render: (is_published: boolean) => (
      <Flex>
        <Text>{is_published ? "Published" : "Draft"}</Text>
      </Flex>
    ),
  },
  {
    title: "updated_at",
    dataIndex: "updated_at",
    key: "updated_at",
    render: updated_at => <Text>{formatDateToDayMonthYear(updated_at)}</Text>,
  },
];
const SectionTable: React.FC<SectionTableProps> = ({ pageSize, handlePagination, total, data, handleSectionModals, currentPage }) => {
  const actionHandler = (event: any, record: Section) => {
    handleSectionModals(event, record);
  };

  const columns: TableColumnsType<Section> = [
    {
      title: "Section name",
      dataIndex: "title",
      key: "title",
      render: title => (
        <Flex align="center" gap={8}>
          <span className="py-2 !bg-Gray200 p-2 rounded-lg">
            <FolderIcon width={15.6} color="var(--color-gray-600)" />
          </span>
          <Text className=" text-sm font-helvetica-500 text-Gray900">{title}</Text>
        </Flex>
      ),
    },
    { title: "Articles", dataIndex: "articles", key: "articles", render: articles => (articles ? articles?.length : 0) },
    {
      title: <EllipsisIcon />,
      dataIndex: "id",
      key: "id",
      render: (_, record) => (
        <Dropdown trigger={["click"]} menu={{ items: actionMenu, onClick: event => actionHandler(event, record) }}>
          <div className="cursor-pointer">
            <EllipsisIcon width={13} height={13} color="var(--color-gray-600)" />
          </div>
        </Dropdown>
      ),
    },
  ];

  return (
    <div className="bg-white h-full rounded-xl">
      <Table<Section>
        className=" !bg-white custom-table-section overflow-auto rounded-xl"
        columns={columns}
        expandable={{
          expandedRowRender,
          expandIcon: ({ expanded, onExpand, record }) =>
            record?.articles && record?.articles?.length > 0 ? ( // Conditionally render the icon
              expanded ? (
                <span className="cursor-pointer" onClick={e => onExpand(record, e)}>
                  <DownArrowIcon width={10} height={15} color="var(--color-gray-600)" />
                </span>
              ) : (
                <span className="cursor-pointer" onClick={e => onExpand(record, e)}>
                  <ChervonIcon width={6} height={10} color="var(--color-gray-600)" />
                </span>
              )
            ) : null,
        }}
        pagination={{
          defaultPageSize: pageSize,
          pageSize: pageSize,
          current: currentPage,
          total: total,
          onChange: (page: number) => handlePagination(page),
        }}
        rowKey="id"
        dataSource={data}
      />
    </div>
  );
};
export default SectionTable;
