import { Component, Parameters, RequestLike } from '../../src';
import { buildSignatureInputString, buildSignedData, extractComponent, extractHeader } from '../../src/httpbis';
import { expect } from 'chai';

describe('httpbis', () => {
    describe('.extractHeader', () => {
        const headers = {
            'Host': 'www.example.com',
            'Date': 'Tue, 20 Apr 2021 02:07:56 GMT',
            'X-OWS-Header': '  Leading and trailing whitespace. ',
            'X-Obs-Fold-Header': 'Obsolete\nline folding.',
            'Cache-Control': ['max-age=60', '   must-revalidate'],
            'Example-Dict': ' a=1,    b=2;x=1;y=2,   c=(a   b   c)',
        };
        it('correctly extracts headers', () => {
            const expected = {
                'host': 'www.example.com',
                'date': 'Tue, 20 Apr 2021 02:07:56 GMT',
                'x-ows-header': 'Leading and trailing whitespace.',
                'x-obs-fold-header': 'Obsolete line folding.',
                'cache-control': 'max-age=60, must-revalidate',
                'example-dict': 'a=1,    b=2;x=1;y=2,   c=(a   b   c)',
            };
            const parsed = Object.keys(headers).reduce((accum, name) => {
                return Object.assign(accum, {
                    [name.toLowerCase()]: extractHeader({ headers } as unknown as RequestLike, name),
                });
            }, {});
            expect(parsed).to.deep.equal(expected);
        });
        it('allows missing headers to return by default', () => {
            expect(extractHeader({ headers } as unknown as RequestLike, 'missing')).to.equal('');
        });
        it('throws on missing headers', () => {
            expect(() => extractHeader({ headers } as unknown as RequestLike, 'missing', { allowMissing: false })).to.throw(Error, 'Unable to extract header "missing" from message');
        });
        it('does not throw on missing headers', () => {
            expect(extractHeader({ headers } as unknown as RequestLike, 'missing', { allowMissing: true })).to.equal('');
        });
    });
    describe('.extractComponent', () => {
        it('correctly extracts the @method', () => {
            const result = extractComponent({
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as RequestLike, '@method');
            expect(result).to.equal('POST');
        });
        it('correctly extracts the @target-uri', () => {
            const result = extractComponent({
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as RequestLike, '@target-uri');
            expect(result).to.equal('https://www.example.com/path?param=value');
        });
        it('correctly extracts the @authority', () => {
            const result = extractComponent({
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as RequestLike, '@authority');
            expect(result).to.equal('www.example.com');
        });
        it('correctly extracts the @scheme', () => {
            const result = extractComponent({
                method: 'POST',
                url: 'http://www.example.com/path?param=value',
            } as unknown as RequestLike, '@scheme');
            expect(result).to.equal('http');
        });
        it('correctly extracts the @request-target', () => {
            const result = extractComponent({
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as RequestLike, '@request-target');
            expect(result).to.equal('/path?param=value');
        });
        it('correctly extracts the @path', () => {
            const result = extractComponent({
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as RequestLike, '@path');
            expect(result).to.equal('/path');
        });
        it('correctly extracts the @query', () => {
            const result = extractComponent({
                method: 'POST',
                url: 'https://www.example.com/path?param=value&foo=bar&baz=batman',
            } as unknown as RequestLike, '@query');
            expect(result).to.equal('?param=value&foo=bar&baz=batman');
        });
        it('correctly extracts the @query', () => {
            const result = extractComponent({
                method: 'POST',
                url: 'https://www.example.com/path?queryString',
            } as unknown as RequestLike, '@query');
            expect(result).to.equal('?queryString');
        });
        it.skip('correctly extracts the @query-params', () => {
            const result = extractComponent({
                method: 'POST',
                url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
            } as unknown as RequestLike, '@query-params');
            expect(result).to.equal('');
        });
    });
    describe('.buildSignatureInputString', () => {
        describe('specification test cases', () => {
            it('constructs minimal example', () => {
                const components: Component[] = [];
                const parameters: Parameters = {
                    created: new Date(1618884475000),
                    keyid: 'test-key-rsa-pss',
                    alg: 'rsa-pss-sha512',
                };
                const inputString = buildSignatureInputString(components, parameters);
                expect(inputString).to.equal('();created=1618884475;keyid="test-key-rsa-pss";alg="rsa-pss-sha512"');
            });
            it('constructs selective example', () => {
                const components: Component[] = ['@authority', 'Content-Type'];
                const parameters: Parameters = {
                    created: new Date(1618884475000),
                    keyid: 'test-key-rsa-pss',
                };
                const inputString = buildSignatureInputString(components, parameters);
                expect(inputString).to.equal('("@authority" "content-type");created=1618884475;keyid="test-key-rsa-pss"');
            });
            it('constructs full example', () => {
                const components: Component[] = [
                    'Date',
                    '@method',
                    '@path',
                    '@query',
                    '@authority',
                    'Content-Type',
                    'Digest',
                    'Content-Length',
                ];
                const parameters: Parameters = {
                    created: new Date(1618884475000),
                    keyid: 'test-key-rsa-pss',
                };
                const inputString = buildSignatureInputString(components, parameters);
                expect(inputString).to.equal('("date" "@method" "@path" "@query" "@authority" "content-type" "digest" "content-length");created=1618884475;keyid="test-key-rsa-pss"');
            });
        });
    });
    describe('.buildSignedData', () => {
        const testRequest: RequestLike = {
            method: 'POST',
            url: 'https://example.com/foo?param=value&pet=dog',
            headers: {
                'Host': 'example.com',
                'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                'Content-Type': 'application/json',
                'Digest': 'SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=',
                'Content-Length': '18',
            },
        };
        it('constructs minimal example', () => {
            const components: Component[] = [];
            const data = buildSignedData(testRequest, components, '();created=1618884475;keyid="test-key-rsa-pss";alg="rsa-pss-sha512"');
            expect(data).to.equal('"@signature-params": ();created=1618884475;keyid="test-key-rsa-pss";alg="rsa-pss-sha512"');
        });
        it('constructs selective example', () => {
            const components: Component[] = ['@authority', 'Content-Type'];
            const data = buildSignedData(testRequest, components, '("@authority" "content-type");created=1618884475;keyid="test-key-rsa-pss"');
            expect(data).to.equal('"@authority": example.com\n' +
                '"content-type": application/json\n' +
                '"@signature-params": ("@authority" "content-type");created=1618884475;keyid="test-key-rsa-pss"')
        });
        it('constructs full example', () => {
            const components: Component[] = [
                'Date',
                '@method',
                '@path',
                '@query',
                '@authority',
                'Content-Type',
                'Digest',
                'Content-Length',
            ];
            const data = buildSignedData(testRequest, components, '("date" "@method" "@path" "@query" "@authority" "content-type" "digest" "content-length");created=1618884475;keyid="test-key-rsa-pss"');
            expect(data).to.equal('"date": Tue, 20 Apr 2021 02:07:55 GMT\n' +
                '"@method": POST\n' +
                '"@path": /foo\n' +
                '"@query": ?param=value&pet=dog\n' +
                '"@authority": example.com\n' +
                '"content-type": application/json\n' +
                '"digest": SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=\n' +
                '"content-length": 18\n' +
                '"@signature-params": ("date" "@method" "@path" "@query" ' +
                '"@authority" "content-type" "digest" "content-length")' +
                ';created=1618884475;keyid="test-key-rsa-pss"');
        });
    });
});
