import { HTTPMethods, InterceptorFilters, RequestInterceptor, ResponseDataInterceptor } from './index.d';

export abstract class InterceptorRegistry<InterceptorType> {
    static readonly keySeparator = ' ';
    private registry: Map<string, Array<InterceptorType>> = new Map();

    static parseFiltersToKey(filters: InterceptorFilters): string {
        return [filters.method?.toUpperCase() || '*', filters.url, filters.type || '*'].join(InterceptorRegistry.keySeparator);
    }

    static parseKeyToFilters(key: string): InterceptorFilters {
        const [method, url, type] = key.split(InterceptorRegistry.keySeparator);

        return {
            method,
            url,
            type,
        } as InterceptorFilters;
    }

    static compareFilters(interceptorFilters: InterceptorFilters, target: InterceptorFilters): boolean {
        let matchingBoolValue = interceptorFilters.url === target.url || interceptorFilters.url === '*';

        if (matchingBoolValue) {
            if (interceptorFilters.method)
                matchingBoolValue = matchingBoolValue && (interceptorFilters.method === target.method || interceptorFilters.method === '*');

            if (interceptorFilters.type)
                matchingBoolValue = matchingBoolValue && (interceptorFilters.type === target.type || interceptorFilters.type === '*');
        }

        return matchingBoolValue;
    }

    registerInterceptor(interceptorFilters: InterceptorFilters, interceptor: InterceptorType) {
        const key = InterceptorRegistry.parseFiltersToKey(interceptorFilters);
        let currentValue:Array<InterceptorType>|undefined = this.registry.get(key);

        if (!currentValue)
            currentValue = [];

        this.registry.set(InterceptorRegistry.parseFiltersToKey(interceptorFilters), [
            interceptor,
            ...currentValue
        ]);
    }

    getAllMatchingInterceptors(filters: InterceptorFilters):Array<InterceptorType> {
        return Array
            .from(this.registry)
            .filter(([key]) => {
                const keyFilters = InterceptorRegistry.parseKeyToFilters(key);

                return InterceptorRegistry.compareFilters(keyFilters, filters);
            })
            .map(([, val]) => val)
            .flat();
    }
}


export class RequestInterceptorRegistry extends InterceptorRegistry<RequestInterceptor> {
    getInterceptorsForRequest(request: Request) {
        const method = request.method.toUpperCase() as HTTPMethods;
        const url = request.url;
        const type = request.headers.get('Content-Type');

        return this.getAllMatchingInterceptors({
            method,
            url,
            type: type ?? undefined
        });
    }

    pipe(request: Request): Request {
        return this.getInterceptorsForRequest(request).reduce((acc, interceptor) => {
            const returnedRequest = interceptor(request);

            return returnedRequest ? returnedRequest : request;
        }, request);
    }
}

export class ResponseDataInterceptorRegistry extends InterceptorRegistry<ResponseDataInterceptor> {
    pipe<T>(filters: InterceptorFilters, data: T) {
        const interceptors = this.getAllMatchingInterceptors(filters);

        let lastValue:T = data;

        for (const interceptor of interceptors) {
            lastValue = interceptor(lastValue) ?? lastValue;
        }

        return lastValue;
    }
}