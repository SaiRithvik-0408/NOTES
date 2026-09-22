import type { IncomingMessage, ServerResponse } from 'http';

export interface ApiRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
  body: any;
  cookies?: Record<string, string>;
}

export interface ApiResponse extends ServerResponse {
  status: (statusCode: number) => ApiResponse;
  json: (data: any) => ApiResponse | void;
  send: (data: any) => ApiResponse | void;
  setHeader: (name: string, value: string | number | readonly string[]) => this;
}
