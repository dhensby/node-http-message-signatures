export interface Request {
    method: string;
    url: string | URL;
    headers: Record<string, string | string[]>;
}

export interface Response {
    status: number;
    headers: Record<string, string | string[]>;
}

export type Signer = (data: Uint8Array) => Promise<Uint8Array>;
export type Verifier = (data: Uint8Array, signature: Uint8Array, parameters?: SignatureParameters) => Promise<boolean | null>;
export type VerifierFinder = (parameters: SignatureParameters) => Promise<VerifyingKey | null>;

export type Algorithm = 'rsa-v1_5-sha256' | 'ecdsa-p256-sha256' | 'hmac-sha256' | 'rsa-pss-sha512' | string;

export interface SigningKey {
    /**
     * The ID of this key
     */
    id?: string;
    /**
     * The algorithm to sign with
     */
    alg?: Algorithm;
    /**
     * The Signer function
     */
    sign: Signer;
}

export interface VerifyingKey {
    /**
     * The ID of this key
     */
    id?: string;
    /**
     * The supported algorithms for this key
     */
    algs?: Algorithm[];
    /**
     * The Verify function
     */
    verify: Verifier;
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
     * A tag parameter for the signature
     */
    tag?: string;
    [param: string]: Date | number | string | null | undefined;
}

/**
 * Default parameters to use when signing a request if none are supplied by the consumer
 */
export const defaultParams = [
    'keyid',
    'alg',
    'created',
    'expires',
];

/**
 * A component parser supplied by the consumer to allow applications to define their own logic for
 * extracting components for use in the signature base.
 *
 * This can be useful in circumstances where the application has agreed a specific standard or way
 * of extracting components from messages and/or when new components are added to the specification
 * but not yet supported by the library.
 *
 * Return null to defer to internal logic
 */
export type ComponentParser = (name: string, params: Map<string, string | number | boolean>, message: Request | Response, req?: Request) => string[] | null;

export interface CommonConfig {
    /**
     * A component user supplied component parser
     */
    componentParser?: ComponentParser;
}

export interface SignConfig extends CommonConfig {
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
    /**
     * A list of supported algorithms
     */
    algs?: Algorithm[];
}

/**
 * Options when verifying signatures
 */
export interface VerifyConfig extends CommonConfig {
    keyLookup: VerifierFinder;
    /**
     * A date that the signature can't have been marked as `created` after
     * Default: Date.now() + tolerance
     */
    notAfter?: Date | number;
    /**
     * The maximum age of the signature - this effectively overrides the `expires` value for the
     * signature (unless the expires age is less than the maxAge specified)
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

export function isRequest(obj: Request | Response): obj is Request {
    return !!(obj as Request).method;
}
