export const TABLE_NAME = process.env.TABLE_NAME;
export const MANAGEMENT_ROLE_ARN = process.env.MANAGEMENT_ROLE_ARN;
export const LINKS_INDEX_NAME = process.env.LINKS_INDEX_NAME || "links-by-path";

export const LIST_PARTITION_ATTRIBUTE = "listPk";
export const LIST_PARTITION_VALUE = "LINK";
export { DEFAULT_LIST_LIMIT as DEFAULT_LIMIT, MAX_LIST_LIMIT as MAX_LIMIT, MAX_BATCH_SIZE, MAX_CURSOR_LENGTH, MAX_LINK_PATH_LENGTH as MAX_PATH_LENGTH, MAX_TARGET_URL_LENGTH } from './link-contracts.mjs';
export const BATCH_CONCURRENCY = 10;

export function hasRequiredConfig() {
  return Boolean(TABLE_NAME && MANAGEMENT_ROLE_ARN);
}
