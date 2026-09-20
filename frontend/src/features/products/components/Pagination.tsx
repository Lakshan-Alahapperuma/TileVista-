import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  getPageNumbers: () => (number | '...')[];
  goToPage: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = React.memo(({
  currentPage,
  totalPages,
  getPageNumbers,
  goToPage
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 pt-8 pb-4">
      {/* Previous Button */}
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-10 h-10 flex items-center justify-center border border-gray-200 text-gray-500 hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-all duration-300 disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, idx) =>
        page === '...' ? (
          <span key={`dots-${idx}`} className="w-10 h-10 flex items-center justify-center text-gray-400 text-xs font-mono">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => goToPage(page as number)}
            className={`w-10 h-10 flex items-center justify-center text-xs font-semibold tracking-wider transition-all duration-300 ${
              currentPage === page
                ? 'bg-[#1A1A1A] text-white border border-[#1A1A1A]'
                : 'border border-gray-200 text-gray-500 hover:border-[#1A1A1A] hover:text-[#1A1A1A]'
            }`}
          >
            {page}
          </button>
        )
      )}

      {/* Next Button */}
      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-10 h-10 flex items-center justify-center border border-gray-200 text-gray-500 hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-all duration-300 disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
});

Pagination.displayName = 'Pagination';
