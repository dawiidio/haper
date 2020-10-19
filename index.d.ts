import {
    HaperApi,
} from './src/Interfaces';

export function createHaper({ baseUrl }: { baseUrl?: string }): HaperApi

export {
    HaperApi,
    HaperCancelablePromise,
    HaperRequestOptions,
    ClientInterceptorFilters,
    HaperMethodOptions,
    HaperRequestContentType,
} from './src/Interfaces';