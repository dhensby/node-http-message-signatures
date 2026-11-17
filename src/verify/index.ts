import { ExpiredError, UnacceptableSignatureError } from '../errors';
import { VerifyConfig } from '../types';

/**
 * The parts of a signature that `verifyMessage()` checks before it verifies the signature value
 */
export interface SignatureToCheck {
    /**
     * Returns true if the signature has this parameter
     */
    hasParam: (param: string) => boolean;
    /**
     * Returns true if the signature covers this field
     */
    hasField: (field: string) => boolean;
    /**
     * The `created` parameter of the signature, in seconds since the epoch
     */
    created?: number;
    /**
     * The `expires` parameter of the signature, in seconds since the epoch
     */
    expires?: number;
    /**
     * Returns the time that the signature was created, in seconds since the epoch, to compare
     * with `maxAge`. Returns `null` if the signature does not have a creation time.
     */
    signedAt: () => number | null;
}

/**
 * Check that a signature is acceptable: it has the required parameters and fields, it is not
 * older than `maxAge`, it was not created after `notAfter` and it has not expired.
 *
 * Throws an `UnacceptableSignatureError` or an `ExpiredError` if the signature is not acceptable.
 */
export function checkSignature(config: VerifyConfig, signature: SignatureToCheck, now: number): void {
    const tolerance = config.tolerance ?? 0;
    const notAfter = config.notAfter instanceof Date ? Math.floor(config.notAfter.getTime() / 1000) : config.notAfter ?? now;
    const hasRequiredParams = (config.requiredParams ?? []).every((param) => signature.hasParam(param));
    if (!hasRequiredParams) {
        throw new UnacceptableSignatureError('Missing required signature parameters');
    }
    const hasRequiredFields = (config.requiredFields ?? []).every((field) => signature.hasField(field));
    if (!hasRequiredFields) {
        throw new UnacceptableSignatureError('Missing required signed fields');
    }
    // maxAge overrides expires.
    // maxAge is best effort: it is checked only if the signature has a creation time
    if (config.maxAge) {
        const signedAt = signature.signedAt();
        // signature is older than maxAge (allowing for clock tolerance)
        if (signedAt !== null && now - signedAt > config.maxAge + tolerance) {
            throw new ExpiredError('Signature is too old');
        }
    }
    // created after the allowed time (ie: created in the future, allowing for clock tolerance)
    if (signature.created !== undefined && signature.created - tolerance > notAfter) {
        throw new ExpiredError('Signature is too old');
    }
    // expired signature
    if (signature.expires !== undefined && now > signature.expires + tolerance) {
        throw new ExpiredError('Signature has expired');
    }
}
