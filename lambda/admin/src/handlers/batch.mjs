import { BATCH_CONCURRENCY } from "../config.mjs";
import { json } from "../http.mjs";
import { toPublicItem } from "../link-record.mjs";
import {
  deleteLinkRecordIfExists,
  updateLinkEnabledIfExists
} from "../repository.mjs";
import { parseBatchRequest } from "../validation.mjs";

async function mutateBatchItem(
  action,
  path,
  {
    deleteLink = deleteLinkRecordIfExists,
    updateLinkEnabled = updateLinkEnabledIfExists
  } = {}
) {
  try {
    if (action === "delete") {
      await deleteLink(path);
      return { ok: true, value: { path } };
    }

    const item = await updateLinkEnabled(path, action === "enable");
    return {
      ok: true,
      value: { path, item: toPublicItem(item) }
    };
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      return {
        ok: false,
        value: { path, code: "LINK_NOT_FOUND", error: "not found" }
      };
    }
    // Systemic failures must reach the top-level handler so callers receive
    // a retryable 5xx response instead of a misleading HTTP 200 batch result.
    throw error;
  }
}

export async function batchMutateLinks(event, dependencies) {
  const { action, paths } = parseBatchRequest(event);
  const succeeded = [];
  const failed = [];

  for (let offset = 0; offset < paths.length; offset += BATCH_CONCURRENCY) {
    const chunk = paths.slice(offset, offset + BATCH_CONCURRENCY);
    const results = await Promise.all(
      chunk.map((path) => mutateBatchItem(action, path, dependencies))
    );

    for (const result of results) {
      (result.ok ? succeeded : failed).push(result.value);
    }
  }

  return json(200, { action, succeeded, failed });
}
