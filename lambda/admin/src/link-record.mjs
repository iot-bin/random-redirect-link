import {
  LIST_PARTITION_ATTRIBUTE,
  LIST_PARTITION_VALUE
} from "./config.mjs";

export function createLinkItem({ path, target, subdomainLength }) {
  const now = new Date().toISOString();
  return {
    path,
    [LIST_PARTITION_ATTRIBUTE]: LIST_PARTITION_VALUE,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    statusCode: 302,
    randomSubdomain: true,
    subdomainLength,
    ...target
  };
}

export function toPublicItem(item) {
  if (!item || typeof item !== "object") return item;
  const {
    [LIST_PARTITION_ATTRIBUTE]: _listPk,
    ...publicItem
  } = item;
  return publicItem;
}
