import Loading from "@/app/loading";
import { DeleteModal } from "@/components/common";
import { PAGE_SIZE } from "@/constants";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { Section } from "@/redux/models/section_modal";
import SectionService from "@/services/section";
import { Flex } from "antd";
import { useState } from "react";
import { useMutation, useQuery } from "react-query";
import AddSectionModal from "./AddSectionModal";
import SectionPreviewHeader from "./SectionPreviewHeader";
import SectionTable from "./SectionTable";

const SectionPage = () => {
  const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);
  const [openSectionModal, setOpenSectionModal] = useState<boolean>(false);
  const [section, setSection] = useState<Section | undefined>();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(PAGE_SIZE);

  const { data, isLoading, refetch } = useQuery(["Sections", currentPage, pageSize], {
    queryFn: () => SectionService.fetchArticleSections(currentPage, pageSize),
    onSuccess: (data: any) => {
      let { sections = [] } = data;
      if (!sections?.length && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    },
  });
  let { sections = [], total_count = 0 } = data || {};

  const { mutate: deleteSectionMutate } = useMutation("DeleteSection", () => SectionService.deleteSection(section?.id || ""), {
    onSuccess: () => {
      setOpenDeleteModal(false);
      setSection(undefined);
      SuccessToast("Section Delete successfully");
      refetch();
    },
    onError: (error: any) => {
      ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred Delete Section");
    },
  });

  const handleOpen = () => {
    setOpenSectionModal(true);
  };

  const handleSectionModals = (event: any, section: Section) => {
    setSection(section);
    if (event.key == "edit-btn") {
      handleOpen();
    } else if (event.key == "delete-btn") {
      setOpenDeleteModal(true);
    }
  };

  const handleCloseDeleteModal = () => {
    setSection(undefined);
    setOpenDeleteModal(false);
  };

  if (isLoading) {
    return <Loading />;
  }

  const handlePaginationChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCancelAddSection = () => {
    setOpenSectionModal(false);
    setSection(undefined);
  };

  return (
    <Flex vertical gap={18} className="h-full">
      <SectionPreviewHeader handleOpen={handleOpen} />
      <SectionTable
        pageSize={pageSize}
        handlePagination={handlePaginationChange}
        total={total_count}
        currentPage={currentPage}
        handleSectionModals={handleSectionModals}
        data={sections}
      />
      {openSectionModal && (
        <AddSectionModal open={openSectionModal} handleCancel={handleCancelAddSection} section={section} refetch={refetch} />
      )}
      {openDeleteModal && <DeleteModal open={openDeleteModal} onConfirm={deleteSectionMutate} handleCancel={handleCloseDeleteModal} />}
    </Flex>
  );
};

export default SectionPage;
