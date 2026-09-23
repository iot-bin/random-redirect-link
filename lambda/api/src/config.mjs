export const TABLE_NAME = process.env.TABLE_NAME;

export const DEFAULT_STATUS_CODE = 302;
export const DEFAULT_SUBDOMAIN_LENGTH = 10;

export function hasRequiredConfig() {
  return Boolean(TABLE_NAME);
}
