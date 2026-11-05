// Single source of truth for option lists. The client loads these through GET /api/lookups.
const CONDITIONS = [
  { value: 'new', label: 'Brand new' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' }
];

const REPORT_REASONS = ['Inaccurate listing', 'Inappropriate content', 'Spam or duplicate', 'Safety concern', 'Other'];

module.exports = { CONDITIONS, REPORT_REASONS };
