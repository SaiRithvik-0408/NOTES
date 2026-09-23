import type { ApiRequest, ApiResponse } from './_types';
import syncHandler from './v1/sync';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return syncHandler(req, res);
}
