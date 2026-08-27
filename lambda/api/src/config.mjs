export const TABLE_NAME = process.env.TABLE_NAME;

export const DEFAULT_STATUS_CODE = 302;
export const DEFAULT_SUBDOMAIN_LENGTH = 10;
export const MIN_SUBDOMAIN_LENGTH = 3;
export const MAX_SUBDOMAIN_LENGTH = 32;

export function hasRequiredConfig() {
  return Boolean(TABLE_NAME);
}
