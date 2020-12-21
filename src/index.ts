import {
    ClientInterceptorFilters, HaperApi, HaperCancelablePromise, HaperInternalData, HaperMethodOptions,
    HaperRequestContentType, HaperRequestOptions,
    HaperResponseType,
    HTTPMethods,
    RequestInterceptor, ResponseDataInterceptor,
} from './index.d';

import {
    InterceptorRegistry,
    RequestInterceptorRegistry,
    ResponseDataInterceptorRegistry,
} from './InterceptorRegistry';
import {
    createCancelablePromise, getRequestFactory,
    getResponseBodyParser,
    getUrl,
    interpolateUrlAndRemoveMatchedVariablesFromParamsObject,
} from './helpers';

interface HaperFactoryOptions<BaseDataShape = any> {
    baseUrl?: string
}

export function createHaper({
                         baseUrl = '',
                     }: HaperFactoryOptions = {}):HaperApi {
    const requestInterceptors = new RequestInterceptorRegistry();
    const responseInterceptors = new ResponseDataInterceptorRegistry();

    function haper<T>(options: HaperRequestOptions): HaperCancelablePromise<T> {
        const {
            promise,
            signal,
            reject,
            resolve,
        } = createCancelablePromise<T>();

        const requestBaseUrl = `${baseUrl}${options.url}`;
        const requestFinalUrl = getUrl(requestBaseUrl, options);

        const internalData: HaperInternalData = {
            requestBaseUrl,
            requestFinalUrl,
            signal
        };

        const bodyParser = getResponseBodyParser(options);

        const requestFactory = getRequestFactory(options);
        const baseRequest = requestFactory(options, internalData);

        const interceptedRequest = requestInterceptors.pipe(baseRequest);

        window
            // @ts-ignore
            .fetch(interceptedRequest)
            .then(bodyParser)
            .then((data: T) => {
                try {
                    const interceptedData = responseInterceptors.pipe<T>({
                        url: internalData.requestBaseUrl,
                        method: options.method.toUpperCase() as HTTPMethods | '*',
                        type: options.responseType
                    }, data);

                    resolve(interceptedData);
                }
                catch (e) {
                    reject(e);
                }
            })
            .catch(reject);

        return promise;
    }

    haper.get = <T>(url: string, params?: any, options: HaperMethodOptions = {}): HaperCancelablePromise<T> => {
        return haper<T>({
            url,
            method: 'GET',
            params,
            ...options,
        });
    };

    haper.post = <T>(url: string, params?: any, options: HaperMethodOptions = {}): HaperCancelablePromise<T> => {
        return haper<T>({
            url,
            method: 'POST',
            params,
            ...options,
        });
    };

    haper.delete = <T>(url: string, params?: any, options: HaperMethodOptions = {}): HaperCancelablePromise<T> => {
        return haper<T>({
            url,
            method: 'DELETE',
            params,
            ...options,
        });
    };

    haper.patch = <T>(url: string, params?: any, options: HaperMethodOptions = {}): HaperCancelablePromise<T> => {
        return haper<T>({
            url,
            method: 'PATCH',
            params,
            ...options,
        });
    };

    haper.put = <T>(url: string, params?: any, options: HaperMethodOptions = {}): HaperCancelablePromise<T> => {
        return haper<T>({
            url,
            method: 'PUT',
            params,
            ...options,
        });
    };

    haper.registerRequestInterceptor = (filters:ClientInterceptorFilters|string, interceptor: RequestInterceptor) => {
        const filtersObject:ClientInterceptorFilters = typeof filters === 'string' ? InterceptorRegistry.parseKeyToFilters(filters) : filters;

        const {
            type,
            method,
            url
        } = filtersObject;

        const requestBaseUrl = url !== '*' ? `${baseUrl}${url}` : url;

        requestInterceptors.registerInterceptor({
            type,
            method,
            url: requestBaseUrl
        }, interceptor);
    };

    haper.registerResponseDataInterceptor = (filters:ClientInterceptorFilters|string, interceptor: ResponseDataInterceptor) => {
        const filtersObject:ClientInterceptorFilters = typeof filters === 'string' ? InterceptorRegistry.parseKeyToFilters(filters) : filters;

        const {
            type,
            method,
            url
        } = filtersObject;

        const requestBaseUrl = url !== '*' ? `${baseUrl}${url}` : url;

        responseInterceptors.registerInterceptor({
            type,
            method,
            url: requestBaseUrl
        }, interceptor);
    };

    return haper;
}

interface HaperApiBuilderOptions {
    faker?: boolean
}

export function createApiBuilder(haper: HaperApi, apiBuilderOptions: HaperApiBuilderOptions = {}) {
    const createMethodFactory = (name: 'get'|'put'|'post'|'delete'|'patch') => <T, P = any>(url: string, options: HaperMethodOptions = {}) => {
        let faker: ((params: Partial<P>) => T)|undefined;

        const fn = (params: P): HaperCancelablePromise<T> => {
            const {
                interpolatedUrl,
                paramsAfterInterpolation
            } = interpolateUrlAndRemoveMatchedVariablesFromParamsObject(url, params);

            if (faker && apiBuilderOptions.faker) {
                const {
                    promise,
                    resolve
                } = createCancelablePromise<T>();

                setTimeout(() => {
                    if (faker)
                        resolve(faker(paramsAfterInterpolation));
                }, Math.round(50 + (Math.random() * 500)));

                return promise;
            }

            return haper[name]<T>(interpolatedUrl, paramsAfterInterpolation, options);
        };

        fn.fake = (fakerFn: (params: Partial<P>) => T) => {
            faker = fakerFn;
            return fn;
        };

        return fn;
    };

    const get = createMethodFactory('get');
    const put = createMethodFactory('put');
    const post = createMethodFactory('post');
    const _delete = createMethodFactory('delete');
    const patch = createMethodFactory('patch');

    return {
        get,
        put,
        post,
        delete: _delete,
        patch
    };
}

// const a = createApiBuilder(createHaper());
//
// interface Device {
//     id: string
//     name: string
//     model: string
// }
//
// const getList = a.get<Device[], { name: string }>('/device/:id').fake((params) => {
//     return [
//         {
//             id: 'ddfdf',
//             name: 'srer',
//             model: 'fdf'
//         }
//     ]
// });
//
// async function m() {
//     const list = await getList({
//         name: '',
//     });
//
//
// }
