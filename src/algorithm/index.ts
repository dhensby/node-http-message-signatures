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
    sign,
    verify,
    KeyObject,
} from 'crypto';
import { RSA_PKCS1_PADDING, RSA_PKCS1_PSS_PADDING } from 'constants';
import { SigningKey, Algorithm, Verifier } from '../types';
import { UnknownAlgorithmError } from '../errors';

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
            signer.sign = async (data: Buffer) => createHmac('sha256', key as BinaryLike).update(data).digest();
            break;
        case 'rsa-pss-sha512':
            signer.sign = async (data: Buffer) => createSign('sha512').update(data).sign({
                key,
                padding: RSA_PKCS1_PSS_PADDING,
            } as SignPrivateKeyInput);
            break;
        case 'rsa-v1_5-sha256':
            signer.sign = async (data: Buffer) => createSign('sha256').update(data).sign({
                key,
                padding: RSA_PKCS1_PADDING,
            } as SignPrivateKeyInput);
            break;
        case 'rsa-v1_5-sha1':
            // this is legacy for cavage
            signer.sign = async (data: Buffer) => createSign('sha1').update(data).sign({
                key,
                padding: RSA_PKCS1_PADDING,
            } as SignPrivateKeyInput);
            break;
        case 'ecdsa-p256-sha256':
            signer.sign = async (data: Buffer) => createSign('sha256').update(data).sign({
                key: key as KeyObject,
                dsaEncoding: 'ieee-p1363',
            }); 
            break;
        case 'ecdsa-p384-sha384':
            signer.sign = async (data: Buffer) => createSign('sha384').update(data).sign({
                key: key as KeyObject,
                dsaEncoding: 'ieee-p1363',
            });
            break;
        case 'ed25519':
            signer.sign = async (data: Buffer) => sign(null, data, key as KeyLike);
            // signer.sign = async (data: Buffer) => createSign('ed25519').update(data).sign(key as KeyLike);
            break;
        default:
            throw new UnknownAlgorithmError(`Unsupported signing algorithm ${alg}`);
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
            verifier = async (data: Buffer, signature: Buffer) => {
                const expected = createHmac('sha256', key as BinaryLike).update(data).digest();
                return signature.length === expected.length && timingSafeEqual(signature, expected);
            }
            break;
        case 'rsa-pss-sha512':
            verifier = async (data: Buffer, signature: Buffer) => createVerify('sha512').update(data).verify({
                key,
                padding: RSA_PKCS1_PSS_PADDING,
            } as VerifyPublicKeyInput, signature);
            break;
        case 'rsa-v1_5-sha1':
            verifier = async (data: Buffer, signature: Buffer) => createVerify('sha1').update(data).verify({
                key,
                padding: RSA_PKCS1_PADDING,
            } as VerifyPublicKeyInput, signature);
            break;
        case 'rsa-v1_5-sha256':
            verifier = async (data: Buffer, signature: Buffer) => createVerify('sha256').update(data).verify({
                key,
                padding: RSA_PKCS1_PADDING,
            } as VerifyPublicKeyInput, signature);
            break;
        case 'ecdsa-p256-sha256':
            verifier = async (data: Buffer, signature: Buffer) => createVerify('sha256').update(data).verify({
                key: key as KeyObject,
                dsaEncoding: 'ieee-p1363',
            }, signature);
            break;
        case 'ecdsa-p384-sha384':
            verifier = async (data: Buffer, signature: Buffer) => createVerify('sha384').update(data).verify({
                key: key as KeyObject,
                dsaEncoding: 'ieee-p1363',
            }, signature);
            break;
        case 'ed25519':
            verifier = async (data: Buffer, signature: Buffer) => verify(null, data, key as KeyLike, signature) as unknown as boolean;
            break;
        default:
            throw new UnknownAlgorithmError(`Unsupported signing algorithm ${alg}`);
    }
    return Object.assign(verifier, { alg });
}
