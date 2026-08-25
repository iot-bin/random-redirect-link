import type { ApiError } from '@/lib/link-types';
import type { Translate } from '@/lib/i18n/LocaleProvider';
import type { MessageKey } from '@/lib/i18n/messages';

const validationMessages: Record<string, MessageKey> = {
  '请输入短链路径': 'validation.pathRequired',
  '短链路径不能超过 128 个字符': 'validation.pathTooLong',
  '短链路径不能包含“..”': 'validation.pathDotDot',
  '短链路径不能包含连续斜杠': 'validation.pathDoubleSlash',
  '短链路径不能包含问号或井号': 'validation.pathQueryHash',
  '路径前缀不能超过 128 个字符': 'validation.prefixTooLong',
  '路径前缀不能包含“..”': 'validation.prefixDotDot',
  '路径前缀不能包含连续斜杠': 'validation.prefixDoubleSlash',
  '路径前缀不能包含问号或井号': 'validation.prefixQueryHash',
  '请输入目标地址': 'validation.targetRequired',
  '目标地址不能超过 4096 个字符': 'validation.targetTooLong',
  '目标地址必须以 http:// 或 https:// 开头': 'validation.targetProtocol',
  '目标地址不能包含用户名或密码': 'validation.targetCredentials',
  '当前后台暂不支持目标地址中的查询参数或锚点': 'validation.targetQueryHash',
  '请输入有效的目标地址': 'validation.targetInvalid',
  '随机字符长度必须是 3 至 32 的整数': 'validation.subdomainLength',
};

const apiMessages: Record<string, MessageKey> = {
  PASSWORD_NOT_CONFIGURED: 'api.passwordNotConfigured',
  INVALID_REQUEST: 'api.invalidRequest',
  PASSWORD_REQUIRED: 'login.passwordRequired',
  INVALID_PASSWORD: 'api.invalidPassword',
  TARGET_REQUIRED: 'common.chooseEnvironment',
  TARGET_NOT_FOUND: 'api.targetNotFound',
  UPSTREAM_AUTH_FAILED: 'api.authFailed',
  INVALID_CURSOR: 'api.invalidCursor',
  INVALID_LIMIT: 'api.invalidLimit',
  INVALID_PREFIX: 'api.invalidPrefix',
  LIST_INDEX_UNAVAILABLE: 'api.indexUnavailable',
  LINK_VERSION_CONFLICT: 'api.versionConflict',
  LIST_NOT_SUPPORTED: 'api.listUnsupported',
  LINK_NOT_FOUND: 'api.linkNotFound',
  LINK_CONFLICT: 'api.linkConflict',
  UPSTREAM_THROTTLED: 'api.throttled',
  UPSTREAM_ERROR: 'api.upstreamError',
  UPSTREAM_TIMEOUT: 'api.timeout',
  UPSTREAM_UNAVAILABLE: 'api.unavailable',
  INVALID_JSON: 'api.invalidJson',
  INVALID_PATH: 'api.invalidPath',
  INVALID_TARGET_URL: 'api.invalidTargetUrl',
  INVALID_RANDOM_SUBDOMAIN: 'api.invalidRandomSubdomain',
  FIXED_MODE_UNAVAILABLE: 'api.fixedModeUnavailable',
  INVALID_SUBDOMAIN_LENGTH: 'validation.subdomainLength',
  INVALID_ENABLED: 'api.invalidEnabled',
  INVALID_STATUS_CODE: 'api.invalidStatusCode',
  INVALID_UPDATED_AT: 'api.invalidUpdatedAt',
  EMPTY_UPDATE: 'api.emptyUpdate',
  INVALID_BATCH_ACTION: 'api.invalidBatchAction',
  INVALID_PATHS: 'api.invalidPaths',
  BATCH_LIMIT_EXCEEDED: 'api.batchLimit',
};

export function translateValidationError(error: string, t: Translate): string {
  const key = validationMessages[error];
  return key ? t(key) : error;
}

export function translateApiError(
  value: unknown,
  t: Translate,
  fallback: MessageKey,
): string {
  if (typeof value !== 'object' || value === null) return t(fallback);

  const { code } = value as ApiError;
  const key = code ? apiMessages[code] : undefined;
  return key ? t(key) : t(fallback);
}
