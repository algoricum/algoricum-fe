"use client";
import { Button, Input } from "@/components/elements";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { FolderIcon, PlusIcon, SearchIcon, ShortcutKeyIcon } from "@/icons";
import ArticleService from "@/services/articles";
import { Flex, InputRef, Typography } from "antd";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { useMutation } from "react-query";
import AddSectionModal from "../Section/AddSectionModal";

const { Text } = Typography;
interface ContentPreviewProps {
  onSearch?: any;
}

const SearchSuffix = (
  <Flex justify="center" align="center" gap={10}>
    <span className="bg-Gray100 border border-Gray300 rounded p-1 max-h-5	">
      <ShortcutKeyIcon color="var(--color-gray-600)" width={11} height={11} />
    </span>
    <span className="bg-Gray100 border border-Gray300 rounded p-1 text-sm font-helvetica text-Gray600 max-h-5	text-center flex justify-center items-center !leading-[23px]">
      K
    </span>
  </Flex>
);

const ContentPreviewHeader = ({ onSearch }: ContentPreviewProps) => {
  const { push } = useRouter();
  const [openSectionModal, setOpenSectionModal] = useState<boolean>(false);
  const [isHoverFolder, SetIsHoverFolder] = useState<boolean>(false);
  const searchRef = useRef<InputRef>(null);

  // key shortcut
  const handleKeyPress = (event: any) => {
    if (event.ctrlKey && event.key === "k") {
      event.preventDefault(); // Prevent default browser action
      searchRef.current?.focus();
    }
  };

  React.useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, []);
  //close key shortcut

  const { mutate, isLoading } = useMutation(ArticleService.createArticle, {
    onSuccess: (data: any) => {
      SuccessToast("Article Created Successfully");
      push(`/content/articles/${data?.id}/edit`);
    },
    onError: (error: any) => {
      ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred while creating Article");
    },
  });

  const handleOpen = () => {
    setOpenSectionModal(true);
    SetIsHoverFolder(false);
  };

  const handleNavigateContent = () => {
    mutate({ title: "Untitled Article", description: "", content_body: "" });
  };

  const handleCancelAddSection = () => {
    setOpenSectionModal(false);
  };

  const ActionButtons = () => {
    return (
      <Flex align="center" gap={10}>
        <Button
          onMouseEnter={() => SetIsHoverFolder(true)}
          onMouseLeave={() => SetIsHoverFolder(false)}
          className="!bg-white !border  !border-Gray400 !text-Gray900 justify-center items-center flex"
          onClick={handleOpen}
        >
          <span>
            <FolderIcon color={isHoverFolder ? "white" : "#1A202C"} width={12} height={12} />
          </span>
          <span className="text-sm pt-1">New Section</span>
        </Button>
        <Button
          loading={isLoading}
          className="bg-primary text-secondary w- items-center justify-center gap-2 flex"
          onClick={handleNavigateContent}
        >
          <span className="">
            <PlusIcon width={14} height={14} color="white" />
          </span>
          <span className="text-sm pt-1">New Articles</span>
        </Button>
      </Flex>
    );
  };

  return (
    <Flex vertical gap={10}>
      <Flex className="w-full" justify="space-between" align="center" gap={10}>
        <Text className="min-w-fit font-helvetica-700 text-lg text-black">Article List</Text>
        <Flex gap={10}>
          <Input
            inputRef={searchRef}
            className="!max-h-10"
            onChange={onSearch}
            suffix={SearchSuffix}
            placeholder="search anything here"
            prefix={<SearchIcon color="var(--color-gray-600)" />}
          />
          <Flex className="hidden md:flex">
            <ActionButtons />
          </Flex>
        </Flex>
      </Flex>
      <Flex justify="flex-end" align="center" className="flex md:hidden">
        <ActionButtons />
      </Flex>
      {openSectionModal && <AddSectionModal open={openSectionModal} handleCancel={handleCancelAddSection} />}
    </Flex>
  );
};

export default ContentPreviewHeader;
