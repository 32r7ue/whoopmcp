export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
  token_type: string;
}

export interface PaginatedResponse<T> {
  records: T[];
  next_token?: string;
}

export interface PaginationParams {
  limit?: number;
  start?: string;
  end?: string;
  nextToken?: string;
}

export interface WhoopApiError {
  error?: string;
  message?: string;
}
