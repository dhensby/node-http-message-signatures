import {
    BareItem,
    parseDictionary,
    parseItem,
    serializeItem,
    serializeList,
    Dictionary as DictionaryType,
    ByteSequence,
    serializeDictionary,
    parseList,
    Parameters,
} from 'structured-headers';
import { Dictionary, parseHeader } from '../structured-header';

export interface Request {
    method: string;
    url: string | URL;
    headers: Record<string, string | string[]>;
}

export interface Response {
    status: number;
    headers: Record<string, string | string[]>;
}

export type Signer = (data: Buffer) => Promise<Buffer>;

export interface SigningKey {
    id?: string;
    alg?: string;
    sign: Signer;
}

export interface SigningParameters {
    created?: Date | null;
    expires?: Date;
    nonce?: string;
    alg?: string;
    keyid?: string;
    context?: string;
    [param: string]: string | Date | null | undefined;
}

const defaultParams = [
    'keyid',
    'alg',
    'created',
    'expires',
];

export interface SigningConfig {
    key: SigningKey;
    name?: string;
    params?: string[];
    fields?: string[];
    paramValues?: SigningParameters,
}

function isRequest(obj: Request | Response): obj is Request {
    return !!(obj as Request).method;
}

/**
 * This allows consumers of the library to supply field specifications that aren't
 * strictly "structured fields". Really a string must start with a `"` but that won't
 * tend to happen in our configs.
 *
 * @param {string} input
 * @returns {string}
 */
function quoteString(input: string): string {
    // if it's not quoted, attempt to quote
    if (!input.startsWith('"')) {
        // try to split the structured field
        const [name, ...rest] = input.split(';');
        // no params, just quote the whole thing
        if (!rest.length) {
            return `"${name}"`;
        }
        // quote the first part and put the rest back as it was
        return `"${name}";${rest.join(';')}`;
    }
    return input;
}

export function deriveComponent(component: string, res: Response, req?: Request): string[];
export function deriveComponent(component: string, req: Request): string[];

/**
 * Components can be derived from requests or responses (which can also be bound to their request).
 * The signature is essentially (component, signingSubject, supplementaryData)
 *
 * @todo - Allow consumers to register their own component parser somehow
 */
export function deriveComponent(component: string, message: Request | Response, req?: Request): string[] {
    const [componentName, params] = parseItem(quoteString(component));
    // switch the context of the signing data depending on if the `req` flag was passed
    const context = params.has('req') ? req : message;
    if (!context) {
        throw new Error('Missing request in request-response bound component');
    }
    switch (componentName.toString().toLowerCase()) {
        case '@method':
            if (!isRequest(context)) {
                throw new Error('Cannot derive @method from response');
            }
            return [context.method.toUpperCase()];
        case '@target-uri': {
            if (!isRequest(context)) {
                throw new Error('Cannot derive @target-url on response');
            }
            return [context.url.toString()];
        }
        case '@authority': {
            if (!isRequest(context)) {
                throw new Error('Cannot derive @authority on response');
            }
            const { port, protocol, hostname } = typeof context.url === 'string' ? new URL(context.url) : context.url;
            let authority = hostname.toLowerCase();
            if (port && (protocol === 'http:' && port !== '80' || protocol === 'https:' && port !== '443')) {
                authority += `:${port}`;
            }
            return [authority];
        }
        case '@scheme': {
            if (!isRequest(context)) {
                throw new Error('Cannot derive @scheme on response');
            }
            const { protocol } = typeof context.url === 'string' ? new URL(context.url) : context.url;
            return [protocol.slice(0, -1)];
        }
        case '@request-target': {
            if (!isRequest(context)) {
                throw new Error('Cannot derive @request-target on response');
            }
            const { pathname, search } = typeof context.url === 'string' ? new URL(context.url) : context.url;
            // this is really sketchy because the request-target is actually what is in the raw HTTP header
            // so one should avoid signing this value as the application layer just can't know how this
            // is formatted
            return [`${pathname}${search}`];
        }
        case '@path': {
            if (!isRequest(context)) {
                throw new Error('Cannot derive @scheme on response');
            }
            const {pathname} = typeof context.url === 'string' ? new URL(context.url) : context.url;
            return [decodeURI(pathname)];
        }
        case '@query': {
            if (!isRequest(context)) {
                throw new Error('Cannot derive @scheme on response');
            }
            const { search } = typeof context.url === 'string' ? new URL(context.url) : context.url;
            // https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-2.2.7
            // absent query params means use `?`
            return [decodeURI(search) || '?'];
        }
        case '@status': {
            if (isRequest(context)) {
                throw new Error('Cannot obtain @status component for requests');
            }
            return [context.status.toString()];
        }
        case '@query-param': {
            if (!isRequest(context)) {
                throw new Error('Cannot derive @scheme on response');
            }
            const { searchParams } = typeof context.url === 'string' ? new URL(context.url) : context.url;
            if (!params.has('name')) {
                throw new Error('@query-param must have a named parameter');
            }
            const name = (params.get('name') as BareItem).toString();
            if (!searchParams.has(name)) {
                throw new Error(`Expected query parameter "${name}" not found`);
            }
            return searchParams.getAll(name);
        }
        default:
            throw new Error(`Unsupported component "${component}"`);
    }
}

