import {
    BinaryLike,
    createHmac,
    createSign,
    createVerify,
    KeyLike,
    SignKeyObjectInput,
    SignPrivateKeyInput,
    timingSafeEqual,
    VerifyKeyObjectInput,
    VerifyPublicKeyInput,
} from 'crypto';
import { RSA_PKCS1_PADDING, RSA_PKCS1_PSS_PADDING } from 'constants';
import { SigningKey, Algorithm, Verifier } from '../types';

/**
 * A helper method for easier consumption of the library.
 *
 * Consumers of the library can use this function to create a signer "out of the box" using a PEM
 * file they have access to.
 *
 * @todo - read the key and determine its type automatically to make usage even easier
 */
export function createSigner(key: BinaryLike | KeyLike | SignKeyObjectInput | SignPrivateKeyInput, alg: Algorithm, id?: string): SigningKey {
    const signer = { alg } as SigningKey;
    switch (alg) {
        case 'hmac-sha256':
            signer.sign = async (data: BinaryLike) => createHmac('sha256', key as BinaryLike).update(data).digest();
            break;
        case 'rsa-pss-sha512':
            signer.sign = async (data: BinaryLike) => createSign('sha512').update(data).sign({
                key,
                padding: RSA_PKCS1_PSS_PADDING,
            } as SignPrivateKeyInput);
            break;
        case 'rsa-v1_5-sha256':
            signer.sign = async (data: BinaryLike) => createSign('sha256').update(data).sign({
                key,
                padding: RSA_PKCS1_PADDING,
            } as SignPrivateKeyInput);
            break;
        case 'rsa-v1_5-sha1':
            // this is legacy for cavage
            signer.sign = async (data: BinaryLike) => createSign('sha1').update(data).sign({
                key,
                padding: RSA_PKCS1_PADDING,
            } as SignPrivateKeyInput);
            break;
        case 'ecdsa-p256-sha256':
            signer.sign = async (data: BinaryLike) => createSign('sha256').update(data).sign(key as KeyLike);
            break;
        default:
            throw new Error(`Unsupported signing algorithm ${alg}`);
    }
    if (id) {
        signer.id = id;
    }
    return signer;
}

/**
 * A helper method for easier consumption of the library.
 *
 * Consumers of the library can use this function to create a verifier "out of the box" using a PEM
 * file they have access to.
 *
 * Verifiers are a little trickier as they will need to be produced "on demand" and the consumer will
 * need to implement some logic for looking up keys by id (or other aspects of the request if no keyid
 * is supplied) and then returning a validator
 *
 * @todo - attempt to look up algorithm automatically
 */
export function createVerifier(key: BinaryLike | KeyLike | VerifyKeyObjectInput | VerifyPublicKeyInput, alg: Algorithm): Verifier {
    let verifier;
    switch (alg) {
        case 'hmac-sha256':
            verifier = async (data: BinaryLike, signature: BinaryLike) => {
                const expected = createHmac('sha256', key as BinaryLike).update(data).digest();
                const sig = Buffer.from(signature);
                return sig.length === expected.length && timingSafeEqual(sig, expected);
            }
            break;
        case 'rsa-pss-sha512':
            verifier = async (data: BinaryLike, signature: BinaryLike) => createVerify('sha512').update(data).verify({
                key,
                padding: RSA_PKCS1_PSS_PADDING,
            } as VerifyPublicKeyInput, Buffer.from(signature));
            break;
        case 'rsa-v1_5-sha1':
            verifier = async (data: BinaryLike, signature: BinaryLike) => createVerify('sha1').update(data).verify({
                key,
                padding: RSA_PKCS1_PADDING,
            } as VerifyPublicKeyInput, Buffer.from(signature));
            break;
        case 'rsa-v1_5-sha256':
            verifier = async (data: BinaryLike, signature: BinaryLike) => createVerify('sha256').update(data).verify({
                key,
                padding: RSA_PKCS1_PADDING,
            } as VerifyPublicKeyInput, Buffer.from(signature));
            break;
        case 'ecdsa-p256-sha256':
            verifier = async (data: BinaryLike, signature: BinaryLike) => createVerify('sha256').update(data).verify(key as KeyLike, Buffer.from(signature));
            break;
        default:
            throw new Error(`Unsupported signing algorithm ${alg}`);
    }
    return Object.assign(verifier, { alg });
}
