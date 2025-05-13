import { DeleteIcon, PencilIcon } from "@/icons";
import { Flex, MenuProps } from "antd";

export const actionMenu: MenuProps["items"] = [
  {
    key: "edit-btn",
    label: (
      <Flex align="center" gap={8}>
        <PencilIcon color="black" width={12} height={12} />
        <p className="mt-1">Edit</p>
      </Flex>
    ),
  },
  {
    type: "divider",
  },
  {
    key: "delete-btn",
    label: (
      <Flex align="center" gap={8}>
        <DeleteIcon width={12} height={12} color="var(--color-danger)" />
        <p className="text-danger mt-1">Delete</p>
      </Flex>
    ),
  },
];
