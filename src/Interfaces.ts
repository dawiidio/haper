import { InterceptorFilters } from './InterceptorRegistry';

export type HaperResponseType = 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text';
export type HaperRequestContentType = 'json';
export type HTTPMethods = 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestInterceptor = (request:Request) => Request|undefined|void;
export type ResponseDataInterceptor = (data:any) => any;

export interface ClientInterceptorFilters extends Omit<InterceptorFilters, 'builtIn'> {}

export interface HaperCancelablePromise<T> extends Promise<T> {
    cancel(): void
}

export interface HaperRequestOptions extends RequestInit {
    url: string,
    method: HTTPMethods
    params?: any,
    responseType?: HaperResponseType
    contentType?: HaperRequestContentType
}

export interface HaperInternalData {
    requestBaseUrl: string
    requestFinalUrl: string
    signal?: AbortSignal
}

export type HaperMethodOptions = Partial<Omit<Omit<HaperRequestOptions, 'method'>, 'params'>>;

export interface HaperApi {
    <T>(options: HaperRequestOptions): HaperCancelablePromise<T>
    get<T>(url: string, data?: any, options?: HaperMethodOptions): HaperCancelablePromise<T>
    post<T>(url: string, data?: any, options?: HaperMethodOptions): HaperCancelablePromise<T>
    put<T>(url: string, data?: any, options?: HaperMethodOptions): HaperCancelablePromise<T>
    delete<T>(url: string, data?: any, options?: HaperMethodOptions): HaperCancelablePromise<T>
    patch<T>(url: string, data?: any, options?: HaperMethodOptions): HaperCancelablePromise<T>
    registerRequestInterceptor(filters:string, interceptor: RequestInterceptor): any
    registerRequestInterceptor(filters:ClientInterceptorFilters, interceptor: RequestInterceptor): any
    registerResponseDataInterceptor(filterKeyString: string, interceptor: ResponseDataInterceptor): any
    registerResponseDataInterceptor(filters:ClientInterceptorFilters, interceptor: ResponseDataInterceptor): any
}