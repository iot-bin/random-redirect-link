export const TABLE_NAME = process.env.TABLE_NAME;
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
export const LINKS_INDEX_NAME = process.env.LINKS_INDEX_NAME || "links-by-path";

export const LIST_PARTITION_ATTRIBUTE = "listPk";
export const LIST_PARTITION_VALUE = "LINK";
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
export const MAX_BATCH_SIZE = 50;
export const BATCH_CONCURRENCY = 10;
export const MAX_PATH_LENGTH = 128;
export const MAX_CURSOR_LENGTH = 2048;
export const MAX_TARGET_URL_LENGTH = 4096;
export const BATCH_ACTIONS = new Set(["enable", "disable", "delete", "restore"]);

export function hasRequiredConfig() {
  return Boolean(TABLE_NAME && ADMIN_TOKEN);
}
