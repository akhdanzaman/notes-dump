import { useEffect, useMemo, useState } from 'react';

interface UseLazyItemsOptions {
  pageSize?: number;
  resetKey?: string | number;
}

export const DEFAULT_LAZY_PAGE_SIZE = 20;

export const useLazyItems = <T,>(items: T[], options: UseLazyItemsOptions = {}) => {
  const { pageSize = DEFAULT_LAZY_PAGE_SIZE, resetKey } = options;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize, resetKey]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const remainingCount = Math.max(0, items.length - visibleItems.length);

  const loadMore = () => {
    setVisibleCount((current) => Math.min(current + pageSize, items.length));
  };

  return {
    visibleItems,
    visibleCount,
    remainingCount,
    canLoadMore: remainingCount > 0,
    loadMore,
  };
};
