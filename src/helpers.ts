import { HaperCancelablePromise, HaperInternalData, HaperRequestContentType, HaperRequestOptions } from './index.d';

const haperRequestContentTypeToHeaderContentTypeMap: Record<HaperRequestContentType, string> = {
    json: 'application/json',
};

export const interpolateUrlAndRemoveMatchedVariablesFromParamsObject = <P extends {[key: string]: any}>(url: string, params: P) => {
    const urlParamsKeys = url.match(/:\w+/gmi);
    const allParamsObjectKeys = Object.keys(params);
    let paramsAfterInterpolation: Partial<P> = {};
    let interpolatedUrl = url;

    if (urlParamsKeys) {
        const urlParamsKeysWithoutPrefix = urlParamsKeys.map(val => val.replace(':', ''));
        const l = allParamsObjectKeys.length;

        for (let i = 0; i < l; ++i) {
            const key = allParamsObjectKeys[i];
            const urlParamIdx = urlParamsKeysWithoutPrefix.findIndex((predicate) => predicate === key);

            if (urlParamIdx > -1) {
                interpolatedUrl = interpolatedUrl.replace(urlParamsKeys[urlParamIdx], params[key]);
            } else {
                //@ts-ignore
                paramsAfterInterpolation[key] = params[key];
            }
        }
    }
    else {
        paramsAfterInterpolation = params;
    }

    return {
        paramsAfterInterpolation,
        interpolatedUrl
    }
};

export function createCancelablePromise<T>() {
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

export function createJSONRequest(options:HaperRequestOptions, internalData: HaperInternalData): Request {
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

export function getRequestFactory(requestOptions: HaperRequestOptions):(requestOptions: HaperRequestOptions, internalData: HaperInternalData) => Request {
    if (requestOptions.contentType === 'json') {
        return createJSONRequest;
    }
    //todo support for files and other types
    else {
        return createJSONRequest;
    }
}

export function getResponseBodyParser(requestOptions: HaperRequestOptions):(response: Response) => any {
    return (response => response[requestOptions.responseType ?? 'json']())
}

export function getUrl(baseUrl:string, options:HaperRequestOptions) {
    if (!options.method || options.method.toUpperCase() === 'GET') {
        let urlSearchParams: URLSearchParams = new URLSearchParams(options.params ?? {});

        return `${baseUrl}?${urlSearchParams.toString()}`;
    }

    return baseUrl;
}
