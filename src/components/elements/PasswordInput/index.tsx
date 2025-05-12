import { Input, InputProps } from "antd";

const PasswordInput = (props: InputProps) => {
  const { className, ...inputProps } = props;
  return (
    <Input.Password
      className={`h-[44px] hover:!border-Primary1000 focus-within:shadow-sm focus-within:!border-Primary1000 ${className}`}
      {...inputProps}
    />
  );
};

export default PasswordInput;
