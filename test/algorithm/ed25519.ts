import { generateKeyPair, sign, verify } from 'crypto';
import { promisify } from 'util';
import { createSigner, createVerifier } from '../../src';
import { expect } from 'chai';
import { readFile } from 'fs';
import { join } from 'path';

describe('ed25519', () => {
    describe('internal tests', () => {
        let ed25519: { publicKey: string, privateKey: string };
        before('generate key pair', async () => {
            ed25519 = await promisify(generateKeyPair)('ed25519', {
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
                const signer = createSigner(ed25519.privateKey, 'ed25519');
                const data = Buffer.from('some random data');
                const sig = await signer.sign(data);
                expect(signer.alg).to.equal('ed25519');
                expect(sig).to.satisfy((arg: Buffer) => verify(null, data, ed25519.publicKey, arg));
            });
        });
        describe('verifying', () => {
            it('verifies a signature', async () => {
                const verifier = createVerifier(ed25519.publicKey, 'ed25519');
                const data = Buffer.from('some random data');
                const sig = sign(null, data, ed25519.privateKey);
                expect(sig).to.satisfy((arg: Buffer) => verifier(data, arg));
            });
        });
    });
    describe('specification examples', () => {
        let ecKeyPem: string;
        before('load rsa key', async () => {
            ecKeyPem = (await promisify(readFile)(join(__dirname, '../etc/ed25519.pem'))).toString();
        });
        describe('response signing', () => {
            const data = Buffer.from('"date": Tue, 20 Apr 2021 02:07:55 GMT\n' +
                '"@method": POST\n' +
                '"@path": /foo\n' +
                '"@authority": example.com\n' +
                '"content-type": application/json\n' +
                '"content-length": 18\n' +
                '"@signature-params": ("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"');
            it('successfully signs a payload', async () => {
                const sig = await (createSigner(ecKeyPem, 'ed25519').sign(data));
                expect(sig).to.satisfy((arg: Buffer) => verify(null, data, ecKeyPem, arg));
            });
            it('successfully verifies a signature', async () => {
                const sig = Buffer.from('wqcAqbmYJ2ji2glfAMaRy4gruYYnx2nEFN2HN6jrnDnQCK1u02Gb04v9EDgwUPiu4A0w6vuQv5lIp5WPpBKRCw==', 'base64');
                expect(sig).to.satisfy((arg: Buffer) => verify(null, Buffer.from(data), ecKeyPem, arg));
                expect(await (createVerifier(ecKeyPem, 'ed25519')(data, sig))).to.equal(true);
            });
        });
    });
});
