import type { Locale } from './i18n/config';
const en = {
  loading:'Checking status…', mfaEnabled:'Enabled', mfaDisabled:'Not enabled',
  mfaDescription:'Use an authenticator code when signing in.',
  mfaEnabledHelp:'Your authenticator is linked. You do not need to set it up again.',
  inactive:'Disabled',
  title:'Administration',config:'Environments and site',members:'Members',audit:'Recent operations',
  name:'Name',domain:'Short-link base URL',api:'Admin API ID',stage:'API stage',enabled:'Enabled',
  siteTitle:'Site title',description:'Site description',defaultTarget:'Default environment',
  save:'Save',add:'Add environment',remove:'Remove',email:'Email',invite:'Invite member',
  role:'Role',active:'Active',admin:'Administrator',member:'Member',none:'No access',viewer:'Read only',editor:'Editor',
  saved:'Saved',failed:'Request failed. Refresh and retry.',owner:'Protected owner',reload:'Refresh',
  inviteHelp:'Invited members receive a temporary password by email. Grant environment access below.',
  configHelp:'Select an API already provisioned and allowed by the deployment. Adding a row does not create AWS resources.',
  readonly:'You have read-only access to this environment.',mfa:'Authenticator app',setup:'Set up MFA',verify:'Verify and enable',code:'Verification code',
  mfaHelp:'Add this secret to your authenticator app, then enter its six-digit code.',
};
type Copy = Record<keyof typeof en,string>;
const zh:Copy={loading:'正在查询状态…',mfaEnabled:'已启用',mfaDisabled:'未启用',mfaDescription:'登录时使用验证器验证码保护账号。',mfaEnabledHelp:'验证器已绑定，无需重复设置。',inactive:'已停用',title:'管理中心',config:'环境与站点',members:'成员管理',audit:'近期操作',name:'名称',domain:'短链基础地址',api:'管理 API ID',stage:'API 阶段',enabled:'启用',siteTitle:'网站标题',description:'网站描述',defaultTarget:'默认环境',save:'保存',add:'添加环境',remove:'移除',email:'邮箱',invite:'邀请成员',role:'角色',active:'启用账号',admin:'管理员',member:'成员',none:'无权限',viewer:'只读',editor:'编辑者',saved:'已保存',failed:'请求失败，请刷新后重试。',owner:'受保护的所有者',reload:'刷新',inviteHelp:'受邀成员会收到含临时密码的邮件，请在下方授予环境权限。',configHelp:'请选择已部署且列入允许范围的 API。添加记录不会创建 AWS 资源。',readonly:'你对当前环境只有查看权限。',mfa:'验证器应用',setup:'设置 MFA',verify:'验证并启用',code:'验证码',mfaHelp:'将此密钥添加到验证器应用，然后输入六位验证码。'};
const tw:Copy={...zh,loading:'正在查詢狀態…',mfaEnabled:'已啟用',mfaDisabled:'未啟用',mfaDescription:'登入時使用驗證器驗證碼保護帳號。',mfaEnabledHelp:'驗證器已綁定，無需重複設定。',inactive:'已停用',title:'管理中心',config:'環境與網站',members:'成員管理',audit:'近期操作',name:'名稱',domain:'短鏈基礎位址',api:'管理 API ID',stage:'API 階段',enabled:'啟用',siteTitle:'網站標題',description:'網站描述',defaultTarget:'預設環境',save:'儲存',add:'新增環境',remove:'移除',email:'電子郵件',invite:'邀請成員',role:'角色',active:'啟用帳號',admin:'管理員',member:'成員',none:'無權限',viewer:'唯讀',editor:'編輯者',saved:'已儲存',failed:'請求失敗，請重新整理後再試。',owner:'受保護的擁有者',reload:'重新整理',inviteHelp:'受邀成員會收到含臨時密碼的郵件，請在下方授予環境權限。',configHelp:'請選擇已部署且列入允許範圍的 API。新增記錄不會建立 AWS 資源。',readonly:'你對目前環境只有檢視權限。',mfa:'驗證器應用程式',setup:'設定 MFA',verify:'驗證並啟用',code:'驗證碼',mfaHelp:'將此金鑰新增至驗證器應用程式，然後輸入六位驗證碼。'};
export const controlCopy:Record<Locale,Copy>={en,'zh-CN':zh,'zh-TW':tw};
