import { List as AntList, ListProps } from "antd";

interface InformationListProps extends Omit<ListProps<string>, "dataSource" | "renderItem"> {
  data: string[];
  listStyle?: string;
  className?: string;
}
const InformationList = (props: InformationListProps) => {
  const { data = [], listStyle = "numbered", className = "", ...inputProps } = props;
  return (
    <AntList
      className={`custom-list ${className}`}
      dataSource={data}
      renderItem={(item, index) => (
        <AntList.Item>
          <span className="!text-sm !text-Gray700 !leading-[23px] !font-helvetica">
            {listStyle === "numbered" ? `${index + 1}.` : <span className="inline-block w-1 h-1 bg-Gray700 rounded-full mr-2" />}
            {item}
          </span>
        </AntList.Item>
      )}
      {...inputProps}
    />
  );
};

export default InformationList;
