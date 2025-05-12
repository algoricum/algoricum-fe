import { UserState } from "@/redux/models/user_model";
import { UserOutlined } from "@ant-design/icons";
import { Avatar, Flex } from "antd";

const ProfilePicture = ({ user }: { user: UserState["user"] }) => {
  const { name, email } = user || {};

  return (
    <Flex gap={10} align="center">
      <Avatar shape="circle" className="w-8 h-8 sm:w-11 sm:h-11" icon={<UserOutlined />} />
      <Flex vertical justify="center" className="hidden lg:block">
        <p className="m-0 p-0 leading-none text-sm !text-Gray900 font-helvetica-500">{name}</p>
        <p className="m-0 p-0 leading-none text-sm font-helvetica !text-Gray600">{email}</p>
      </Flex>
    </Flex>
  );
};

export default ProfilePicture;
