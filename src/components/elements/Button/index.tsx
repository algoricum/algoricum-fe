import { Button as AntdButton, ButtonProps } from "antd";

interface AntdButtonProps extends ButtonProps {
  outline?: boolean; // Add the custom 'outline' property
  light?: boolean;
}
const Button = (props: AntdButtonProps) => {
  const { children,className, ...btnProps } = props;

  // const styles = outline
  //   ? "text-Primary1000 hover:!text-Primary800 !font-helvetica bg-white border !border-Primary800"
  //   : light
  //     ? "text-black bg-Gray300 border-none hover:!text-Primary1000 hover:!bg-Gray200"
  //     : danger
  //       ? "!bg-danger hover:!opacity-85 hover:!bg-danger !border-none !text-white"
  //       : "text-white hover:!text-white bg-Primary1000 hover:!bg-Primary800 hover:!border-Primary800";

  return (
    <AntdButton className={`h-10 !font-helvetica-700 !py-2 !px-3 !rounded-lg !text-sm  ${className}`} {...btnProps}>
      {children}
    </AntdButton>
  );
};

export default Button;
