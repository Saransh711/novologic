/**
 * Maximum number of historical snapshots retained per workbook. On each save the
 * previous content is archived and anything beyond this many newest versions is
 * pruned.
 */
export const MAX_WORKBOOK_VERSIONS = 5;
