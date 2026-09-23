import type { LinkBatchAction, LinkBatchResponse, LinkListResponse, LinkRecord } from './link-types';
import * as contract from '../packages/contracts/index.mjs';

export const LINK_BATCH_ACTIONS = contract.LINK_BATCH_ACTIONS;
export function isLinkBatchAction(value: unknown): value is LinkBatchAction {
  return contract.isLinkBatchAction(value);
}
export function isLinkRecord(value: unknown): value is LinkRecord {
  return contract.isLinkRecord(value);
}
export function parseLinkListResponse(value: unknown): LinkListResponse | null {
  return contract.parseLinkListResponse(value) as LinkListResponse | null;
}
export function parseLinkBatchResponse(value: unknown): LinkBatchResponse | null {
  return contract.parseLinkBatchResponse(value) as LinkBatchResponse | null;
}
