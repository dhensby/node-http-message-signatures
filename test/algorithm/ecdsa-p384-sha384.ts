import { generateKeyPair, sign, verify } from 'crypto';
import { promisify } from 'util';
import { createSigner, createVerifier } from '../../src';
import { expect } from 'chai';

describe('ecdsa-p384-sha384', () => {
    describe('internal tests', () => {
        let ecdsaKeyPair: { publicKey: string, privateKey: string };
        before('generate key pair', async () => {
            ecdsaKeyPair = await promisify(generateKeyPair)('ec', {
                namedCurve: 'P-384',
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
                const signer = createSigner(ecdsaKeyPair.privateKey, 'ecdsa-p384-sha384');
                const data = Buffer.from('some random data');
                const sig = await signer.sign(data);
                expect(signer.alg).to.equal('ecdsa-p384-sha384');
                expect(sig).to.satisfy((arg: Buffer) => verify('sha384', data, {
                    key: ecdsaKeyPair.publicKey,
                    dsaEncoding: 'ieee-p1363',
                }, arg));
            });
        });
        describe('verifying', () => {
            it('verifies a signature', async () => {
                const verifier = createVerifier(ecdsaKeyPair.publicKey, 'ecdsa-p384-sha384');
                const data = Buffer.from('some random data');
                const sig = sign('sha384', data, {
                    key: ecdsaKeyPair.privateKey,
                    dsaEncoding: 'ieee-p1363',
                });
                expect(sig).to.satisfy((arg: Buffer) => verifier(data, arg));
            });
        });
    });
});
