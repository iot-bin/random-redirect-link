export interface PublicApiTarget {
  id: string;
  name: string;
  redirectBaseUrl: string;
}

export interface LinkRecord {
  path: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  statusCode?: number;
  randomSubdomain?: boolean;
  subdomainLength?: number;
  targetBaseUrl?: string;
  targetPath?: string;
  targetUrl?: string;
}

export interface LinkListResponse {
  items: LinkRecord[];
  nextCursor: string | null;
}

export interface LinkUpdateInput {
  enabled?: boolean;
  targetUrl?: string;
  statusCode?: 301 | 302;
  subdomainLength?: number;
  expectedUpdatedAt?: string;
}

export type LinkBatchAction = 'enable' | 'disable' | 'delete';

export interface LinkBatchSuccess {
  path: string;
  item?: LinkRecord;
}

export interface LinkBatchFailure {
  path: string;
  code: string;
  error: string;
}

export interface LinkBatchResponse {
  action: LinkBatchAction;
  succeeded: LinkBatchSuccess[];
  failed: LinkBatchFailure[];
}

export interface ApiError {
  error: string;
  code?: string;
  detail?: string;
}

export interface DeleteLinkResponse {
  deleted: boolean;
  path: string;
}
