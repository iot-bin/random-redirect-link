import {
  LIST_PARTITION_ATTRIBUTE,
  LIST_PARTITION_VALUE
} from "./config.mjs";

export function createLinkItem({
  path,
  target,
  randomSubdomain,
  subdomainLength
}) {
  const now = new Date().toISOString();
  return {
    path,
    [LIST_PARTITION_ATTRIBUTE]: LIST_PARTITION_VALUE,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    statusCode: 302,
    randomSubdomain,
    ...(randomSubdomain ? { subdomainLength } : {}),
    ...target
  };
}

export function toPublicItem(item) {
  if (!item || typeof item !== "object") return item;
  const publicItem = { ...item };
  delete publicItem[LIST_PARTITION_ATTRIBUTE];
  return publicItem;
}
