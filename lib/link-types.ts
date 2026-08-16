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

export interface ApiError {
  error: string;
  code?: string;
  detail?: string;
}

export interface DeleteLinkResponse {
  deleted: boolean;
  path: string;
}
