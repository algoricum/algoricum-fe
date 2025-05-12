import { Button, Table } from "@/components/elements";
import { DeleteIcon } from "@/icons";
import formatDateToDayMonthYear from "@/utils/formatDate";
import { TableProps } from "antd";

interface SetupTableProps {
  isLoading: boolean;
  api_key: any;
  openRevokeModal: any;
  total: number;
  curretPage: number;
  pageSize: number;
  handlePagination: any;
}
const SetupTable = ({ handlePagination, curretPage, pageSize, isLoading, api_key, openRevokeModal, total }: SetupTableProps) => {
  const columns: TableProps["columns"] = [
    {
      title: "Secret Key",
      dataIndex: "apiKey",
      key: "apiKey",
      render: () => <p className="blur-sm">c46c5ce7-e3ee-42ea-810b-b097549becf7</p>,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      // render: () => <p className="blur-sm">c46c5ce7-e3ee-42ea-810b-b097549becf7</p>,
    },
    {
      title: "Expired At",
      dataIndex: "key_expires_at",
      key: "key_expires_at",
      render: (expires_at: string) => <p>{formatDateToDayMonthYear(expires_at)}</p>,
    },
    {
      title: "Last Used",
      dataIndex: "last_used_at",
      key: "last_used_at",
      render: (last_used_at: string) => <p>{last_used_at != null ? formatDateToDayMonthYear(last_used_at) : "NA"}</p>,
    },
    {
      title: "Created Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (created_at: string) => <p>{formatDateToDayMonthYear(created_at)}</p>,
    },

    {
      title: "Updated At",
      dataIndex: "updated_at",
      key: "updated_at",
      render: (updated_date: string) => <p>{formatDateToDayMonthYear(updated_date)}</p>,
    },
    {
      title: "Action",
      dataIndex: "id",
      key: "id",
      render: (id: string) => (
        <Button
          type="primary"
          onClick={() => openRevokeModal(id)}
          className="hover:!bg-dangerSoft !border-none"
          icon={<DeleteIcon color="white" />}
          danger
        />
      ),
    },
  ];
  return (
    <Table
      pagination={{
        defaultPageSize: pageSize,
        pageSize: pageSize,
        current: curretPage,
        total: total,
        onChange: (page: number) => handlePagination(page),
      }}
      loading={isLoading}
      dataSource={api_key}
      columns={columns}
    />
  );
};

export default SetupTable;