export function extractHeader(header: string, res: Response, req?: Request): string[];
export function extractHeader(header: string, req: Request): string[];

export function extractHeader(header: string, { headers }: Request | Response, req?: Request): string[] {
    const [headerName, params] = parseItem(quoteString(header));
    const context = params.has('req') ? req?.headers : headers;
    if (!context) {
        throw new Error('Missing request in request-response bound component');
    }
    const lcHeaderName = headerName.toString().toLowerCase();
    const headerTuple = Object.entries(context).find(([name]) => name.toLowerCase() === lcHeaderName);
    if (!headerTuple) {
        throw new Error(`No header ${headerName} found in headers`);
    }
    const values = (Array.isArray(headerTuple[1]) ? headerTuple[1] : [headerTuple[1]]);
    if (params.has('bs') && params.has('sf')) {
        throw new Error('Invalid combination of parameters');
    }
    if (params.has('sf') || params.has('key')) {
        // strict encoding of field
        // I think this is wrong as the values need to be combined first and then parsed,
        // not parsed one-by-one
        const value = values.join(', ');
        const parsed = parseHeader(value);
        if (params.has('key') && !(parsed instanceof Dictionary)) {
            throw new Error('Unable to parse header as dictionary');
        }
        if (params.has('key')) {
            const key = (params.get('key') as BareItem).toString();
            if (!(parsed as Dictionary).has(key)) {
                throw new Error(`Unable to find key "${key}" in structured field`);
            }
            return [(parsed as Dictionary).get(key) as string];
        }
        return [parsed.toString()];
    }
    if (params.has('bs')) {
        return [values.map((val) => {
            const encoded = Buffer.from(val.trim().replace(/\n\s*/gm, ' '));
            return `:${encoded.toString('base64')}:`
        }).join(', ')];
    }
    // raw encoding
    return [values.map((val) => val.trim().replace(/\n\s*/gm, ' ')).join(', ')];
}

export function createSignatureBase(config: SigningConfig, res: Response, req?: Request): [string, string[]][];
export function createSignatureBase(config: SigningConfig, req: Request): [string, string[]][];

export function createSignatureBase(config: SigningConfig, res: Request | Response, req?: Request): [string, string[]][] {
    return (config.fields ?? []).reduce<[string, string[]][]>((base, fieldName) => {
        const [field, params] = parseItem(quoteString(fieldName));
        const lcFieldName = field.toString().toLowerCase();
        if (lcFieldName !== '@signature-params') {
            const value = fieldName.startsWith('@') ? deriveComponent(fieldName, res as Response, req) : extractHeader(fieldName, res as Response, req);
            base.push([serializeItem([lcFieldName, params]), value]);
        }
        return base;
    }, []);
}

export function formatSignatureBase(base: [string, string[]][]): string {
    return base.map(([key, value]) => {
        const quotedKey = serializeItem(parseItem(quoteString(key)));
        return value.map((val) => `${quotedKey}: ${val}`).join('\n');
    }).join('\n');
}

