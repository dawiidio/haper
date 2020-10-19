import {
    HaperApi
} from './src/Interfaces';

declare namespace haper {
    export function createHaper({ baseUrl }: { baseUrl: string }): HaperApi
}

export = haper;