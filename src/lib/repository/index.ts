import { LocalStorageRepository } from "./localStorageRepository";
import type { DataRepository } from "./types";

// ------------------------------------------------------------------
// To connect this app to a real backend, implement `DataRepository`
// (see ./types.ts) against your API and swap the instance below.
// Nothing else in the app needs to change.
//
// Example:
//   import { ApiRepository } from "./apiRepository";
//   export const repository: DataRepository = new ApiRepository({
//     baseUrl: process.env.NEXT_PUBLIC_API_URL!,
//   });
// ------------------------------------------------------------------
export const repository: DataRepository = new LocalStorageRepository();

export type { DataRepository } from "./types";
