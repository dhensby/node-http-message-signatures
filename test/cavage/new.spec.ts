import * as cavage from '../../src/cavage';
import { Request, Response, SigningKey } from '../../src';
import { expect } from 'chai';
import { describe } from 'mocha';
import * as MockDate from 'mockdate';
import { stub } from 'sinon';

describe('cavage', () => {
    // test the spec as per https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-2.2
    describe('.deriveComponent', () => {
        describe('unbound components', () => {
            it('derives @request-target', () => {
                const req: Request = {
                    method: 'POST',
                    url: 'https://www.example.com/path?param=value',
                    headers: {
                        Host: 'www.example.com',
                    },
                };
                expect(cavage.deriveComponent('@request-target', req)).to.deep.equal([
                    'post /path?param=value',
                ]);
            });
        });
    });
    describe('.extractHeader', () => {
        describe('raw headers', () => {
            const request: Request = {
                method: 'POST',
                url: 'https://www.example.com/',
                headers: {
                    'Host': 'www.example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:56 GMT',
                    'X-OWS-Header': '  Leading and trailing whitespace.  ',
                    'X-Obs-Fold-Header': 'Obsolete\n    line folding.',
                    'Cache-Control': ['max-age=60', '   must-revalidate'],
                    'Example-Dict': ' a=1,    b=2;x=1;y=2,   c=(a   b   c)',
                    'X-Empty-Header': '',
                },
            };
            it('parses raw fields', () => {
                expect(cavage.extractHeader('host', request)).to.deep.equal(['www.example.com']);
                expect(cavage.extractHeader('date', request)).to.deep.equal(['Tue, 20 Apr 2021 02:07:56 GMT']);
                expect(cavage.extractHeader('X-OWS-Header', request)).to.deep.equal(['Leading and trailing whitespace.']);
                expect(cavage.extractHeader('x-obs-fold-header', request)).to.deep.equal(['Obsolete line folding.']);
                expect(cavage.extractHeader('cache-control', request)).to.deep.equal(['max-age=60, must-revalidate']);
                expect(cavage.extractHeader('example-dict', request)).to.deep.equal(['a=1,    b=2;x=1;y=2,   c=(a   b   c)']);
                expect(cavage.extractHeader('x-empty-header', request)).to.deep.equal(['']);
            });
        });
    });
    describe('.createSignatureBase', () => {
        describe('header fields', () => {
            const request: Request = {
                method: 'POST',
                url: 'https://www.example.com/',
                headers: {
                    'Host': 'www.example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:56 GMT',
                    'X-OWS-Header': '  Leading and trailing whitespace.  ',
                    'X-Obs-Fold-Header': 'Obsolete\n    line folding.',
                    'Cache-Control': ['max-age=60', '   must-revalidate'],
                    'Example-Dict': ' a=1,    b=2;x=1;y=2,   c=(a   b   c)',
                    'X-Empty-Header': '',
                },
            };
            it('creates a signature base from raw headers', () => {
                expect(cavage.createSignatureBase([
                    'host',
                    'date',
                    'x-ows-header',
                    'x-obs-fold-header',
                    'cache-control',
                    'example-dict',
                ], request, new Map())).to.deep.equal([
                    ['host', ['www.example.com']],
                    ['date', ['Tue, 20 Apr 2021 02:07:56 GMT']],
                    ['x-ows-header', ['Leading and trailing whitespace.']],
                    ['x-obs-fold-header', ['Obsolete line folding.']],
                    ['cache-control', ['max-age=60, must-revalidate']],
                    ['example-dict', ['a=1,    b=2;x=1;y=2,   c=(a   b   c)']],
                ]);
            });
            it('extracts an empty header', () => {
                expect(cavage.createSignatureBase([
                    'X-Empty-Header',
                ], request, new Map())).to.deep.equal([
                    ['x-empty-header', ['']],
                ]);
            });
        });
        describe('derived components', () => {
            const request: Request = {
                method: 'post',
                url: 'https://www.example.com/path?param=value',
                headers: {
                    Host: 'www.example.com',
                },
            };
            it('derives @request-target', () => {
                expect(cavage.createSignatureBase(['@request-target'], request, new Map())).to.deep.equal([
                    ['(request-target)', ['post /path?param=value']],
                ]);
            });
        });
        describe('full example', () => {
            const request: Request = {
                method: 'post',
                url: 'https://example.com/foo?param=Value&Pet=dog',
                headers: {
                    'Host': 'example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                    'Content-Type': 'application/json',
                    'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                    'Content-Length': '18',
                },
            };
            it('produces a signature base for a request', () => {
                expect(cavage.createSignatureBase([
                    '@request-target',
                    'content-digest',
                    'content-length',
                    'content-type',
                ], request, new Map())).to.deep.equal([
                    ['(request-target)', ['post /foo?param=Value&Pet=dog']],
                    ['content-digest', ['sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:']],
                    ['content-length', ['18']],
                    ['content-type', ['application/json']],
                ]);
            });
        });
    });
    describe('.formatSignatureBase', () => {
        it('derives @request-target', () => {
            expect(cavage.formatSignatureBase([
                ['@request-target', ['post /path?param=value']],
            ])).to.equal('(request-target): post /path?param=value');
        });
        it('formats many headers', () => {
            expect(cavage.formatSignatureBase([
                ['host', ['www.example.com']],
                ['date', ['Tue, 20 Apr 2021 02:07:56 GMT']],
                ['x-ows-header', ['Leading and trailing whitespace.']],
                ['x-obs-fold-header', ['Obsolete line folding.']],
                ['cache-control', ['max-age=60, must-revalidate']],
                ['example-dict', ['a=1,    b=2;x=1;y=2,   c=(a   b   c)']],
                ['x-empty-header', ['']],
            ])).to.equal('host: www.example.com\n' +
                'date: Tue, 20 Apr 2021 02:07:56 GMT\n' +
                'x-ows-header: Leading and trailing whitespace.\n' +
                'x-obs-fold-header: Obsolete line folding.\n' +
                'cache-control: max-age=60, must-revalidate\n' +
                'example-dict: a=1,    b=2;x=1;y=2,   c=(a   b   c)\n' +
                'x-empty-header: ');
        });
    });
    describe('.createSigningParameters', () => {
        before('mock date', () => {
            MockDate.set(new Date('2022-09-27 08:34:12 GMT'));
        });
        after('reset date', () => {
            MockDate.reset();
        });
        describe('default params', () => {
            it('creates a set of default parameters', () => {
                expect(Array.from(cavage.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(Buffer.from('')),
                        alg: 'rsa123',
                    },
                }).entries())).to.deep.equal([
                    ['keyid', '123'],
                    ['alg', 'rsa123'],
                    ['created', 1664267652],
                    ['expires', 1664267952],
                ]);
            });
            it('omits created if null passed', () => {
                expect(Array.from(cavage.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(Buffer.from('')),
                        alg: 'rsa123',
                    },
                    paramValues: { created: null },
                }, ).entries())).to.deep.equal([
                    ['keyid', '123'],
                    ['alg', 'rsa123'],
                ]);
            });
            it('uses a custom expires if passed', () => {
                expect(Array.from(cavage.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(Buffer.from('')),
                        alg: 'rsa123',
                    },
                    paramValues: { expires: new Date(Date.now() + 600000) },
                }).entries())).to.deep.equal([
                    ['keyid', '123'],
                    ['alg', 'rsa123'],
                    ['created', 1664267652],
                    ['expires', 1664268252],
                ]);
            });
            it('overrides the keyid', () => {
                expect(Array.from(cavage.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(Buffer.from('')),
                        alg: 'rsa123',
                    },
                    paramValues: { keyid: '321' },
                }).entries())).to.deep.equal([
                    ['keyid', '321'],
                    ['alg', 'rsa123'],
                    ['created', 1664267652],
                    ['expires', 1664267952],
                ]);
            });
            it('overrides the alg', () => {
                expect(Array.from(cavage.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(Buffer.from('')),
                        alg: 'rsa123',
                    },
                    paramValues: { alg: 'rsa321' },
                }).entries())).to.deep.equal([
                    ['keyid', '123'],
                    ['alg', 'rsa321'],
                    ['created', 1664267652],
                    ['expires', 1664267952],
                ]);
            });
            it('handles missing alg', () => {
                expect(Array.from(cavage.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(Buffer.from('')),
                    },
                }).entries())).to.deep.equal([
                    ['keyid', '123'],
                    ['created', 1664267652],
                    ['expires', 1664267952],
                ]);
            });
            it('handles missing keyid', () => {
                expect(Array.from(cavage.createSigningParameters({
                    key: {
                        sign: () => Promise.resolve(Buffer.from('')),
                    },
                }).entries())).to.deep.equal([
                    ['created', 1664267652],
                    ['expires', 1664267952],
                ]);
            });
            it('returns nothing if no data', () => {
                expect(Array.from(cavage.createSigningParameters({
                    key: {
                        sign: () => Promise.resolve(Buffer.from('')),
                    },
                    paramValues: { created: null },
                }).entries())).to.deep.equal([]);
            });
        });
        describe('specified params', () => {
            it('returns specified params', () => {
                expect(Array.from(cavage.createSigningParameters({
                    key: {
                        id: '123',
                        alg: 'rsa',
                        sign: () => Promise.resolve(Buffer.from('')),
                    },
                    params: ['created', 'keyid', 'alg'],
                }).entries())).to.deep.equal([
                    ['created', 1664267652],
                    ['keyid', '123'],
                    ['alg', 'rsa'],
                ]);
            });
            it('returns arbitrary params', () => {
                expect(Array.from(cavage.createSigningParameters({
                    key: {
                        id: '123',
                        alg: 'rsa',
                        sign: () => Promise.resolve(Buffer.from('')),
                    },
                    params: ['created', 'keyid', 'alg', 'custom'],
                    paramValues: { custom: 'value' },
                }).entries())).to.deep.equal([
                    ['created', 1664267652],
                    ['keyid', '123'],
                    ['alg', 'rsa'],
                    ['custom', 'value'],
                ]);
            });
        });
    });
    describe('.signMessage', () => {
        describe('requests', () => {
            const request: Request = {
                method: 'post',
                url: 'https://example.org/foo',
                headers: {
                    'Host': 'example.org',
                    'Date': 'Tue, 07 Jun 2014 20:51:35 GMT',
                    'Content-Type': 'application/json',
                    'Digest': 'SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=',
                    'Content-Length': '18',
                },
            };
            let signer: SigningKey;
            beforeEach('stub signer', () => {
                signer = {
                    sign: stub().resolves(Buffer.from('a fake signature')),
                };
            });
            it('signs a request', async () => {
                const signed = await cavage.signMessage({
                    key: signer,
                    params: [
                        'keyid',
                        'alg',
                        'created',
                        'expires',
                    ],
                    fields: [
                        '@request-target',
                        '@created',
                        '@expires',
                        'host',
                        'digest',
                        'content-length',
                    ],
                    paramValues: {
                        keyid: 'rsa-key-1',
                        alg: 'hs2019',
                        created: new Date(1402170695 * 1000),
                        expires: new Date(1402170995 * 1000),
                    },
                }, request);
                expect(signed.headers).to.deep.equal({
                    'Host': 'example.org',
                    'Date': 'Tue, 07 Jun 2014 20:51:35 GMT',
                    'Content-Type': 'application/json',
                    'Digest': 'SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=',
                    'Content-Length': '18',
                    'Signature': 'keyId="rsa-key-1", algorithm="hs2019", created=1402170695, expires=1402170995, headers="(request-target) (created) (expires) host digest content-length", signature="YSBmYWtlIHNpZ25hdHVyZQ=="',
                });
                expect(signer.sign).to.have.been.calledOnceWithExactly(Buffer.from(
                    '(request-target): post /foo\n' +
                    '(created): 1402170695\n' +
                    '(expires): 1402170995\n' +
                    'host: example.org\n' +
                    'digest: SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=\n' +
                    'content-length: 18'
                ));
            });
        });
        describe('responses', () => {
            const response: Response = {
                status: 503,
                headers: {
                    'Date': 'Tue, 20 Apr 2021 02:07:56 GMT',
                    'Content-Type': 'application/json',
                    'Content-Length': '62',
                },
            };
            let signer: SigningKey;
            beforeEach('stub signer', () => {
                signer = {
                    sign: stub().resolves(Buffer.from('a fake signature')),
                };
            });
            it('signs a response', async () => {
                const signed = await cavage.signMessage({
                    key: signer,
                    fields: ['content-length', 'content-type'],
                    params: ['created', 'keyid'],
                    paramValues: {
                        created: new Date(1618884479 * 1000),
                        keyid: 'test-key-ecc-p256',
                    },
                }, response);
                expect(signed.headers).to.deep.equal({
                    'Date': 'Tue, 20 Apr 2021 02:07:56 GMT',
                    'Content-Type': 'application/json',
                    'Content-Length': '62',
                    'Signature': 'created=1618884479, keyId="test-key-ecc-p256", headers="content-length content-type", signature="YSBmYWtlIHNpZ25hdHVyZQ=="',
                });
                expect(signer.sign).to.have.been.calledOnceWithExactly(Buffer.from(
                    'content-length: 62\n' +
                    'content-type: application/json'
                ));
            });
        });
    });
    describe('.verifyMessage', () => {
        describe('requests', () => {
            const request: Request = {
                method: 'post',
                url: 'https://example.com/foo?param=value&pet=dog',
                headers: {
                    'Host': 'example.com',
                    'Date': 'Tue, 07 Jun 2014 20:51:35 GMT',
                    'Content-Type': 'application/json',
                    'Digest': 'SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=',
                    'Content-Length': '18',
                    'Signature': 'keyId="test-key-a", algorithm="hs2019", created=1402170695, headers="(request-target) (created) host date content-type digest content-length", signature="KXUj1H3ZOhv3Nk4xlRLTn4bOMlMOmFiud3VXrMa9MaLCxnVmrqOX5BulRvB65YW/wQp0oT/nNQpXgOYeY8ovmHlpkRyz5buNDqoOpRsCpLGxsIJ9cX8XVsM9jy+Q1+RIlD9wfWoPHhqhoXt35ZkasuIDPF/AETuObs9QydlsqONwbK+TdQguDK/8Va1Pocl6wK1uLwqcXlxhPEb55EmdYB9pddDyHTADING7K4qMwof2mC3t8Pb0yoLZoZX5a4Or4FrCCKK/9BHAhq/RsVk0dTENMbTB4i7cHvKQu+o9xuYWuxyvBa0Z6NdOb0di70cdrSDEsL5Gz7LBY5J2N9KdGg=="',
                },
            };
            it('verifies a request', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-a' ? { verify: verifierStub } : null);
                const valid = await cavage.verifyMessage({
                    keyLookup,
                }, request);
                expect(valid).to.equal(true);
                expect(keyLookup).to.have.callCount(1);
                expect(verifierStub).to.have.callCount(1);
                expect(verifierStub).to.have.been.calledOnceWithExactly(
                    Buffer.from(
                        '(request-target): post /foo?param=value&pet=dog\n' +
                        '(created): 1402170695\n' +
                        'host: example.com\n' +
                        'date: Tue, 07 Jun 2014 20:51:35 GMT\n' +
                        'content-type: application/json\n' +
                        'digest: SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=\n' +
                        'content-length: 18',
                    ),
                    Buffer.from('KXUj1H3ZOhv3Nk4xlRLTn4bOMlMOmFiud3VXrMa9MaLCxnVmrqOX5BulRvB65YW/wQp0oT/nNQpXgOYeY8ovmHlpkRyz5buNDqoOpRsCpLGxsIJ9cX8XVsM9jy+Q1+RIlD9wfWoPHhqhoXt35ZkasuIDPF/AETuObs9QydlsqONwbK+TdQguDK/8Va1Pocl6wK1uLwqcXlxhPEb55EmdYB9pddDyHTADING7K4qMwof2mC3t8Pb0yoLZoZX5a4Or4FrCCKK/9BHAhq/RsVk0dTENMbTB4i7cHvKQu+o9xuYWuxyvBa0Z6NdOb0di70cdrSDEsL5Gz7LBY5J2N9KdGg==', 'base64'),
                    {
                        created: new Date(1402170695 * 1000),
                        keyid: 'test-key-a',
                        alg: 'rsa-pss-sha512',
                    },
                );
            });
        });
        describe('responses', () => {
            const response: Response = {
                status: 200,
                headers: {
                    'Date': 'Tue, 07 Jun 2014 20:51:35 GMT',
                    'Content-Type': 'application/json',
                    'Digest': 'SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=',
                    'Content-Length': '18',
                    'Signature': 'keyId="test-key-a", algorithm="hs2019", created=1402170695, headers="(created) date content-type digest content-length", signature="KXUj1H3ZOhv3Nk4xlRLTn4bOMlMOmFiud3VXrMa9MaLCxnVmrqOX5BulRvB65YW/wQp0oT/nNQpXgOYeY8ovmHlpkRyz5buNDqoOpRsCpLGxsIJ9cX8XVsM9jy+Q1+RIlD9wfWoPHhqhoXt35ZkasuIDPF/AETuObs9QydlsqONwbK+TdQguDK/8Va1Pocl6wK1uLwqcXlxhPEb55EmdYB9pddDyHTADING7K4qMwof2mC3t8Pb0yoLZoZX5a4Or4FrCCKK/9BHAhq/RsVk0dTENMbTB4i7cHvKQu+o9xuYWuxyvBa0Z6NdOb0di70cdrSDEsL5Gz7LBY5J2N9KdGg=="',
                },
            };
            it('verifies a response', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-a' ? { verify: verifierStub } : null);
                const result = await cavage.verifyMessage({
                    keyLookup,
                }, response);
                expect(result).to.equal(true);
                expect(verifierStub).to.have.callCount(1);
                expect(verifierStub).to.have.been.calledOnceWithExactly(
                    Buffer.from(
                        '(created): 1402170695\n' +
                        'date: Tue, 07 Jun 2014 20:51:35 GMT\n' +
                        'content-type: application/json\n' +
                        'digest: SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=\n' +
                        'content-length: 18',
                    ),
                    Buffer.from('KXUj1H3ZOhv3Nk4xlRLTn4bOMlMOmFiud3VXrMa9MaLCxnVmrqOX5BulRvB65YW/wQp0oT/nNQpXgOYeY8ovmHlpkRyz5buNDqoOpRsCpLGxsIJ9cX8XVsM9jy+Q1+RIlD9wfWoPHhqhoXt35ZkasuIDPF/AETuObs9QydlsqONwbK+TdQguDK/8Va1Pocl6wK1uLwqcXlxhPEb55EmdYB9pddDyHTADING7K4qMwof2mC3t8Pb0yoLZoZX5a4Or4FrCCKK/9BHAhq/RsVk0dTENMbTB4i7cHvKQu+o9xuYWuxyvBa0Z6NdOb0di70cdrSDEsL5Gz7LBY5J2N9KdGg==', 'base64'),
                    {
                        created: new Date(1402170695 * 1000),
                        keyid: 'test-key-a',
                        alg: 'rsa-pss-sha512',
                    },
                );
            });
        });
    });
});
