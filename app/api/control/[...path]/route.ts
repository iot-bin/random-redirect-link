import { forwardManagement } from '@/lib/management-api';
const allowed = new Set(['config','members','audit','preferences']);
type Context = {params:Promise<{path:string[]}>};
async function handle(request:Request,context:Context) {
  const {path}=await context.params;
  if(path.length!==1 || !allowed.has(path[0])) return Response.json({code:'ROUTE_NOT_FOUND'},{status:404});
  const body=request.method==='GET'?undefined:await request.json().catch(()=>null);
  return forwardManagement('/'+path[0]+new URL(request.url).search,request.method,body);
}
export const GET=handle;
export const PUT=handle;
export const POST=handle;
