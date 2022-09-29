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
export type Verifier = (data: Buffer, signature: Buffer, parameters?: SignatureParameters) => Promise<boolean | null>;

export type Algorithm = 'rsa-v1_5-sha256' | 'ecdsa-p256-sha256' | 'hmac-sha256' | 'rsa-pss-sha512' | string;

export interface SigningKey {
    id?: string;
    alg?: Algorithm;
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
export const defaultParams = [
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

export function isRequest(obj: Request | Response): obj is Request {
    return !!(obj as Request).method;
}
