import { createSign, generateKeyPair, publicDecrypt } from 'crypto';
import { promisify } from 'util';
import { createSigner, createVerifier } from '../../src';
import { expect } from 'chai';
import { RSA_PKCS1_PADDING } from 'constants';

describe('rsa-v1_5-sha1', () => {
    let rsaKeyPair: { publicKey: string, privateKey: string };
    before('generate key pair', async () => {
        rsaKeyPair = await promisify(generateKeyPair)('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem',
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
            },
        });
    });
    describe('signing', () => {
        it('signs a payload', async () => {
            const signer = createSigner(rsaKeyPair.privateKey, 'rsa-v1_5-sha1');
            const data = Buffer.from('some random data');
            const sig = await signer.sign(data);
            expect(signer.alg).to.equal('rsa-v1_5-sha1');
            expect(sig).to.satisfy((arg: Buffer) => publicDecrypt({ key: rsaKeyPair.publicKey, padding: RSA_PKCS1_PADDING }, arg));
        });
    });
    describe('verifying', () => {
        it('verifies a signature', async () => {
            const verifier = createVerifier(rsaKeyPair.publicKey, 'rsa-v1_5-sha1');
            const data = Buffer.from('some random data');
            const sig = createSign('sha1').update(data).sign({ key: rsaKeyPair.privateKey, padding: RSA_PKCS1_PADDING });
            const verified = await verifier(data, sig);
            expect(verified).to.equal(true);
        });
    });
});
