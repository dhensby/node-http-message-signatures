import { createPrivateKey, KeyObject } from 'crypto';
import { cavage, createSigner } from '../../src';
import { expect } from 'chai';

/**
 * These test have been taken from the specification, but they are only accurate as of
 * version 10 of the specification (https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures-10)
 * and not version 12 (the last one). As such, some of the tests have been modified to pass with the
 * latest implementation.
 */
describe('cavage', () => {
    describe('specification', () => {
        const request = {
            method: 'POST',
            url: 'https://example.com/foo?param=value&pet=dog',
            headers: {
                'Host': 'example.com',
                'Date': 'Sun, 05 Jan 2014 21:31:40 GMT',
                'Content-Type': 'application/json',
                'Digest': 'SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=',
                'Content-Length': '18',
            },
            body: '{"hello": "world"}',
        }
        let key: KeyObject;
        before('load rsa key', () => {
            key = createPrivateKey('-----BEGIN RSA PRIVATE KEY-----\n' +
                'MIICXgIBAAKBgQDCFENGw33yGihy92pDjZQhl0C36rPJj+CvfSC8+q28hxA161QF\n' +
                'NUd13wuCTUcq0Qd2qsBe/2hFyc2DCJJg0h1L78+6Z4UMR7EOcpfdUE9Hf3m/hs+F\n' +
                'UR45uBJeDK1HSFHD8bHKD6kv8FPGfJTotc+2xjJwoYi+1hqp1fIekaxsyQIDAQAB\n' +
                'AoGBAJR8ZkCUvx5kzv+utdl7T5MnordT1TvoXXJGXK7ZZ+UuvMNUCdN2QPc4sBiA\n' +
                'QWvLw1cSKt5DsKZ8UETpYPy8pPYnnDEz2dDYiaew9+xEpubyeW2oH4Zx71wqBtOK\n' +
                'kqwrXa/pzdpiucRRjk6vE6YY7EBBs/g7uanVpGibOVAEsqH1AkEA7DkjVH28WDUg\n' +
                'f1nqvfn2Kj6CT7nIcE3jGJsZZ7zlZmBmHFDONMLUrXR/Zm3pR5m0tCmBqa5RK95u\n' +
                '412jt1dPIwJBANJT3v8pnkth48bQo/fKel6uEYyboRtA5/uHuHkZ6FQF7OUkGogc\n' +
                'mSJluOdc5t6hI1VsLn0QZEjQZMEOWr+wKSMCQQCC4kXJEsHAve77oP6HtG/IiEn7\n' +
                'kpyUXRNvFsDE0czpJJBvL/aRFUJxuRK91jhjC68sA7NsKMGg5OXb5I5Jj36xAkEA\n' +
                'gIT7aFOYBFwGgQAQkWNKLvySgKbAZRTeLBacpHMuQdl1DfdntvAyqpAZ0lY0RKmW\n' +
                'G6aFKaqQfOXKCyWoUiVknQJAXrlgySFci/2ueKlIE1QqIiLSZ8V8OlpFLRnb1pzI\n' +
                '7U1yQXnTAEFYM560yJlzUpOb1V4cScGd365tiSMvxLOvTA==\n' +
                '-----END RSA PRIVATE KEY-----')
        });
        it('Default Test (C.1)', async () => {
            const signed = await cavage.signMessage({
                key: createSigner(key, 'rsa-v1_5-sha256', 'Test'),
                fields: ['Date'],
                params: ['keyid', 'alg'],
            }, request);
            expect(signed.headers).to.have.property('Signature', 'keyId="Test",algorithm="rsa-sha256",' +
                'headers="date",' + // NB: Not present in specificaiton example
                'signature="SjWJWbWN7i0wzBvtPl8rbASWz5xQW6mcJmn+ibttBqtifLN7Sazz' +
                '6m79cNfwwb8DMJ5cou1s7uEGKKCs+FLEEaDV5lp7q25WqS+lavg7T8hc0GppauB' +
                '6hbgEKTwblDHYGEtbGmtdHgVCk9SuS13F0hZ8FD0k/5OxEPXe5WozsbM="');
        });
        it('Basic Test (C.2)', async () => {
            const signed = await cavage.signMessage({
                key: createSigner(key, 'rsa-v1_5-sha256', 'Test'),
                params: ['keyid', 'alg'],
                fields: ['@request-target', 'host', 'date'],
            }, request);
            expect(signed.headers).to.have.property('Signature', 'keyId="Test",algorithm="rsa-sha256",' +
                'headers="(request-target) host date",' +
                'signature="qdx+H7PHHDZgy4y/Ahn9Tny9V3GP6YgBPyUXMmoxWtLbHpUnXS' +
                '2mg2+SbrQDMCJypxBLSPQR2aAjn7ndmw2iicw3HMbe8VfEdKFYRqzic+efkb3' +
                'nndiv/x1xSHDJWeSWkx3ButlYSuBskLu6kd9Fswtemr3lgdDEmn04swr2Os0="');
        });
        it('All Headers Test (C.3)', async () => {
            const signed = await cavage.signMessage({
                key: createSigner(key, 'rsa-v1_5-sha256', 'Test'),
                params: ['keyid', 'alg', 'created', 'expires'],
                paramValues: {
                    created: new Date(1402170695000),
                    expires: new Date(1402170699000),
                },
                fields: ['@request-target', 'host', 'date', 'content-type', 'digest', 'content-length'],
            }, request);
            // NB: As noted in the spec, some of the test "vectors" are wrong. For this test, the signature has been
            // calculated without the (created) and (expires) params being included in the signature despite the example
            // showing they are in the signature header
            expect(signed.headers).to.have.property('Signature', 'keyId="Test",algorithm="rsa-sha256",' +
                'created=1402170695,expires=1402170699,' +
                // 'headers="(request-target) (created) (expires) ' +
                'headers="(request-target) ' + // NB: the example signature has only been computed over request-target
                'host date content-type digest content-length",' +
                'signature="vSdrb+dS3EceC9bcwHSo4MlyKS59iFIrhgYkz8+oVLEEzmYZZvRs' +
                '8rgOp+63LEM3v+MFHB32NfpB2bEKBIvB1q52LaEUHFv120V01IL+TAD48XaERZF' +
                'ukWgHoBTLMhYS2Gb51gWxpeIq8knRmPnYePbF5MOkR0Zkly4zKH7s1dE="');
        });
    });
});
