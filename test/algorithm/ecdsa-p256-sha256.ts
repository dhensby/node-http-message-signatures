import { generateKeyPair, sign, verify } from 'crypto';
import { promisify } from 'util';
import { createSigner, createVerifier } from '../../src';
import { expect } from 'chai';
import { readFile } from 'fs';
import { join } from 'path';

describe('ecdsa-p256-sha256', () => {
    describe('internal tests', () => {
        let ecdsaKeyPair: { publicKey: string, privateKey: string };
        before('generate key pair', async () => {
            ecdsaKeyPair = await promisify(generateKeyPair)('ec', {
                namedCurve: 'P-256',
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
                const signer = createSigner(ecdsaKeyPair.privateKey, 'ecdsa-p256-sha256');
                const data = Buffer.from('some random data');
                const sig = await signer.sign(data);
                expect(signer.alg).to.equal('ecdsa-p256-sha256');
                expect(sig).to.satisfy((arg: Buffer) => verify('sha256', data, {
                    key: ecdsaKeyPair.publicKey,
                    dsaEncoding: 'ieee-p1363',
                }, arg));
            });
        });
        describe('verifying', () => {
            it('verifies a signature', async () => {
                const verifier = createVerifier(ecdsaKeyPair.publicKey, 'ecdsa-p256-sha256');
                const data = Buffer.from('some random data');
                const sig = sign('sha256', data, {
                    key: ecdsaKeyPair.privateKey,
                    dsaEncoding: 'ieee-p1363',
                });
                expect(sig).to.satisfy((arg: Buffer) => verifier(data, arg));
            });
        });
    });
    describe('specification examples', () => {
        let ecKeyPem: string;
        before('load key', async () => {
            ecKeyPem = (await promisify(readFile)(join(__dirname, '../etc/test-key-ecc-p256.pem'))).toString();
        });
        describe('response signing', () => {
            const data = Buffer.from('"@status": 200\n' +
                '"content-type": application/json\n' +
                '"content-digest": sha-512=:mEWXIS7MaLRuGgxOBdODa3xqM1XdEvxoYhvlCFJ41QJgJc4GTsPp29l5oGX69wWdXymyU0rjJuahq4l5aGgfLQ==:\n' +
                '"content-length": 23\n' +
                '"@signature-params": ("@status" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-ecc-p256"');
            it('successfully signs a payload', async () => {
                const sig = await (createSigner(ecKeyPem, 'ecdsa-p256-sha256').sign(data));
                expect(sig).to.satisfy((arg: Buffer) => verify('sha256', data, {
                    key: ecKeyPem,
                    dsaEncoding: 'ieee-p1363',
                }, arg));
            });
            it('successfully verifies a signature', async () => {
                const sig = Buffer.from('wNmSUAhwb5LxtOtOpNa6W5xj067m5hFrj0XQ4fvpaCLx0NKocgPquLgyahnzDnDAUy5eCdlYUEkLIj+32oiasw==', 'base64');
                expect(await (createVerifier(ecKeyPem, 'ecdsa-p256-sha256')(data, sig))).to.equal(true);
            });
        });
    });
});
