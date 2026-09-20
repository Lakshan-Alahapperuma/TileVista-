import { useState, useEffect } from 'react';

export const usePagination = (totalItems: number, itemsPerPage: number, dependencies: any[] = []) => {
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page when dependencies (like filters) change
  useEffect(() => {
    setCurrentPage(1);
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    currentPage,
    totalPages,
    startIndex,
    getPageNumbers,
    goToPage,
  };
};
