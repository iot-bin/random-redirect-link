import { forwardManagement } from '@/lib/management-api';
export function GET() { return forwardManagement('/me'); }
