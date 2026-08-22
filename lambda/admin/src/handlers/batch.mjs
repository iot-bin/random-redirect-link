import { BATCH_CONCURRENCY } from "../config.mjs";
import { isThrottlingError } from "../errors.mjs";
import { json } from "../http.mjs";
import { toPublicItem } from "../link-record.mjs";
import {
  deleteLinkRecordIfExists,
  updateLinkEnabledIfExists
} from "../repository.mjs";
import { parseBatchRequest } from "../validation.mjs";

async function mutateBatchItem(action, path) {
  try {
    if (action === "delete") {
      await deleteLinkRecordIfExists(path);
      return { ok: true, value: { path } };
    }

    const item = await updateLinkEnabledIfExists(path, action === "enable");
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
    if (isThrottlingError(error)) {
      return {
        ok: false,
        value: {
          path,
          code: "DYNAMODB_THROTTLED",
          error: "service temporarily unavailable"
        }
      };
    }

    return {
      ok: false,
      value: { path, code: "INTERNAL_ERROR", error: "internal error" }
    };
  }
}

export async function batchMutateLinks(event) {
  const { action, paths } = parseBatchRequest(event);
  const succeeded = [];
  const failed = [];

  for (let offset = 0; offset < paths.length; offset += BATCH_CONCURRENCY) {
    const chunk = paths.slice(offset, offset + BATCH_CONCURRENCY);
    const results = await Promise.all(
      chunk.map((path) => mutateBatchItem(action, path))
    );

    for (const result of results) {
      (result.ok ? succeeded : failed).push(result.value);
    }
  }

  return json(200, { action, succeeded, failed });
}
