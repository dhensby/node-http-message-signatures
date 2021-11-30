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

export type Algorithm = 'rsa-v1_5-sha256' | 'ecdsa-p256-sha256' | 'hmac-sha256' | 'rsa-pss-sha512';

export interface Signer {
    (data: BinaryLike): Promise<Buffer>,
    alg: Algorithm,
}

export interface Verifier {
    (data: BinaryLike, signature: BinaryLike): Promise<boolean>,
    alg: Algorithm,
}

export function createSigner(alg: Algorithm, key: BinaryLike | KeyLike | SignKeyObjectInput | SignPrivateKeyInput): Signer {
    let signer;
    switch (alg) {
        case 'hmac-sha256':
            signer = async (data: BinaryLike) => createHmac('sha256', key as BinaryLike).update(data).digest();
            break;
        case 'rsa-pss-sha512':
            signer = async (data: BinaryLike) => createSign('sha512').update(data).sign({
                key,
                padding: RSA_PKCS1_PSS_PADDING,
            } as SignPrivateKeyInput);
            break;
        case 'rsa-v1_5-sha256':
            signer = async (data: BinaryLike) => createSign('sha256').update(data).sign({
                key,
                padding: RSA_PKCS1_PADDING,
            } as SignPrivateKeyInput);
            break;
        case 'ecdsa-p256-sha256':
            signer = async (data: BinaryLike) => createSign('sha256').update(data).sign(key as KeyLike);
            break;
        default:
            throw new Error(`Unsupported signing algorithm ${alg}`);
    }
    return Object.assign(signer, { alg });
}

export function createVerifier(alg: Algorithm, key: BinaryLike | KeyLike | VerifyKeyObjectInput | VerifyPublicKeyInput): Verifier {
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
