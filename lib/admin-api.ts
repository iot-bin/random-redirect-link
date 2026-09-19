import 'server-only';
import { forwardManagement } from './management-api';
export function forwardAdminRequest({targetId,endpoint,method,body}: {
  targetId:string;endpoint:string;method:'GET'|'POST'|'PATCH'|'DELETE';body?:unknown;
  operation?:'list'|'get'|'create'|'update'|'delete'|'batch';
}) {
  return forwardManagement('/targets/'+(encodeURIComponent(targetId)||'_')+endpoint,method,body);
}
