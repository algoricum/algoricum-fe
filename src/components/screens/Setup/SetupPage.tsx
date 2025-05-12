import Loading from "@/app/loading";
import { SecretModal } from "@/components/common";
import RevokeModal from "@/components/common/RevokeModal";
import { PAGE_SIZE } from "@/constants";
import { ErrorToast } from "@/helpers/toast";
import SetupService from "@/services/setup";
import { Flex } from "antd";
import { useState } from "react";
import { useQuery } from "react-query";
import SetupHeader from "./SetupHeader";
import SetupTable from "./SetupTable";

const SetupPage = () => {
  const [showSecretKeyModal, setshowSecretKeyModal] = useState<boolean>(false);
  const [showRevokeModal, setshowRevokeModal] = useState<boolean>(false);
  const [pageSize] = useState<number>(PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [id, setId] = useState<string>("");

  const {
    data,
    isLoading: isSecretLoading,
    refetch: refetchKeys,
  } = useQuery(["secretKeys", currentPage, pageSize], () => SetupService.fetchSecretKeys(currentPage, pageSize), {
    onSuccess: (data: any) => {
      const { api_key = [] } = data || {};
      if (!api_key?.length && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    },
    onError: (error: any) => {
      ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred while fetching secret  keys");
    },
  });
  const { api_key: api_key = [], total_count: total = 0 } = data || {};

  const handlePaginationChange = (page: number) => {
    setCurrentPage(page);
  };

  // eslint-disable-next-line no-unused-vars
  const openSecretModal = () => {
    setshowSecretKeyModal(true);
  };

  // eslint-disable-next-line no-unused-vars

  const openRevokeModal = (id: string) => {
    setId(id);
    setshowRevokeModal(true);
  };

  const closeRevokeModal = () => {
    setshowRevokeModal(false);
  };

  if (isSecretLoading) {
    return <Loading />;
  }

  return (
    <Flex vertical>
      <Flex vertical gap={10}>
        <SetupHeader handleOpen={openSecretModal} />
        <SetupTable
          pageSize={pageSize}
          curretPage={currentPage}
          total={total}
          handlePagination={handlePaginationChange}
          openRevokeModal={openRevokeModal}
          isLoading={isSecretLoading}
          api_key={api_key}
        />
      </Flex>
      {/* Revoke Modal */}
      {showRevokeModal && (
        <RevokeModal id={id} refetch={refetchKeys} open={showRevokeModal} setOpen={setshowRevokeModal} handleClose={closeRevokeModal} />
      )}
      {/* Create Secret Modal */}
      {showSecretKeyModal && <SecretModal refetch={refetchKeys} setOpen={setshowSecretKeyModal} open={showSecretKeyModal} />}
    </Flex>
  );
};

export default SetupPage;
