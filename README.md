# Haper
Haper is small library, just a syntax sugar with 0 dependencies for native window.fetch

## Install
```sh
npm install --save haper
```

## Usage
Quick example

```typescript
import { createHaper } from 'haper';

const haper = createHaper({
    baseUrl: 'http://localhost:3000'
});

interface User {
  name: string
  surname: string
  email: string
}

(async () => {
  const user = await haper.get<User>('/user');

  console.log(user.name, user.surname);
})();
```

#### Other methods
```typescript
import { createHaper } from 'haper';

const haper = createHaper({
    baseUrl: 'http://localhost:3000'
});

(async () => {
    await haper.get('/user/1');
    await haper.post('/user', {
        name: 'Dawid',
        surname: 'Wojda',
        email: 'dawid@test.com'
    });
    await haper.delete('/user/1');
    await haper.put('/user/1', {
        name: 'David',
    });
    await haper.patch('/user/1', {
        name: 'David',
    });
})();
```

### Api builder approach
Haper exports function `createApiBuilder` which enables different approach for defining 
API endpoints. That approach allows you to create endpoints with corresponding models,
parameters and faker functions in one place. But code example express more than words so 
here we go: 

```typescript jsx
import {
    createHaper,
    createApiBuilder,
} from 'haper';

export const haper = createHaper({
    baseUrl: 'http://localhost:3000/api'
});

const apiBuilder = createApiBuilder(haper, {
    faker: false, // if true haper will call fake functions (if defined) to get the data instead of talking to server
});

// very simple example of params object (DTO object)
interface AddressDto {
  city: string;
  street: string;
}

// also very simple interface of model returned from endpoints
interface Address {
  id: number;
  city: string;
  country: string;
}

export const getAddressList = apiBuilder
    .get<Array<Address>, {}>('address')
    .fake(() => {
        return [
            {
                id: 1,
                city: 'Warsaw',
                country: 'Poland'
            },
            {
                id: 1,
                city: 'Vilnius',
                country: 'Lithuania'
            },
        ];
    });

// here we have an important example of defining url variables
// Endpoint url is interpolated with values passed in params object
// then matched values will be deleted from params object before send to server
// to match base dto object interface
export const updateAddress = apiBuilder
    .put<Address, AddressDto & { userId: number }>('user/:userId/address')
    .fake(() => {
        return {
            id: 1,
            city: 'Warsaw',
            country: 'Poland'
        };
    });

// usage of defined endpoints
async function main() {
    const address = await updateAddress({
        userId: 8, // userId will match url param so it will be deleted and server receives only city and country keys 
        city: 'Prague',
        country: 'Czech Republic'
    });
    
    console.log(address);
}
```

#### canceling request
Haper methods returns promises with additional method `cancel()`
which comes useful in SPA applications when your component doesn't 
need data it's asked for and simply can cancel request before resolve

```typescript
import { createHaper } from 'haper';

const haper = createHaper({
    baseUrl: 'http://localhost:3000'
});

interface User {
  name: string
  surname: string
  email: string
}

(async () => {
  const promise = haper.get<User>('/user');

  promise
    .then((user) => {
        console.log(user.name, user.surname);
    })
    .catch(reason => {
        if (reason === 'cancel') {
            console.log('Request canceled');
        }
    })

  promise.cancel();
})();
```

#### Interceptors
There are a few cases when you may need interceptors, for example:
- add `Authorization` header to every Request
- search for `error` key in backend response
- and probably a few more

interceptor in Haper works as pure functions which may process request or response and is
registered via two methods available in Haper instance:
- `registerRequestInterceptor` - process request
- `registerResponseDataInterceptor` - process response data

Interceptors have very simple filters system, for example if you want to intercept every
data from all responses you may do something like this:

```typescript
import { createHaper } from 'haper';

const haper = createHaper({
    baseUrl: 'http://localhost:3000'
});

haper.registerResponseDataInterceptor('* * *', (data) => {
    console.log(data);

    return data;
});
```

Three asterisks in method call `* * *` are filters. Asterisks depends on number means:
1. method - supported values `'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE' | '*'`
2. url - absolute url for filtered request. If baseUrl were specified on instance then all
urls will be relative to it
3. data type - response or request data type, for now supported values are: `json` for requests
and `'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text'` for responses 

Interceptors works in "pipe" mode - every interceptor matched for request or response 
gets output data from previous to its input, so final data might be composed from many
chained interceptors

Interceptor url may contains interpolation placeholders which starts with ":", for example:
`/user/:id/profile` will be matched with `/user/1/profile`

Examples:

1. Add authorization header to all `POST` requests
```typescript
import { createHaper } from 'haper';

const haper = createHaper({
    baseUrl: 'http://localhost:3000'
});

const secretToken = 'XcdffrYUfd334ffsdf09sMdj2';

haper.registerRequestInterceptor('POST * *', request => {
    request.headers.append('Authorization', `Bearer ${secretToken}`);
});
```

2. Search for `error` key in data returned from all `/user` endpoints and throw error if present
```typescript
import { createHaper } from 'haper';

const haper = createHaper({
    baseUrl: 'http://localhost:3000'
});

interface RestData {
  data: any,
  error?: string
}

haper.registerResponseDataInterceptor('* /user *', (data:RestData) => {
    if (data.error) {
      throw new Error(`Error from server: ${data.error}`);
    }
    
    return data.data;
});
```

## Roadmap
- [x] Faker functions
- [ ] Support for other data types than simple JSON (eg. text, formData)
- [ ] Support for file uploading
  - [ ] progress
  - [ ] keep promise-like api
- [ ] Support for file downloading (?)
- [ ] Improve filters system
- [ ] In memory(?) cache system
- [ ] Rethink interceptors concept, especially with types in mind
