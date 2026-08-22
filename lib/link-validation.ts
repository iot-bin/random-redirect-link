const MAX_TARGET_URL_LENGTH = 4096;

export function getTargetUrlError(value: string): string {
  if (!value) return '请输入目标地址';
  if (value.length > MAX_TARGET_URL_LENGTH) {
    return `目标地址不能超过 ${MAX_TARGET_URL_LENGTH} 个字符`;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return '目标地址必须以 http:// 或 https:// 开头';
    }
    if (url.username || url.password) {
      return '目标地址不能包含用户名或密码';
    }
    if (url.search || url.hash) {
      return '当前后台暂不支持目标地址中的查询参数或锚点';
    }
  } catch {
    return '请输入有效的目标地址';
  }

  return '';
}

export function getSubdomainLengthError(value: number): string {
  return Number.isInteger(value) && value >= 3 && value <= 32
    ? ''
    : '随机字符长度必须是 3 至 32 的整数';
}
