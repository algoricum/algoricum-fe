import { useState, useCallback } from "react";
import type { PaginationProps } from "antd";

export interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  offset: number;
  paginationConfig: PaginationProps;
  setTotal: (total: number) => void;
  resetPagination: () => void;
}

export const usePagination = (initialPageSize: number = 10): UsePaginationReturn => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(0);

  // Calculate offset for Supabase queries
  const offset = (currentPage - 1) * pageSize;

  const handleChange = useCallback(
    (page: number, size?: number) => {
      setCurrentPage(page);
      if (size && size !== pageSize) {
        setPageSize(size);
        setCurrentPage(1); // Reset to first page when changing page size
      }
    },
    [pageSize],
  );

  const handleShowSizeChange = useCallback((current: number, size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  const setTotal = useCallback((total: number) => {
    setTotalItems(total);
  }, []);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    setTotalItems(0);
  }, []);

  // Ant Design Pagination configuration
  const paginationConfig: PaginationProps = {
    current: currentPage,
    pageSize: pageSize,
    total: totalItems,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
    pageSizeOptions: ["10", "20", "50", "100"],
    onChange: handleChange,
    onShowSizeChange: handleShowSizeChange,
    size: "default",
  };

  return {
    currentPage,
    pageSize,
    totalItems,
    offset,
    paginationConfig,
    setTotal,
    resetPagination,
  };
};