export function createSigningParameters(config: SigningConfig): Parameters {
    const now = new Date();
    return (config.params ?? defaultParams).reduce<Parameters>((params, paramName) => {
        let value: string | number = '';
        switch (paramName) {
            case 'created':
                // created is optional but recommended. If created is supplied but is null, that's an explicit
                // instruction to *not* include the created parameter
                if (config.paramValues?.created !== null) {
                    const created: Date = config.paramValues?.created ?? now;
                    value = Math.floor(created.getTime() / 1000);
                }
                break;
            case 'expires':
                // attempt to obtain an explicit expires time, otherwise create one that is 300 seconds after
                // creation. Don't add an expires time if there is no created time
                if (config.paramValues?.expires || config.paramValues?.created !== null) {
                    const expires = config.paramValues?.expires ?? new Date((config.paramValues?.created ?? now).getTime() + 300000);
                    value = Math.floor(expires.getTime() / 1000);
                }
                break;
            case 'keyid': {
                // attempt to obtain the keyid omit if missing
                const kid = config.paramValues?.keyid ?? config.key.id ?? null;
                if (kid) {
                    value = kid.toString();
                }
                break;
            }
            case 'alg': {
                const alg = config.paramValues?.alg ?? config.key.alg ?? null;
                if (alg) {
                    value = alg.toString();
                }
                break;
            }
            default:
                if (config.paramValues?.[paramName] instanceof Date) {
                    value = Math.floor((config.paramValues[paramName] as Date).getTime() / 1000).toString();
                } else if (config.paramValues?.[paramName]) {
                    value = config.paramValues[paramName] as string;
                }
        }
        if (value) {
            params.set(paramName, value);
        }
        return params;
    }, new Map());
}

export function augmentHeaders(headers: Record<string, string | string[]>, signature: Buffer, signatureInput: string, name?: string): Record<string, string | string[]> {
    let signatureHeaderName = 'Signature';
    let signatureInputHeaderName = 'Signature-Input';
    let signatureHeader: DictionaryType = new Map();
    let inputHeader: DictionaryType = new Map();
    // check to see if there are already signature/signature-input headers
    // if there are we want to store the current (case-sensitive) name of the header
    // and we want to parse out the current values so we can append our new signature
    for (const header in headers) {
        switch (header.toLowerCase()) {
            case 'signature': {
                signatureHeaderName = header;
                signatureHeader = parseDictionary(Array.isArray(headers[header]) ? (headers[header] as string[]).join(', ') : headers[header] as string);
                break;
            }
            case 'signature-input':
                signatureInputHeaderName = header;
                inputHeader = parseDictionary(Array.isArray(headers[header]) ? (headers[header] as string[]).join(', ') : headers[header] as string);
                break;
        }
    }
    // find a unique signature name for the header. Check if any existing headers already use
    // the name we intend to use, if there are, add incrementing numbers to the signature name
    // until we have a unique name to use
    let signatureName = name ?? 'sig';
    if (signatureHeader.has(signatureName) || inputHeader.has(signatureName)) {
        let count = 0;
        while (signatureHeader?.has(`${signatureName}${count}`) || inputHeader?.has(`${signatureName}${count}`)) {
            count++;
        }
        signatureName += count.toString();
    }
    // append our signature and signature-inputs to the headers and return
    signatureHeader.set(signatureName, [new ByteSequence(signature.toString('base64')), new Map()]);
    inputHeader.set(signatureName, parseList(signatureInput)[0]);
    return {
        ...headers,
        [signatureHeaderName]: serializeDictionary(signatureHeader),
        [signatureInputHeaderName]: serializeDictionary(inputHeader),
    };
}

export async function signMessage<T extends Response = Response, U extends Request = Request>(config: SigningConfig, res: T, req?: U): Promise<T>;
export async function signMessage<T extends Request = Request>(config: SigningConfig, req: T): Promise<T>;

export async function signMessage<T extends Request | Response = Request | Response, U extends Request = Request>(config: SigningConfig, message: T, req?: U): Promise<T> {
    const signingParameters = createSigningParameters(config);
    const signatureBase = createSignatureBase(config, message as Response, req);
    const signatureInput = serializeList([
        [
            signatureBase.map(([item]) => parseItem(item)),
            signingParameters,
        ],
    ]);
    signatureBase.push(['"@signature-params"', [signatureInput]]);
    const base = formatSignatureBase(signatureBase);
    // call sign
    const signature = await config.key.sign(Buffer.from(base));
    return {
        ...message,
        headers: augmentHeaders({...message.headers}, signature, signatureInput, config.name),
    };
}
