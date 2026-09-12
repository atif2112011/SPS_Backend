const parsePagination = (query = {}, allowedSortFields = ['createdAt'], defaultSortBy = 'createdAt') => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : defaultSortBy;
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  return { page, limit, skip, sortBy, sortOrder };
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSearchRegex = (value) => ({ $regex: escapeRegex(String(value).trim()), $options: 'i' });

const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

export { parsePagination, buildPaginationMeta, buildSearchRegex };
export default { parsePagination, buildPaginationMeta, buildSearchRegex };
