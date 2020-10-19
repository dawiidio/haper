import {
    ClientInterceptorFilters, HaperApi, HaperCancelablePromise, HaperInternalData, HaperMethodOptions,
    HaperRequestContentType, HaperRequestOptions,
    HaperResponseType,
    HTTPMethods,
    RequestInterceptor, ResponseDataInterceptor,
} from './Interfaces';

import {
    InterceptorRegistry,
    RequestInterceptorRegistry,
    ResponseDataInterceptorRegistry,
} from './InterceptorRegistry';

interface HaperFactoryOptions<BaseDataShape = any> {
    baseUrl?: string
}

const haperRequestContentTypeToHeaderContentTypeMap: Record<HaperRequestContentType, string> = {
    json: 'application/json',
};

function createCancelablePromise<T>() {
    const controller = new AbortController();
    const signal = controller.signal;
    let resolve: (value?: T | PromiseLike<T>) => void;
    let reject: (reason?: any) => void;

    const originalPromise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    const cancel = () => {
        controller.abort();
        reject('cancel');
    };

    const promise: HaperCancelablePromise<T> = {
        then: (...all) => originalPromise.then(...all),
        catch: (...all) => originalPromise.catch(...all),
        finally: (...all) => originalPromise.finally(...all),
        cancel,
        [Symbol.toStringTag]: originalPromise[Symbol.toStringTag]
    };

    return {
        signal,
        promise,
        //@ts-ignore
        resolve,
        //@ts-ignore
        reject,
    };
}

function createJSONRequest(options:HaperRequestOptions, internalData: HaperInternalData): Request {
    let {
        responseType,
        params = null,
        method = 'GET',
        url,
        contentType = 'json',
        ...rawRequestOptions
    }: HaperRequestOptions = options;

    const extendedOptions: RequestInit = {
        ...rawRequestOptions,
        method, // *GET, POST, PUT, DELETE, etc.
        // mode: 'cors', // no-cors, cors, *same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        // credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': haperRequestContentTypeToHeaderContentTypeMap[contentType],
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow', // manual, *follow, error
        referrer: 'no-referrer', // no-referrer, *client
        body: method !== 'GET' ? JSON.stringify(params) : undefined, // body data type must match "Content-Type" header,
        signal: internalData.signal,
    };

    return new Request(internalData.requestFinalUrl, extendedOptions);
}

function getRequestFactory(requestOptions: HaperRequestOptions):(requestOptions: HaperRequestOptions, internalData: HaperInternalData) => Request {
    if (requestOptions.contentType === 'json') {
        return createJSONRequest;
    }
    //todo support for files and other types
    else {
        return createJSONRequest;
    }
}

function getResponseBodyParser(requestOptions: HaperRequestOptions):(response: Response) => any {
    return (response => response[requestOptions.responseType ?? 'json']())
}

function getUrl(baseUrl:string, options:HaperRequestOptions) {
    if (!options.method || options.method.toUpperCase() === 'GET') {
        let urlSearchParams: URLSearchParams = new URLSearchParams(options.params ?? {});

        return `${baseUrl}?${urlSearchParams.toString()}`;
    }

    return baseUrl;
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

    haper.post = <T>(url: string, data?: any, options: HaperMethodOptions = {}): HaperCancelablePromise<T> => {
        return haper<T>({
            url,
            method: 'POST',
            ...options,
        });
    };

    haper.delete = <T>(url: string, data?: any, options: HaperMethodOptions = {}): HaperCancelablePromise<T> => {
        return haper<T>({
            url,
            method: 'DELETE',
            ...options,
        });
    };

    haper.patch = <T>(url: string, data?: any, options: HaperMethodOptions = {}): HaperCancelablePromise<T> => {
        return haper<T>({
            url,
            method: 'PATCH',
            ...options,
        });
    };

    haper.put = <T>(url: string, data?: any, options: HaperMethodOptions = {}): HaperCancelablePromise<T> => {
        return haper<T>({
            url,
            method: 'PUT',
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