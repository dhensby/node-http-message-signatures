import { parseItem } from 'structured-headers';
import { Algorithm } from '../algorithm';

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
export type Verifier = (data: Buffer, signature: Buffer, parameters: SignatureParameters) => Promise<boolean | null>;

export interface SigningKey {
    id?: string;
    alg?: string;
    sign: Signer;
}

/**
 * The signature parameters to include in signing
 */
export interface SignatureParameters {
    /**
     * The created time for the signature. `null` indicates not to populate the `created` time
     * default: Date.now()
     */
    created?: Date | null;
    /**
     * The time the signature should be deemed to have expired
     * default: Date.now() + 5 mins
     */
    expires?: Date;
    /**
     * A nonce for the request
     */
    nonce?: string;
    /**
     * The algorithm the signature is signed with (overrides the alg provided by the signing key)
     */
    alg?: string;
    /**
     * The key id the signature is signed with (overrides the keyid provided by the signing key)
     */
    keyid?: string;
    /**
     * A context parameter for the signature
     */
    context?: string;
    [param: string]: Date | number | string | null | undefined;
}

/**
 * Default parameters to use when signing a request if none are supplied by the consumer
 */
const defaultParams = [
    'keyid',
    'alg',
    'created',
    'expires',
];

export interface SignConfig {
    key: SigningKey;
    /**
     * The name to try to use for the signature
     * Default: 'sig'
     */
    name?: string;
    /**
     * The parameters to add to the signature
     * Default: see defaultParams
     */
    params?: string[];
    /**
     * The HTTP fields / derived component names to sign
     * Default: none
     */
    fields?: string[];
    /**
     * Specified parameter values to use (eg: created time, expires time, etc)
     * This can be used by consumers to override the default expiration time or explicitly opt-out
     * of adding creation time (by setting `created: null`)
     */
    paramValues?: SignatureParameters,
}

/**
 * Options when verifying signatures
 */
export interface VerifyConfig {
    verifier: Verifier;
    /**
     * A maximum age for the signature
     * Default: Date.now() + tolerance
     */
    notAfter?: Date | number;
    /**
     * The maximum age of the signature - this overrides the `expires` value for the signature
     * if provided
     */
    maxAge?: number;
    /**
     * A clock tolerance when verifying created/expires times
     * Default: 0
     */
    tolerance?: number;
    /**
     * Any parameters that *must* be in the signature (eg: require a created time)
     * Default: []
     */
    requiredParams?: string[];
    /**
     * Any fields that *must* be in the signature (eg: Authorization, Digest, etc)
     * Default: []
     */
    requiredFields?: string[];
    /**
     * Verify every signature in the request. By default, only 1 signature will need to be valid
     * for the verification to pass.
     * Default: false
     */
    all?: boolean;
}

function mapCavageAlgorithm(alg: string): Algorithm {
    switch (alg.toLowerCase()) {
        case 'hs2019':
            return 'rsa-pss-sha512';
        case 'rsa-sha1':
            return 'rsa-v1_5-sha1';
        case 'rsa-sha256':
            return 'rsa-v1_5-sha256';
        case 'ecdsa-sha256':
            return 'ecdsa-p256-sha256';
        default:
            return alg;
    }
}

