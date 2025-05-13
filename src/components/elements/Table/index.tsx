import { Table as AntdTable, TableProps } from "antd";

const Table = (props: TableProps) => {
  return <AntdTable className="custom-table" {...props} />;
};

export default Table;
