import { MAX_TARGET_URL_LENGTH, targetUrlIssue, isSubdomainLength } from '../packages/contracts/index.mjs';

const targetMessages = {
  type: '请输入目标地址',
  required: '请输入目标地址',
  length: `目标地址不能超过 ${MAX_TARGET_URL_LENGTH} 个字符`,
  invalid: '请输入有效的目标地址',
  protocol: '目标地址必须以 http:// 或 https:// 开头',
  credentials: '目标地址不能包含用户名或密码',
  query_fragment: '当前后台暂不支持目标地址中的查询参数或锚点',
};

export function getTargetUrlError(value: string): string {
  const issue = targetUrlIssue(value);
  return issue ? targetMessages[issue] : '';
}

export function getSubdomainLengthError(value: number): string {
  return isSubdomainLength(value) ? '' : '随机字符长度必须是 3 至 32 的整数';
}