function mapHttpbisAlgorithm(alg: Algorithm): string {
    switch (alg.toLowerCase()) {
        case 'rsa-pss-sha512':
            return 'hs2019';
        case 'rsa-v1_5-sha1':
            return 'rsa-sha1';
        case 'rsa-v1_5-sha256':
            return 'rsa-sha256';
        case 'ecdsa-p256-sha256':
            return 'ecdsa-sha256';
        default:
            return alg;
    }
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

/**
 * Components can be derived from requests or responses (which can also be bound to their request).
 * The signature is essentially (component, signingSubject, supplementaryData)
 *
 * @todo - Allow consumers to register their own component parser somehow
 */
export function deriveComponent(component: string, message: Request | Response): string[] {
    const [componentName, params] = parseItem(quoteString(component));
    if (params.size) {
        throw new Error('Component parameters are not supported in cavage');
    }
    switch (componentName.toString().toLowerCase()) {
        case '@request-target': {
            if (!isRequest(message)) {
                throw new Error('Cannot derive @request-target on response');
            }
            const { pathname, search } = typeof message.url === 'string' ? new URL(message.url) : message.url;
            // this is really sketchy because the request-target is actually what is in the raw HTTP header
            // so one should avoid signing this value as the application layer just can't know how this
            // is formatted
            return [`${message.method.toLowerCase()} ${pathname}${search}`];
        }
        default:
            throw new Error(`Unsupported component "${component}"`);
    }
}

export function extractHeader(header: string, { headers }: Request | Response): string[] {
    const [headerName, params] = parseItem(quoteString(header));
    if (params.size) {
        throw new Error('Field parameters are not supported in cavage');
    }
    const lcHeaderName = headerName.toString().toLowerCase();
    const headerTuple = Object.entries(headers).find(([name]) => name.toLowerCase() === lcHeaderName);
    if (!headerTuple) {
        throw new Error(`No header ${headerName} found in headers`);
    }
    return [(Array.isArray(headerTuple[1]) ? headerTuple[1] : [headerTuple[1]]).map((val) => val.trim().replace(/\n\s*/gm, ' ')).join(', ')];
}

export function formatSignatureBase(base: [string, string[]][]): string {
    return base.reduce<string[]>((accum, [key, value]) => {
        const [keyName] = parseItem(quoteString(key));
        const lcKey = (keyName as string).toLowerCase();
        if (lcKey.startsWith('@')) {
            accum.push(`(${lcKey.slice(1)}): ${value.join(', ')}`);
        } else {
            accum.push(`${key.toLowerCase()}: ${value.join(', ')}`);
        }
        return accum;
    }, []).join('\n');
}

export function createSigningParameters(config: SignConfig): Map<string, string | number> {
    const now = new Date();
    return (config.params ?? defaultParams).reduce<Map<string, string | number>>((params, paramName) => {
        let value: string | number = '';
        switch (paramName.toLowerCase()) {
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

export function createSignatureBase(fields: string[], message: Request | Response, signingParameters: Map<string, string | number>): [string, string[]][] {
    return fields.reduce<[string, string[]][]>((base, fieldName) => {
        const [field, params] = parseItem(quoteString(fieldName));
        if (params.size) {
            throw new Error('Field parameters are not supported');
        }
        const lcFieldName = field.toString().toLowerCase();
        switch (lcFieldName) {
            case '@created':
                if (signingParameters.has('created')) {
                    base.push(['(created)', [signingParameters.get('created') as string]]);
                }
                break;
            case '@expires':
                if (signingParameters.has('expires')) {
                    base.push(['(expires)', [signingParameters.get('expires') as string]]);
                }
                break;
            case '@request-target': {
                if (!isRequest(message)) {
                    throw new Error('Cannot read target of response');
                }
                const { pathname, search } = typeof message.url === 'string' ? new URL(message.url) : message.url;
                base.push(['(request-target)', [`${message.method} ${pathname}${search}`]]);
                break;
            }
            default:
                base.push([lcFieldName, extractHeader(lcFieldName, message)]);
        }
        return base;
    }, []);
}

export async function signMessage<T extends Request | Response = Request | Response>(config: SignConfig, message: T): Promise<T> {
    const signingParameters = createSigningParameters(config);
    const signatureBase = createSignatureBase(config.fields ?? [], message, signingParameters);
    const base = formatSignatureBase(signatureBase);
    // call sign
    const signature = await config.key.sign(Buffer.from(base));
    const headerNames = signatureBase.map(([key]) => key);
    const header = [
        ...Array.from(signingParameters.entries()).map(([name, value]) => {
            if (name === 'alg') {
                return `algorithm="${mapHttpbisAlgorithm(value as string)}"`;
            }
            if (name === 'keyid') {
                return `keyId="${value}"`;
            }
            if (typeof value === 'number') {
                return `${name}=${value}`;
            }
            return `${name}="${value.toString()}"`
        }),
        `headers="${headerNames.join(' ')}"`,
        `signature="${signature.toString('base64')}"`,
    ].join(', ');
    return {
        ...message,
        headers: {
            ...message.headers,
            Signature: header,
        },
    };
}

export async function verifyMessage(config: VerifyConfig, message: Request | Response): Promise<boolean | null> {
    const header = Object.entries(message.headers).find(([name]) => name.toLowerCase() === 'signature');
    if (!header) {
        return null;
    }
    const parsedHeader = (Array.isArray(header[1]) ? header[1].join(', ') : header[1]).split(',').reduce((parts, value) => {
        const [key, ...values] = value.trim().split('=');
        if (parts.has(key)) {
            throw new Error('Same parameter defined repeatedly');
        }
        const val = values.join('=').replace(/^"(.*)"$/, '$1');
        switch (key.toLowerCase()) {
            case 'created':
            case 'expires':
                parts.set(key, parseInt(val, 10));
                break;
            default:
                parts.set(key, val);
        }
        return parts;
    }, new Map());
    if (!parsedHeader.has('signature')) {
        throw new Error('Missing signature from header');
    }
    const baseParts = new Map(createSignatureBase((parsedHeader.get('headers') ?? '').split(' ').map((component: string) => {
        return component.toLowerCase().replace(/^\((.*)\)$/, '@$1');
    }), message, parsedHeader));
    const base = formatSignatureBase(Array.from(baseParts.entries()));
    const now = Math.floor(Date.now() / 1000);
    const tolerance = config.tolerance ?? 0;
    const notAfter = config.notAfter instanceof Date ? Math.floor(config.notAfter.getTime() / 1000) : config.notAfter ?? now;
    const maxAge = config.maxAge ?? null;
    const requiredParams = config.requiredParams ?? [];
    const requiredFields = config.requiredFields ?? [];
    const hasRequiredParams = requiredParams.every((param) => baseParts.has(param));
    if (!hasRequiredParams) {
        return false;
    }
    // this could be tricky, what if we say "@method" but there is "@method;req"
    const hasRequiredFields = requiredFields.every((field) => {
        return parsedHeader.has(field.toLowerCase().replace(/^@(.*)/, '($1)'));
    });
    if (!hasRequiredFields) {
        return false;
    }
    if (parsedHeader.has('created')) {
        const created = parsedHeader.get('created') as number - tolerance;
        // maxAge overrides expires.
        // signature is older than maxAge
        if (maxAge && created - now > maxAge) {
            return false;
        }
        // created after the allowed time (ie: created in the future)
        if (created > notAfter) {
            return false;
        }
    }
    if (parsedHeader.has('expires')) {
        const expires = parsedHeader.get('expires') as number + tolerance;
        // expired signature
        if (expires > now) {
            return false;
        }
    }
    // now look to verify the signature! Build the expected "signing base" and verify it!
    return config.verifier(Buffer.from(base), Buffer.from(parsedHeader.get('signature'), 'base64'), Array.from(parsedHeader.entries()).reduce((params, [key, value]) => {
        let keyName = key;
        let val: Date | number | string;
        switch (key.toLowerCase()) {
            case 'created':
            case 'expires':
                val = new Date((value as number) * 1000);
                break;
            case 'signature':
            case 'headers':
                return params;
            case 'algorithm':
                keyName = 'alg';
                val = mapCavageAlgorithm(value);
                break;
            case 'keyid':
                keyName = 'keyid';
                val = value;
                break;
                // no break
            default: {
                if (typeof value === 'string' || typeof value=== 'number') {
                    val = value;
                } else {
                    val = value.toString();
                }
            }
        }
        return Object.assign(params, {
            [keyName]: val,
        });
    }, {}));
}
