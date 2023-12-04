import { base64 } from "@scure/base";
import * as httpbis from '../../src/httpbis';
import {
    ExpiredError,
    MalformedSignatureError,
    Request,
    Response,
    SigningKey,
    UnacceptableSignatureError,
    UnknownKeyError,
    UnsupportedAlgorithmError,
} from '../../src';
import { expect } from 'chai';
import { describe } from 'mocha';
import * as MockDate from 'mockdate';
import { stub } from 'sinon';

describe('httpbis', () => {
    // test the spec as per https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-2.2
    describe('.deriveComponent', () => {
        describe('unbound components', () => {
            it('derives @method component', () => {
                const req: Request = {
                    method: 'get',
                    headers: {},
                    url: 'https://example.com/test',
                };
                // must be in uppercase
                expect(httpbis.deriveComponent('@method', new Map(), req)).to.deep.equal(['GET']);
                expect(httpbis.deriveComponent('@method', new Map(), {
                    ...req,
                    method: 'POST',
                })).to.deep.equal(['POST']);
            });
            it('derives @target-uri', () => {
                const req: Request = {
                    method: 'POST',
                    url: 'https://www.example.com/path?param=value',
                    headers: {
                        Host: 'www.example.com',
                    },
                };
                expect(httpbis.deriveComponent('@target-uri', new Map(), req)).to.deep.equal([
                    'https://www.example.com/path?param=value',
                ]);
            });
            it('derives @authority', () => {
                const req: Request = {
                    method: 'POST',
                    url: 'https://www.example.com/path?param=value',
                    headers: {
                        Host: 'www.example.com',
                    },
                };
                expect(httpbis.deriveComponent('@authority', new Map(), req)).to.deep.equal([
                    'www.example.com',
                ]);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: 'https://www.EXAMPLE.com/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: 'https://www.example.com:8080/path?param=value',
                })).to.deep.equal(['www.example.com:8080']);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: 'https://www.example.com:443/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: 'http://www.example.com:80/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: 'http://www.example.com:8080/path?param=value',
                })).to.deep.equal(['www.example.com:8080']);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: 'https://www.example.com:80/path?param=value',
                })).to.deep.equal(['www.example.com:80']);
                // with URL objects
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: new URL(req.url as string),
                })).to.deep.equal([
                    'www.example.com',
                ]);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: new URL('https://www.EXAMPLE.com/path?param=value'),
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: new URL('https://www.example.com:8080/path?param=value'),
                })).to.deep.equal(['www.example.com:8080']);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: new URL('https://www.example.com:443/path?param=value'),
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: new URL('http://www.example.com:80/path?param=value'),
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: new URL('http://www.example.com:8080/path?param=value'),
                })).to.deep.equal(['www.example.com:8080']);
                expect(httpbis.deriveComponent('@authority', new Map(), {
                    ...req,
                    url: new URL('https://www.example.com:80/path?param=value'),
                })).to.deep.equal(['www.example.com:80']);
            });
            it('derives @scheme', () => {
                const req: Request = {
                    method: 'POST',
                    url: 'https://www.example.com/path?param=value',
                    headers: {
                        Host: 'www.example.com',
                    },
                };
                expect(httpbis.deriveComponent('@scheme', new Map(), req)).to.deep.equal(['https']);
                expect(httpbis.deriveComponent('@scheme', new Map(), {
                    ...req,
                    url: 'http://example.com',
                })).to.deep.equal(['http']);
                // with URL objects
                expect(httpbis.deriveComponent('@scheme', new Map(), {
                    ...req,
                    url: new URL(req.url as string),
                })).to.deep.equal(['https']);
                expect(httpbis.deriveComponent('@scheme', new Map(), {
                    ...req,
                    url: new URL('http://example.com'),
                })).to.deep.equal(['http']);
            });
            it('derives @request-target', () => {
                const req: Request = {
                    method: 'POST',
                    url: 'https://www.example.com/path?param=value',
                    headers: {
                        Host: 'www.example.com',
                    },
                };
                // it is assumed in Node that the HTTP request is formed as
                // GET /path?param=value HTTP/1.1
                // and not:
                // GET https://www.example.com/path?param=value HTTP/1.1
                // it's not easy to determine this in Node when receiving messages
                expect(httpbis.deriveComponent('@request-target', new Map(), req)).to.deep.equal([
                    '/path?param=value',
                ]);
                // with URL objects
                expect(httpbis.deriveComponent('@request-target', new Map(), {
                    ...req,
                    url: new URL(req.url as string),
                })).to.deep.equal([
                    '/path?param=value',
                ]);
            });
            it('derives @path', () => {
                const req: Request = {
                    method: 'POST',
                    url: 'https://www.example.com/path?param=value',
                    headers: {
                        Host: 'www.example.com',
                    },
                };
                expect(httpbis.deriveComponent('@path', new Map(), req)).to.deep.equal([
                    '/path',
                ]);
                expect(httpbis.deriveComponent('@path', new Map(), {
                    ...req,
                    url: new URL(req.url as string),
                })).to.deep.equal([
                    '/path',
                ]);
            });
            it('derives @query', () => {
                const req: Request = {
                    method: 'POST',
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman',
                    headers: {
                        Host: 'www.example.com',
                    },
                };
                expect(httpbis.deriveComponent('@query', new Map(), req)).to.deep.equal([
                    '?param=value&foo=bar&baz=batman',
                ]);
                expect(httpbis.deriveComponent('@query', new Map(), {
                    ...req,
                    url: 'https://www.example.com/path?queryString',
                })).to.deep.equal([
                    '?queryString',
                ]);
                expect(httpbis.deriveComponent('@query', new Map(), {
                    ...req,
                    url: 'https://www.example.com/path',
                })).to.deep.equal([
                    '?',
                ]);
                // with URL objects
                expect(httpbis.deriveComponent('@query', new Map(), {
                    ...req,
                    url: new URL(req.url as string),
                })).to.deep.equal([
                    '?param=value&foo=bar&baz=batman',
                ]);
                expect(httpbis.deriveComponent('@query', new Map(), {
                    ...req,
                    url: new URL('https://www.example.com/path?queryString'),
                })).to.deep.equal([
                    '?queryString',
                ]);
                expect(httpbis.deriveComponent('@query', new Map(), {
                    ...req,
                    url: new URL('https://www.example.com/path'),
                })).to.deep.equal([
                    '?',
                ]);
            });
            it('derives @query-param', () => {
                const req: Request = {
                    method: 'POST',
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                    headers: {
                        Host: 'www.example.com',
                    },
                };
                expect(httpbis.deriveComponent('@query-param', new Map([['name', 'baz']]), req)).to.deep.equal([
                    'batman',
                ]);
                expect(httpbis.deriveComponent('@query-param', new Map([['name', 'qux']]), req)).to.deep.equal([
                    '',
                ]);
                expect(httpbis.deriveComponent('@query-param', new Map([['name', 'param']]), req)).to.deep.equal([
                    'value',
                ]);
                expect(httpbis.deriveComponent('@query-param', new Map([['name', 'param']]), {
                    ...req,
                    url: 'https://example.com/path?param=value&param=value2',
                })).to.deep.equal([
                    'value',
                    'value2',
                ]);
                // with URL objects
                expect(httpbis.deriveComponent('@query-param', new Map([['name', 'baz']]), {
                    ...req,
                    url: new URL(req.url as string),
                })).to.deep.equal([
                    'batman',
                ]);
                expect(httpbis.deriveComponent('@query-param', new Map([['name', 'qux']]), {
                    ...req,
                    url: new URL(req.url as string),
                })).to.deep.equal([
                    '',
                ]);
                expect(httpbis.deriveComponent('@query-param', new Map([['name', 'param']]), {
                    ...req,
                    url: new URL(req.url as string),
                })).to.deep.equal([
                    'value',
                ]);
                expect(httpbis.deriveComponent('@query-param', new Map([['name', 'param']]), {
                    ...req,
                    url: new URL('https://example.com/path?param=value&param=value2'),
                })).to.deep.equal([
                    'value',
                    'value2',
                ]);
            });
            it('derives @status', () => {
                const req: Request = {
                    method: 'POST',
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                    headers: {
                        Host: 'www.example.com',
                    },
                };
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@status', new Map(), res, req)).to.deep.equal(['200']);
            });
        });
        describe('request-response bound components', () => {
            const req: Request = {
                method: 'get',
                headers: {
                    Host: 'www.example.com',
                },
                url: 'https://www.example.com/path?param=value',
            };
            it('derives @method component', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                // must be in uppercase
                expect(httpbis.deriveComponent('@method', new Map([['req', true]]), res, req)).to.deep.equal(['GET']);
                expect(httpbis.deriveComponent('@method', new Map([['req', true]]), res, {
                    ...req,
                    method: 'POST',
                })).to.deep.equal(['POST']);
            });
            it('derives @target-uri', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@target-uri', new Map([['req', true]]), res, req)).to.deep.equal([
                    'https://www.example.com/path?param=value',
                ]);
            });
            it('derives @authority', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@authority', new Map([['req', true]]), res, req)).to.deep.equal([
                    'www.example.com',
                ]);
                expect(httpbis.deriveComponent('@authority', new Map([['req', true]]), res, {
                    ...req,
                    url: 'https://www.EXAMPLE.com/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', new Map([['req', true]]), res, {
                    ...req,
                    url: 'https://www.example.com:8080/path?param=value',
                })).to.deep.equal(['www.example.com:8080']);
                expect(httpbis.deriveComponent('@authority', new Map([['req', true]]), res, {
                    ...req,
                    url: 'https://www.example.com:443/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', new Map([['req', true]]), res, {
                    ...req,
                    url: 'http://www.example.com:80/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', new Map([['req', true]]), res, {
                    ...req,
                    url: 'https://www.example.com:80/path?param=value',
                })).to.deep.equal(['www.example.com:80']);
            });
            it('derives @scheme', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@scheme', new Map([['req', true]]), res, req)).to.deep.equal(['https']);
                expect(httpbis.deriveComponent('@scheme', new Map([['req', true]]), res, {
                    ...req,
                    url: 'http://example.com',
                })).to.deep.equal(['http']);
            });
            it('derives @request-target', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                // it is assumed in Node that the HTTP request is formed as
                // GET /path?param=value HTTP/1.1
                // and not:
                // GET https://www.example.com/path?param=value HTTP/1.1
                // it's not easy to determine this in Node when receiving messages
                expect(httpbis.deriveComponent('@request-target', new Map([['req', true]]), res, req)).to.deep.equal([
                    '/path?param=value',
                ]);
            });
            it('derives @path', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@path', new Map([['req', true]]), res, req)).to.deep.equal([
                    '/path',
                ]);
            });
            it('derives @query', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@query', new Map([['req', true]]), res, req)).to.deep.equal([
                    '?param=value',
                ]);
                expect(httpbis.deriveComponent('@query', new Map([['req', true]]), res, {
                    ...req,
                    url: 'https://www.example.com/path?queryString',
                })).to.deep.equal([
                    '?queryString',
                ]);
                expect(httpbis.deriveComponent('@query', new Map([['req', true]]), res, {
                    ...req,
                    url: 'https://www.example.com/path',
                })).to.deep.equal([
                    '?',
                ]);
            });
            it('derives @query-param', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@query-param', new Map<string, string | boolean | number>([['req', true], ['name', 'baz']]), res, {
                    ...req,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    'batman',
                ]);
                expect(httpbis.deriveComponent('@query-param', new Map<string, string | boolean | number>([['req', true], ['name', 'qux']]), res, {
                    ...req,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    '',
                ]);
                expect(httpbis.deriveComponent('@query-param', new Map<string, string | boolean | number>([['req', true], ['name', 'param']]), res, {
                    ...req,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    'value',
                ]);
                expect(httpbis.deriveComponent('@query-param', new Map<string, string | boolean | number>([['req', true], ['name', 'param']]), res, {
                    ...req,
                    url: 'https://example.com/path?param=value&param=value2',
                })).to.deep.equal([
                    'value',
                    'value2',
                ]);
            });
            it('throws if no req supplied for req bound component', () => {
                try {
                    httpbis.deriveComponent('@method', new Map([['req', false]]), {} as Request);
                } catch (e) {
                    expect(e).to.have.property('message', 'Missing request in request-response bound component');
                    return;
                }
                expect.fail('Expected to throw');
            });
        });
        describe('error conditions', () => {
            const response: Response = {
                status: 200,
                headers: {},
            };
            [
                '@method',
                '@target-uri',
                '@authority',
                '@scheme',
                '@request-target',
                '@path',
                '@query',
                '@unknown',
            ].forEach((component) => {
                it(`throws for ${component} on response`, () => {
                    try {
                        httpbis.deriveComponent(component, new Map(), response);
                    } catch (e) {
                        expect(e).to.be.instanceOf(Error);
                        return;
                    }
                    expect.fail('Expected to throw');
                });
            });
            it('throws for @query-param on response', () => {
                try {
                    httpbis.deriveComponent('@query-param', new Map(), response);
                } catch (e) {
                    expect(e).to.be.instanceOf(Error);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws for missing @query-param name', () => {
                try {
                    httpbis.deriveComponent('@query-param', new Map(), {
                        method: 'POST',
                        url: 'http://example.com/?name=test',
                        headers: {},
                    });
                } catch (e) {
                    expect(e).to.be.instanceOf(Error);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws for missing @query-param', () => {
                try {
                    httpbis.deriveComponent('@query-param', new Map([['name', 'missing']]), {
                        method: 'POST',
                        url: 'http://example.com/?name=test',
                        headers: {},
                    });
                } catch (e) {
                    expect(e).to.be.instanceOf(Error);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws for @status on request', () => {
                try {
                    httpbis.deriveComponent('@status', new Map(), {
                        method: 'POST',
                        url: 'http://example.com/?name=test',
                        headers: {},
                    });
                } catch (e) {
                    expect(e).to.be.instanceOf(Error);
                    return;
                }
                expect.fail('Expected to throw');
            });
        });
    });
    describe('.extractHeader', () => {
        describe('general header extraction', () => {
            const headers = {
                'testheader': 'test',
                'test-header-1': 'test1',
                'Test-Header-2': 'test2',
                'test-Header-3': 'test3',
                'TEST-HEADER-4': 'test4',
            };
            Object.entries(headers).forEach(([headerName, expectedValue]) => {
                it(`successfully extracts a matching header (${headerName})`, () => {
                    expect(httpbis.extractHeader(headerName.toLowerCase(), new Map(), { headers } as unknown as Request)).to.deep.equal([expectedValue]);
                });
            });
            it('throws on missing headers', () => {
                expect(() => httpbis.extractHeader('missing', new Map(), { headers } as unknown as Request)).to.throw(Error, 'No header "missing" found in headers');
            });
        });
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
                expect(httpbis.extractHeader('host', new Map(), request)).to.deep.equal(['www.example.com']);
                expect(httpbis.extractHeader('date', new Map(), request)).to.deep.equal(['Tue, 20 Apr 2021 02:07:56 GMT']);
                expect(httpbis.extractHeader('x-ows-header', new Map(), request)).to.deep.equal(['Leading and trailing whitespace.']);
                expect(httpbis.extractHeader('x-obs-fold-header', new Map(), request)).to.deep.equal(['Obsolete line folding.']);
                expect(httpbis.extractHeader('cache-control', new Map(), request)).to.deep.equal(['max-age=60, must-revalidate']);
                expect(httpbis.extractHeader('example-dict', new Map(), request)).to.deep.equal(['a=1,    b=2;x=1;y=2,   c=(a   b   c)']);
                expect(httpbis.extractHeader('x-empty-header', new Map(), request)).to.deep.equal(['']);
            });
        });
        describe('sf headers', () => {
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
            it('serializes a dictionary', () => {
                expect(httpbis.extractHeader('example-dict', new Map([['sf', true]]), request)).to.deep.equal(['a=1, b=2;x=1;y=2, c=(a b c)']);
            });
        });
        describe('key from structured header', () => {
            const request: Request = {
                method: 'POST',
                url: 'https://www.example.com/',
                headers: {
                    'Host': 'www.example.com',
                    'Example-Dict': ' a=1, b=2;x=1;y=2, c=(a   b    c), d',
                },
            };
            it('pulls out an integer key', () => {
                expect(httpbis.extractHeader('example-dict', new Map([['key', 'a']]), request)).to.deep.equal(['1']);
            });
            it('pulls out a boolean key', () => {
                expect(httpbis.extractHeader('example-dict', new Map([['key', 'd']]), request)).to.deep.equal(['?1']);
            });
            it('pulls out parameters', () => {
                expect(httpbis.extractHeader('example-dict', new Map([['key', 'b']]), request)).to.deep.equal(['2;x=1;y=2']);
            });
            it('pulls out an inner list', () => {
                expect(httpbis.extractHeader('example-dict', new Map([['key', 'c']]), request)).to.deep.equal(['(a b c)']);
            });
        });
        describe('bs from header', () => {
            const request: Request = {
                method: 'POST',
                url: 'https://www.example.com/',
                headers: {
                    'Host': 'www.example.com',
                    'Example-Header': ['value, with, lots', 'of, commas'],
                },
            };
            it('encodes multiple headers separately', () => {
                expect(httpbis.extractHeader('example-header', new Map([['bs', true]]), request)).to.deep.equal([':dmFsdWUsIHdpdGgsIGxvdHM=:, :b2YsIGNvbW1hcw==:']);
                expect(httpbis.extractHeader('example-header', new Map([['bs', true]]), {
                    ...request,
                    headers: {
                        ...request.headers,
                        'Example-Header': 'value, with, lots, of, commas',
                    },
                })).to.deep.equal([':dmFsdWUsIHdpdGgsIGxvdHMsIG9mLCBjb21tYXM=:']);
            });
        });
        describe('request-response bound header', () => {
            const request: Request = {
                method: 'post',
                url: 'https://example.com/foo?param=Value&Pet=dog',
                headers: {
                    'Host': 'example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                    'Content-Type': 'application/json',
                    'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                    'Content-Length': '18',
                    'Signature-Input': 'sig1=("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884475;keyid="test-key-rsa-pss"',
                    'Signature': 'sig1=:LAH8BjcfcOcLojiuOBFWn0P5keD3xAOuJRGziCLuD8r5MW9S0RoXXLzLSRfGY/3SF8kVIkHjE13SEFdTo4Af/fJ/Pu9wheqoLVdwXyY/UkBIS1M8Brc8IODsn5DFIrG0IrburbLi0uCc+E2ZIIb6HbUJ+o+jP58JelMTe0QE3IpWINTEzpxjqDf5/Df+InHCAkQCTuKsamjWXUpyOT1Wkxi7YPVNOjW4MfNuTZ9HdbD2Tr65+BXeTG9ZS/9SWuXAc+BZ8WyPz0QRz//ec3uWXd7bYYODSjRAxHqX+S1ag3LZElYyUKaAIjZ8MGOt4gXEwCSLDv/zqxZeWLj/PDkn6w==:',
                },
            };
            const response: Response = {
                status: 503,
                headers: {
                    'Date': 'Tue, 20 Apr 2021 02:07:56 GMT',
                    'Content-Type': 'application/json',
                    'Content-Length': '62',
                },
            };
            it('binds requests and responses', () => {
                expect(httpbis.extractHeader('signature', new Map<string, string | boolean | number>([['req', true], ['key', 'sig1']]), response, request)).to.deep.equal([
                    ':LAH8BjcfcOcLojiuOBFWn0P5keD3xAOuJRGziCLuD8r5MW9S0RoXXLzLSRfGY/3SF8kVIkHjE13SEFdTo4Af/fJ/Pu9wheqoLVdwXyY/UkBIS1M8Brc8IODsn5DFIrG0IrburbLi0uCc+E2ZIIb6HbUJ+o+jP58JelMTe0QE3IpWINTEzpxjqDf5/Df+InHCAkQCTuKsamjWXUpyOT1Wkxi7YPVNOjW4MfNuTZ9HdbD2Tr65+BXeTG9ZS/9SWuXAc+BZ8WyPz0QRz//ec3uWXd7bYYODSjRAxHqX+S1ag3LZElYyUKaAIjZ8MGOt4gXEwCSLDv/zqxZeWLj/PDkn6w==:',
                ]);
            });
        });
        describe('error cases', () => {
            const response: Response = {
                status: 200,
                headers: {
                    Date: 'Tue, 20 Apr 2021 02:07:56 GMT',
                    structured: 'test=123',
                    notadict: '(a b c)',
                },
            };
            it('throws if no request context', () => {
                try {
                    httpbis.extractHeader('structured', new Map([['req', false]]), response);
                } catch (e) {
                    expect(e).to.be.an.instanceOf(Error);
                    return;
                }
                expect.fail('Expected to fail');
            });
            it('throws if both bs/sf params provided', () => {
                try {
                    httpbis.extractHeader('structured', new Map([['sf', false], ['bs', false]]), response);
                } catch (e) {
                    expect(e).to.be.an.instanceOf(Error);
                    return;
                }
                expect.fail('Expected to fail');
            });
            it('throws if both bs and implicit sf params provided', () => {
                try {
                    httpbis.extractHeader('structured', new Map<string, string | number | boolean>([['bs', false], ['key', 'val']]), response);
                } catch (e) {
                    expect(e).to.be.an.instanceOf(Error);
                    return;
                }
                expect.fail('Expected to fail');
            });
            it('throws if sf params provided for non structured field', () => {
                try {
                    httpbis.extractHeader('date', new Map<string, string | number | boolean>([['sf', false], ['key', 'val']]), response);
                } catch (e) {
                    expect(e).to.be.an.instanceOf(Error);
                    return;
                }
                expect.fail('Expected to fail');
            });
            it('throws if sf params provided for non dictionary', () => {
                try {
                    httpbis.extractHeader('notadict', new Map<string, string | number | boolean>([['sf', false], ['key', 'val']]), response);
                } catch (e) {
                    expect(e).to.be.an.instanceOf(Error);
                    return;
                }
                expect.fail('Expected to fail');
            });
            it('throws if key is missing for structured field', () => {
                try {
                    httpbis.extractHeader('structured', new Map<string, string | number | boolean>([['key', 'val']]), response);
                } catch (e) {
                    expect(e).to.be.an.instanceOf(Error);
                    return;
                }
                expect.fail('Expected to fail');
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
                expect(httpbis.createSignatureBase({ fields: [
                    'host',
                    'date',
                    'x-ows-header',
                    'x-obs-fold-header',
                    'cache-control',
                    'example-dict',
                ] }, request)).to.deep.equal([
                    ['"host"', ['www.example.com']],
                    ['"date"', ['Tue, 20 Apr 2021 02:07:56 GMT']],
                    ['"x-ows-header"', ['Leading and trailing whitespace.']],
                    ['"x-obs-fold-header"', ['Obsolete line folding.']],
                    ['"cache-control"', ['max-age=60, must-revalidate']],
                    ['"example-dict"', ['a=1,    b=2;x=1;y=2,   c=(a   b   c)']],
                ]);
            });
            it('extracts an empty header', () => {
                expect(httpbis.createSignatureBase({ fields: [
                    'x-empty-header',
                ] }, request)).to.deep.equal([
                    ['"x-empty-header"', ['']],
                ]);
            });
            it('extracts strict formatted headers', () => {
                expect(httpbis.createSignatureBase({ fields: [
                    'example-dict;sf',
                ] }, request)).to.deep.equal([
                    ['"example-dict";sf', ['a=1, b=2;x=1;y=2, c=(a b c)']],
                ]);
            });
            it('extracts keys from dictionary headers', () => {
                expect(httpbis.createSignatureBase({ fields: [
                    'example-dict;key="a"',
                    'example-dict;key="d"',
                    'example-dict;key="b"',
                    'example-dict;key="c"',
                ] }, {
                    ...request,
                    headers: {
                        ...request.headers,
                        'Example-Dict': '  a=1, b=2;x=1;y=2, c=(a   b    c), d',
                    },
                })).to.deep.equal([
                    ['"example-dict";key="a"', ['1']],
                    ['"example-dict";key="d"', ['?1']],
                    ['"example-dict";key="b"', ['2;x=1;y=2']],
                    ['"example-dict";key="c"', ['(a b c)']],
                ]);
            });
            it('extracts binary formatted headers', () => {
                expect(httpbis.createSignatureBase({ fields: [
                    'example-header;bs',
                ] }, {
                    ...request,
                    headers: {
                        'Example-Header': ['value, with, lots', 'of, commas'],
                    },
                } as Request)).to.deep.equal([
                    ['"example-header";bs', [':dmFsdWUsIHdpdGgsIGxvdHM=:, :b2YsIGNvbW1hcw==:']],
                ]);
                expect(httpbis.createSignatureBase({ fields: [
                    'example-header;bs',
                ] }, {
                    ...request,
                    headers: {
                        'Example-Header': ['value, with, lots, of, commas'],
                    },
                } as Request)).to.deep.equal([
                    ['"example-header";bs', [':dmFsdWUsIHdpdGgsIGxvdHMsIG9mLCBjb21tYXM=:']],
                ]);
            });
            it('ignores @signature-params component', () => {
                expect(httpbis.createSignatureBase({ fields: [
                    'host',
                    'date',
                    'x-ows-header',
                    'x-obs-fold-header',
                    'cache-control',
                    'example-dict',
                    '@signature-params',
                ] }, request)).to.deep.equal([
                    ['"host"', ['www.example.com']],
                    ['"date"', ['Tue, 20 Apr 2021 02:07:56 GMT']],
                    ['"x-ows-header"', ['Leading and trailing whitespace.']],
                    ['"x-obs-fold-header"', ['Obsolete line folding.']],
                    ['"cache-control"', ['max-age=60, must-revalidate']],
                    ['"example-dict"', ['a=1,    b=2;x=1;y=2,   c=(a   b   c)']],
                ]);
            });
            it('ignores @signature-params component with arbitrary params', () => {
                expect(httpbis.createSignatureBase({ fields: [
                    'host',
                    'date',
                    'x-ows-header',
                    'x-obs-fold-header',
                    'cache-control',
                    'example-dict',
                    '@signature-params;test=:AAA=:;test2=test',
                ] }, request)).to.deep.equal([
                    ['"host"', ['www.example.com']],
                    ['"date"', ['Tue, 20 Apr 2021 02:07:56 GMT']],
                    ['"x-ows-header"', ['Leading and trailing whitespace.']],
                    ['"x-obs-fold-header"', ['Obsolete line folding.']],
                    ['"cache-control"', ['max-age=60, must-revalidate']],
                    ['"example-dict"', ['a=1,    b=2;x=1;y=2,   c=(a   b   c)']],
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
            it('derives @method', () => {
                expect(httpbis.createSignatureBase({ fields: ['@method'] }, request)).to.deep.equal([
                    ['"@method"', ['POST']],
                ]);
            });
            it('derives @target-uri', () => {
                expect(httpbis.createSignatureBase({ fields: ['@target-uri'] }, request)).to.deep.equal([
                    ['"@target-uri"', ['https://www.example.com/path?param=value']],
                ]);
            });
            it('derives @authority', () => {
                expect(httpbis.createSignatureBase({ fields: ['@authority'] }, request)).to.deep.equal([
                    ['"@authority"', ['www.example.com']],
                ]);
            });
            it('derives @scheme', () => {
                expect(httpbis.createSignatureBase({ fields: ['@scheme'] }, request)).to.deep.equal([
                    ['"@scheme"', ['https']],
                ]);
            });
            it('derives @request-target', () => {
                expect(httpbis.createSignatureBase({ fields: ['@request-target'] }, request)).to.deep.equal([
                    ['"@request-target"', ['/path?param=value']],
                ]);
            });
            it('derives @path', () => {
                expect(httpbis.createSignatureBase({ fields: ['@path'] }, request)).to.deep.equal([
                    ['"@path"', ['/path']],
                ]);
            });
            it('derives @query', () => {
                expect(httpbis.createSignatureBase({ fields: ['@query'] }, {
                    ...request,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman',
                })).to.deep.equal([
                    ['"@query"', ['?param=value&foo=bar&baz=batman']],
                ]);
                expect(httpbis.createSignatureBase({ fields: ['@query'] }, {
                    ...request,
                    url: 'https://www.example.com/path?queryString',
                })).to.deep.equal([
                    ['"@query"', ['?queryString']],
                ]);
                expect(httpbis.createSignatureBase({ fields: ['@query'] }, {
                    ...request,
                    url: 'https://www.example.com/path',
                })).to.deep.equal([
                    ['"@query"', ['?']],
                ]);
            });
            it('derives @query-param', () => {
                expect(httpbis.createSignatureBase({ fields: ['@query-param;name="baz"'] }, {
                    ...request,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    ['"@query-param";name="baz"', ['batman']],
                ]);
                expect(httpbis.createSignatureBase({ fields: ['@query-param;name="qux"'] }, {
                    ...request,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    ['"@query-param";name="qux"', ['']],
                ]);
                expect(httpbis.createSignatureBase({ fields: ['@query-param;name="param"'] }, {
                    ...request,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    ['"@query-param";name="param"', ['value']],
                ]);
            });
            it('derives @status', () => {
                expect(httpbis.createSignatureBase({ fields: ['@status'] }, {
                    status: 200,
                    headers: {},
                }, request)).to.deep.equal([
                    ['"@status"', ['200']],
                ]);
            });
        });
        describe('user derived component', () => {
            const req: Request = {
                method: 'get',
                headers: {
                    Host: 'www.example.com',
                },
                url: 'https://www.example.com/path?param=value',
            };
            it('resolves a component with a supplied resolver', () => {
                const resolver = stub();
                resolver.withArgs('@custom').returns(['my value']);
                resolver.returns(null)
                expect(httpbis.createSignatureBase({ fields: ['@custom', '@method'], componentParser: resolver }, req)).to.deep.equal([
                    ['"@custom"', ['my value']],
                    ['"@method"', ['GET']],
                ]);
                expect(resolver).to.have.callCount(2);
                expect(resolver).to.have.been.calledWith('@custom', new Map(), req);
                expect(resolver).to.have.been.calledWith('@method', new Map(), req);
            });
        })
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
                expect(httpbis.createSignatureBase({ fields: [
                    '@method',
                    '@authority',
                    '@path',
                    'content-digest',
                    'content-length',
                    'content-type',
                ] }, request)).to.deep.equal([
                    ['"@method"', ['POST']],
                    ['"@authority"', ['example.com']],
                    ['"@path"', ['/foo']],
                    ['"content-digest"', ['sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:']],
                    ['"content-length"', ['18']],
                    ['"content-type"', ['application/json']],
                    // note that we don't add the `@signature-params until the signature is actually constructed
                ]);
            });
        });
    });
    describe('.formatSignatureBase', () => {
        it('formats @method', () => {
            expect(httpbis.formatSignatureBase([
                ['"@method"', ['POST']],
            ])).to.equal('"@method": POST');
        });
        it('derives @target-uri', () => {
            expect(httpbis.formatSignatureBase([
                ['"@target-uri"', ['https://www.example.com/path?param=value']],
            ])).to.equal('"@target-uri": https://www.example.com/path?param=value');
        });
        it('derives @authority', () => {
            expect(httpbis.formatSignatureBase([
                ['"@authority"', ['www.example.com']],
            ])).to.equal('"@authority": www.example.com');
        });
        it('derives @scheme', () => {
            expect(httpbis.formatSignatureBase([
                ['"@scheme"', ['https']],
            ])).to.equal('"@scheme": https');
        });
        it('derives @request-target', () => {
            expect(httpbis.formatSignatureBase([
                ['"@request-target"', ['/path?param=value']],
            ])).to.equal('"@request-target": /path?param=value');
        });
        it('derives @path', () => {
            expect(httpbis.formatSignatureBase([
                ['"@path"', ['/path']],
            ])).to.equal('"@path": /path');
        });
        it('derives @query', () => {
            expect(httpbis.formatSignatureBase([
                ['"@query"', ['?param=value&foo=bar&baz=batman']],
            ])).to.equal('"@query": ?param=value&foo=bar&baz=batman');
            expect(httpbis.formatSignatureBase([
                ['"@query"', ['?queryString']],
            ])).to.equal('"@query": ?queryString');
            expect(httpbis.formatSignatureBase([
                ['"@query"', ['?']],
            ])).to.equal('"@query": ?');
        });
        it('derives @query-param', () => {
            expect(httpbis.formatSignatureBase([
                ['"@query-param";name="baz"', ['batman']],
            ])).to.equal('"@query-param";name="baz": batman');
            expect(httpbis.formatSignatureBase([
                ['"@query-param";name="qux"', ['']],
            ])).to.equal('"@query-param";name="qux": ');
            expect(httpbis.formatSignatureBase([
                ['"@query-param";name="param"', ['value']],
            ])).to.equal('"@query-param";name="param": value');
        });
        it('derives @status', () => {
            expect(httpbis.formatSignatureBase([
                ['"@status"', ['200']],
            ])).to.equal('"@status": 200');
        });
        it('formats many headers', () => {
            expect(httpbis.formatSignatureBase([
                ['"host"', ['www.example.com']],
                ['"date"', ['Tue, 20 Apr 2021 02:07:56 GMT']],
                ['"x-ows-header"', ['Leading and trailing whitespace.']],
                ['"x-obs-fold-header"', ['Obsolete line folding.']],
                ['"cache-control"', ['max-age=60, must-revalidate']],
                ['"example-dict"', ['a=1,    b=2;x=1;y=2,   c=(a   b   c)']],
                ['"x-empty-header"', ['']],
            ])).to.equal('"host": www.example.com\n' +
                '"date": Tue, 20 Apr 2021 02:07:56 GMT\n' +
                '"x-ows-header": Leading and trailing whitespace.\n' +
                '"x-obs-fold-header": Obsolete line folding.\n' +
                '"cache-control": max-age=60, must-revalidate\n' +
                '"example-dict": a=1,    b=2;x=1;y=2,   c=(a   b   c)\n' +
                '"x-empty-header": ');
        });
        it('formats strict formatted headers', () => {
            expect(httpbis.formatSignatureBase([
                ['"example-dict";sf', ['a=1, b=2;x=1;y=2, c=(a b c)']],
            ])).to.equal('"example-dict";sf: a=1, b=2;x=1;y=2, c=(a b c)');
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
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
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
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
                        alg: 'rsa123',
                    },
                    paramValues: { created: null },
                }, ).entries())).to.deep.equal([
                    ['keyid', '123'],
                    ['alg', 'rsa123'],
                ]);
            });
            it('calculates expires if created passed', () => {
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
                        alg: 'rsa123',
                    },
                    paramValues: { created: new Date() },
                }, ).entries())).to.deep.equal([
                    ['keyid', '123'],
                    ['alg', 'rsa123'],
                    ['created', 1664267652],
                    ['expires', 1664267952],
                ]);
            });
            it('uses a custom expires if passed', () => {
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
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
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
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
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
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
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
                    },
                }).entries())).to.deep.equal([
                    ['keyid', '123'],
                    ['created', 1664267652],
                    ['expires', 1664267952],
                ]);
            });
            it('handles missing keyid', () => {
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
                    },
                }).entries())).to.deep.equal([
                    ['created', 1664267652],
                    ['expires', 1664267952],
                ]);
            });
            it('returns nothing if no data', () => {
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
                    },
                    paramValues: { created: null },
                }).entries())).to.deep.equal([]);
            });
        });
        describe('specified params', () => {
            it('returns specified params', () => {
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        alg: 'rsa',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
                    },
                    params: ['created', 'keyid', 'alg'],
                }).entries())).to.deep.equal([
                    ['created', 1664267652],
                    ['keyid', '123'],
                    ['alg', 'rsa'],
                ]);
            });
            it('returns arbitrary params', () => {
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        alg: 'rsa',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
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
            it('returns arbitrary date param as number', () => {
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        alg: 'rsa',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
                    },
                    params: ['created', 'keyid', 'alg', 'custom'],
                    paramValues: { custom: new Date(Date.now() + 1000) },
                }).entries())).to.deep.equal([
                    ['created', 1664267652],
                    ['keyid', '123'],
                    ['alg', 'rsa'],
                    ['custom', 1664267653],
                ]);
            });
            it('ignores arbitrary param with no value', () => {
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        id: '123',
                        alg: 'rsa',
                        sign: () => Promise.resolve(new TextEncoder().encode('')),
                    },
                    params: ['created', 'keyid', 'alg', 'custom'],
                }).entries())).to.deep.equal([
                    ['created', 1664267652],
                    ['keyid', '123'],
                    ['alg', 'rsa'],
                ]);
            });
        });
    });
    describe('.augmentHeaders', () => {
        it('adds a new signature and input header', () => {
            expect(httpbis.augmentHeaders({}, new TextEncoder().encode('a fake signature'), '("@method";req);created=12345')).to.deep.equal({
                'Signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                'Signature-Input': 'sig=("@method";req);created=12345',
            });
        });
        it('adds to an existing headers', () => {
            expect(httpbis.augmentHeaders({
                'signature': 'sig1=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                'signature-input': 'sig1=("@method";req);created=12345',
            }, new TextEncoder().encode('another fake signature'), '("@request-target";req);created=12345')).to.deep.equal({
                'signature': 'sig1=:YSBmYWtlIHNpZ25hdHVyZQ==:, sig=:YW5vdGhlciBmYWtlIHNpZ25hdHVyZQ==:',
                'signature-input': 'sig1=("@method";req);created=12345, sig=("@request-target";req);created=12345',
            });
        });
        it('avoids naming clashes with existing signatures', () => {
            expect(httpbis.augmentHeaders({
                'signature': ['sig=:YSBmYWtlIHNpZ25hdHVyZQ==:', 'sig0=:YSBmYWtlIHNpZ25hdHVyZQ==:'],
                'signature-input': ['sig=("@method";req);created=12345', 'sig0=("@method";req);created=12345'],
            }, new TextEncoder().encode('another fake signature'), '("@request-target";req);created=12345')).to.deep.equal({
                'signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:, sig0=:YSBmYWtlIHNpZ25hdHVyZQ==:, sig1=:YW5vdGhlciBmYWtlIHNpZ25hdHVyZQ==:',
                'signature-input': 'sig=("@method";req);created=12345, sig0=("@method";req);created=12345, sig1=("@request-target";req);created=12345',
            });
        });
        it('uses a provided signature name', () => {
            expect(httpbis.augmentHeaders({
                'signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                'signature-input': 'sig=("@method";req);created=12345',
            }, new TextEncoder().encode('another fake signature'), '("@request-target";req);created=12345', 'reqres')).to.deep.equal({
                'signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:, reqres=:YW5vdGhlciBmYWtlIHNpZ25hdHVyZQ==:',
                'signature-input': 'sig=("@method";req);created=12345, reqres=("@request-target";req);created=12345',
            });
        });
    });
    describe('.signMessage', () => {
        describe('requests', () => {
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
            let signer: SigningKey;
            beforeEach('stub signer', () => {
                signer = {
                    sign: stub().resolves(new TextEncoder().encode('a fake signature')),
                };
            });
            it('signs a request', async () => {
                const signed = await httpbis.signMessage({
                    key: signer,
                    params: [
                        'created',
                        'keyid',
                    ],
                    fields: [
                        '@method',
                        '@authority',
                        '@path',
                        'content-digest',
                        'content-length',
                        'content-type',
                    ],
                    paramValues: {
                        keyid: 'test-key-rsa-pss',
                        created: new Date(1618884473 * 1000),
                    },
                }, request);
                expect(signed.headers).to.deep.equal({
                    'Host': 'example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                    'Content-Type': 'application/json',
                    'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                    'Content-Length': '18',
                    'Signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                    'Signature-Input': 'sig=("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884473;keyid="test-key-rsa-pss"',
                });
                expect(signer.sign).to.have.been.calledOnceWithExactly(new TextEncoder().encode(
                    '"@method": POST\n' +
                    '"@authority": example.com\n' +
                    '"@path": /foo\n' +
                    '"content-digest": sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:\n' +
                    '"content-length": 18\n' +
                    '"content-type": application/json\n' +
                    '"@signature-params": ("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884473;keyid="test-key-rsa-pss"'
                ));
            });
            it('signs a request with no fields', async () => {
                const signed = await httpbis.signMessage({
                    key: signer,
                    params: [
                        'created',
                        'keyid',
                    ],
                    paramValues: {
                        keyid: 'test-key-rsa-pss',
                        created: new Date(1618884473 * 1000),
                    },
                }, request);
                expect(signed.headers).to.deep.equal({
                    'Host': 'example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                    'Content-Type': 'application/json',
                    'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                    'Content-Length': '18',
                    'Signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                    'Signature-Input': 'sig=();created=1618884473;keyid="test-key-rsa-pss"',
                });
                expect(signer.sign).to.have.been.calledOnceWithExactly(new TextEncoder().encode(
                    '"@signature-params": ();created=1618884473;keyid="test-key-rsa-pss"'
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
                    sign: stub().resolves(new TextEncoder().encode('a fake signature')),
                };
            });
            it('signs a response', async () => {
                const signed = await httpbis.signMessage({
                    key: signer,
                    fields: ['@status', 'content-length', 'content-type'],
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
                    'Signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                    'Signature-Input': 'sig=("@status" "content-length" "content-type");created=1618884479;keyid="test-key-ecc-p256"',
                });
                expect(signer.sign).to.have.been.calledOnceWithExactly(new TextEncoder().encode(
                    '"@status": 503\n' +
                    '"content-length": 62\n' +
                    '"content-type": application/json\n' +
                    '"@signature-params": ("@status" "content-length" "content-type");created=1618884479;keyid="test-key-ecc-p256"'
                ));
            });
        });
        describe('request bound responses', () => {
            const request: Request = {
                method: 'post',
                url: 'https://example.com/foo?param=Value&Pet=dog',
                headers: {
                    'Host': 'example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                    'Content-Type': 'application/json',
                    'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                    'Content-Length': '18',
                    'Signature-Input': 'sig1=("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884475;keyid="test-key-rsa-pss"',
                    'Signature': 'sig1=:LAH8BjcfcOcLojiuOBFWn0P5keD3xAOuJRGziCLuD8r5MW9S0RoXXLzLSRfGY/3SF8kVIkHjE13SEFdTo4Af/fJ/Pu9wheqoLVdwXyY/UkBIS1M8Brc8IODsn5DFIrG0IrburbLi0uCc+E2ZIIb6HbUJ+o+jP58JelMTe0QE3IpWINTEzpxjqDf5/Df+InHCAkQCTuKsamjWXUpyOT1Wkxi7YPVNOjW4MfNuTZ9HdbD2Tr65+BXeTG9ZS/9SWuXAc+BZ8WyPz0QRz//ec3uWXd7bYYODSjRAxHqX+S1ag3LZElYyUKaAIjZ8MGOt4gXEwCSLDv/zqxZeWLj/PDkn6w==:',
                },
            };
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
                    sign: stub().resolves(new TextEncoder().encode('a fake signature')),
                };
            });
            it('binds request-response fields', async () => {
                const signed = await httpbis.signMessage({
                    key: signer,
                    name: 'reqres',
                    fields: ['@status', 'content-length', 'content-type', 'signature;req;key="sig1"', '@authority;req', '@method;req'],
                    params: ['created', 'keyid'],
                    paramValues: {
                        created: new Date(1618884479 * 1000),
                        keyid: 'test-key-ecc-p256',
                    },
                }, response, request);
                expect(signed.headers).to.deep.equal({
                    'Date': 'Tue, 20 Apr 2021 02:07:56 GMT',
                    'Content-Type': 'application/json',
                    'Content-Length': '62',
                    'Signature': 'reqres=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                    'Signature-Input': 'reqres=("@status" "content-length" "content-type" "signature";req;key="sig1" "@authority";req "@method";req);created=1618884479;keyid="test-key-ecc-p256"',
                });
                expect(signer.sign).to.have.been.calledOnceWithExactly(new TextEncoder().encode(
                    '"@status": 503\n' +
                    '"content-length": 62\n' +
                    '"content-type": application/json\n' +
                    '"signature";req;key="sig1": :LAH8BjcfcOcLojiuOBFWn0P5keD3xAOuJRGziCLuD8r5MW9S0RoXXLzLSRfGY/3SF8kVIkHjE13SEFdTo4Af/fJ/Pu9wheqoLVdwXyY/UkBIS1M8Brc8IODsn5DFIrG0IrburbLi0uCc+E2ZIIb6HbUJ+o+jP58JelMTe0QE3IpWINTEzpxjqDf5/Df+InHCAkQCTuKsamjWXUpyOT1Wkxi7YPVNOjW4MfNuTZ9HdbD2Tr65+BXeTG9ZS/9SWuXAc+BZ8WyPz0QRz//ec3uWXd7bYYODSjRAxHqX+S1ag3LZElYyUKaAIjZ8MGOt4gXEwCSLDv/zqxZeWLj/PDkn6w==:\n' +
                    '"@authority";req: example.com\n' +
                    '"@method";req: POST\n' +
                    '"@signature-params": ("@status" "content-length" "content-type" "signature";req;key="sig1" "@authority";req "@method";req);created=1618884479;keyid="test-key-ecc-p256"'
                ));
            });
        });
    });
    describe('.verifyMessage', () => {
        describe('requests', () => {
            const request: Request = {
                method: 'post',
                url: 'https://example.com/foo?param=Value&Pet=dog',
                headers: {
                    'Host': 'example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                    'Content-Type': 'application/json',
                    'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                    'Content-Length': '18',
                    'Signature-Input': 'sig1=("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884473;keyid="test-key-rsa-pss"',
                    'Signature': 'sig1=:HIbjHC5rS0BYaa9v4QfD4193TORw7u9edguPh0AW3dMq9WImrlFrCGUDih47vAxi4L2YRZ3XMJc1uOKk/J0ZmZ+wcta4nKIgBkKq0rM9hs3CQyxXGxHLMCy8uqK488o+9jrptQ+xFPHK7a9sRL1IXNaagCNN3ZxJsYapFj+JXbmaI5rtAdSfSvzPuBCh+ARHBmWuNo1UzVVdHXrl8ePL4cccqlazIJdC4QEjrF+Sn4IxBQzTZsL9y9TP5FsZYzHvDqbInkTNigBcE9cKOYNFCn4D/WM7F6TNuZO9EgtzepLWcjTymlHzK7aXq6Am6sfOrpIC49yXjj3ae6HRalVc/g==:',
                },
            };
            it('verifies a request', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(valid).to.equal(true);
                expect(keyLookup).to.have.callCount(1);
                expect(verifierStub).to.have.callCount(1);
                expect(verifierStub).to.have.been.calledOnceWithExactly(
                    new TextEncoder().encode('"@method": POST\n' +
                        '"@authority": example.com\n' +
                        '"@path": /foo\n' +
                        '"content-digest": sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:\n' +
                        '"content-length": 18\n' +
                        '"content-type": application/json\n' +
                        '"@signature-params": ("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884473;keyid="test-key-rsa-pss"',
                    ),
                    base64.decode('HIbjHC5rS0BYaa9v4QfD4193TORw7u9edguPh0AW3dMq9WImrlFrCGUDih47vAxi4L2YRZ3XMJc1uOKk/J0ZmZ+wcta4nKIgBkKq0rM9hs3CQyxXGxHLMCy8uqK488o+9jrptQ+xFPHK7a9sRL1IXNaagCNN3ZxJsYapFj+JXbmaI5rtAdSfSvzPuBCh+ARHBmWuNo1UzVVdHXrl8ePL4cccqlazIJdC4QEjrF+Sn4IxBQzTZsL9y9TP5FsZYzHvDqbInkTNigBcE9cKOYNFCn4D/WM7F6TNuZO9EgtzepLWcjTymlHzK7aXq6Am6sfOrpIC49yXjj3ae6HRalVc/g=='),
                    {
                        created: new Date(1618884473 * 1000),
                        keyid: 'test-key-rsa-pss',
                    },
                );
            });
            it('parses arbitrary params', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, {
                    ...request,
                    headers: {
                        ...request.headers,
                        'Signature-Input': 'sig1=("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884473;keyid="test-key-rsa-pss";p1=:AAA=:;p2=p1',
                    },
                });
                expect(valid).to.equal(true);
                expect(keyLookup).to.have.callCount(1);
                expect(verifierStub).to.have.callCount(1);
                expect(verifierStub).to.have.been.calledOnceWithExactly(
                    new TextEncoder().encode('"@method": POST\n' +
                        '"@authority": example.com\n' +
                        '"@path": /foo\n' +
                        '"content-digest": sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:\n' +
                        '"content-length": 18\n' +
                        '"content-type": application/json\n' +
                        '"@signature-params": ("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884473;keyid="test-key-rsa-pss";p1=:AAA=:;p2=p1',
                    ),
                    base64.decode('HIbjHC5rS0BYaa9v4QfD4193TORw7u9edguPh0AW3dMq9WImrlFrCGUDih47vAxi4L2YRZ3XMJc1uOKk/J0ZmZ+wcta4nKIgBkKq0rM9hs3CQyxXGxHLMCy8uqK488o+9jrptQ+xFPHK7a9sRL1IXNaagCNN3ZxJsYapFj+JXbmaI5rtAdSfSvzPuBCh+ARHBmWuNo1UzVVdHXrl8ePL4cccqlazIJdC4QEjrF+Sn4IxBQzTZsL9y9TP5FsZYzHvDqbInkTNigBcE9cKOYNFCn4D/WM7F6TNuZO9EgtzepLWcjTymlHzK7aXq6Am6sfOrpIC49yXjj3ae6HRalVc/g=='),
                    {
                        created: new Date(1618884473 * 1000),
                        keyid: 'test-key-rsa-pss',
                        p1: 'AAA=',
                        p2: 'p1',
                    },
                );
            });
            it('verifies a request with multiple signatures', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, {
                    ...request,
                    headers: {
                        ...request.headers,
                        'Signature': [
                            'sig-b21=:d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==:',
                            'sig-b22=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                        ],
                        'Signature-Input': [
                            'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                            'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");alg="rsa-pss-sha512";created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
                        ],
                    },
                });
                expect(valid).to.equal(true);
                expect(keyLookup).to.have.callCount(2);
                expect(verifierStub).to.have.callCount(2);
                expect(verifierStub).to.have.been.calledWithExactly(
                    new TextEncoder().encode(
                        '"@signature-params": ();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                    ),
                    base64.decode('d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q=='),
                    {
                        created: new Date(1618884473 * 1000),
                        keyid: 'test-key-rsa-pss',
                        nonce: 'b3k2pp5k7z-50gnwp.yemd',
                    },
                );
                expect(verifierStub).to.have.been.calledWithExactly(
                    new TextEncoder().encode('"@authority": example.com\n' +
                        '"content-digest": sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:\n' +
                        '"@query-param";name="Pet": dog\n' +
                        '"@signature-params": ("@authority" "content-digest" "@query-param";name="Pet");alg="rsa-pss-sha512";created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
                    ),
                    base64.decode('LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw=='),
                    {
                        alg: 'rsa-pss-sha512',
                        created: new Date(1618884473 * 1000),
                        keyid: 'test-key-rsa-pss',
                        tag: 'header-example',
                    },
                );
            });
            it('returns null for requests without signatures', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const headers = { ... request.headers };
                delete headers['Signature'];
                delete headers['Signature-Input'];
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, {
                    ...request,
                    headers,
                });
                expect(valid).to.equal(null);
                expect(keyLookup).to.have.callCount(0);
                expect(verifierStub).to.have.callCount(0);
            });
        });
        describe('responses', () => {
            const response: Response = {
                status: 200,
                headers: {
                    'Date': 'Tue, 20 Apr 2021 02:07:56 GMT',
                    'Content-Type': 'application/json',
                    'Content-Digest': 'sha-512=:JlEy2bfUz7WrWIjc1qV6KVLpdr/7L5/L4h7Sxvh6sNHpDQWDCL+GauFQWcZBvVDhiyOnAQsxzZFYwi0wDH+1pw==:',
                    'Content-Length': '23',
                    'Signature-Input': 'sig-b24=("@status" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-ecc-p256"',
                    'Signature': 'sig-b24=:wNmSUAhwb5LxtOtOpNa6W5xj067m5hFrj0XQ4fvpaCLx0NKocgPquLgyahnzDnDAUy5eCdlYUEkLIj+32oiasw==:',
                },
            };
            it('verifies a response', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-ecc-p256' ? { verify: verifierStub } : null);
                const result = await httpbis.verifyMessage({
                    keyLookup,
                }, response);
                expect(result).to.equal(true);
                expect(keyLookup).to.have.callCount(1);
                expect(verifierStub).to.have.callCount(1);
                expect(verifierStub).to.have.been.calledOnceWithExactly(
                    new TextEncoder().encode('"@status": 200\n' +
                        '"content-type": application/json\n' +
                        '"content-digest": sha-512=:JlEy2bfUz7WrWIjc1qV6KVLpdr/7L5/L4h7Sxvh6sNHpDQWDCL+GauFQWcZBvVDhiyOnAQsxzZFYwi0wDH+1pw==:\n' +
                        '"content-length": 23\n' +
                        '"@signature-params": ("@status" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-ecc-p256"',
                    ),
                    base64.decode('wNmSUAhwb5LxtOtOpNa6W5xj067m5hFrj0XQ4fvpaCLx0NKocgPquLgyahnzDnDAUy5eCdlYUEkLIj+32oiasw=='),
                    {
                        created: new Date(1618884473 * 1000),
                        keyid: 'test-key-ecc-p256',
                    },
                );
            });
        });
        describe('request bound responses', () => {
            const request: Request = {
                method: 'post',
                url: 'https://example.com/foo?param=Value&Pet=dog',
                headers: {
                    'Host': 'example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                    'Content-Type': 'application/json',
                    'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                    'Content-Length': '18',
                    'Signature-Input': 'sig1=("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884475;keyid="test-key-rsa-pss"',
                    'Signature': 'sig1=:LAH8BjcfcOcLojiuOBFWn0P5keD3xAOuJRGziCLuD8r5MW9S0RoXXLzLSRfGY/3SF8kVIkHjE13SEFdTo4Af/fJ/Pu9wheqoLVdwXyY/UkBIS1M8Brc8IODsn5DFIrG0IrburbLi0uCc+E2ZIIb6HbUJ+o+jP58JelMTe0QE3IpWINTEzpxjqDf5/Df+InHCAkQCTuKsamjWXUpyOT1Wkxi7YPVNOjW4MfNuTZ9HdbD2Tr65+BXeTG9ZS/9SWuXAc+BZ8WyPz0QRz//ec3uWXd7bYYODSjRAxHqX+S1ag3LZElYyUKaAIjZ8MGOt4gXEwCSLDv/zqxZeWLj/PDkn6w==:',
                },
            };
            const response: Response = {
                status: 503,
                headers: {
                    'Date': 'Tue, 20 Apr 2021 02:07:56 GMT',
                    'Content-Type': 'application/json',
                    'Content-Length': '62',
                    'Signature-Input': 'reqres=("@status" "content-length" "content-type" "signature";req;key="sig1" "@authority";req "@method";req);created=1618884479;keyid="test-key-ecc-p256"',
                    'Signature': 'reqres=:mh17P4TbYYBmBwsXPT4nsyVzW4Rp9Fb8WcvnfqKCQLoMvzOBLD/n32tL/GPW6XE5GAS5bdsg1khK6lBzV1Cx/Q==:',
                },
            };
            it('verifies a response bound to a request', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-ecc-p256' ? { verify: verifierStub } : null);
                const result = await httpbis.verifyMessage({
                    keyLookup,
                }, response, request);
                expect(result).to.equal(true);
                expect(keyLookup).to.have.callCount(1);
                expect(verifierStub).to.have.callCount(1);
                expect(verifierStub).to.have.been.calledOnceWithExactly(
                    new TextEncoder().encode('"@status": 503\n' +
                        '"content-length": 62\n' +
                        '"content-type": application/json\n' +
                        '"signature";req;key="sig1": :LAH8BjcfcOcLojiuOBFWn0P5keD3xAOuJRGziCLuD8r5MW9S0RoXXLzLSRfGY/3SF8kVIkHjE13SEFdTo4Af/fJ/Pu9wheqoLVdwXyY/UkBIS1M8Brc8IODsn5DFIrG0IrburbLi0uCc+E2ZIIb6HbUJ+o+jP58JelMTe0QE3IpWINTEzpxjqDf5/Df+InHCAkQCTuKsamjWXUpyOT1Wkxi7YPVNOjW4MfNuTZ9HdbD2Tr65+BXeTG9ZS/9SWuXAc+BZ8WyPz0QRz//ec3uWXd7bYYODSjRAxHqX+S1ag3LZElYyUKaAIjZ8MGOt4gXEwCSLDv/zqxZeWLj/PDkn6w==:\n' +
                        '"@authority";req: example.com\n' +
                        '"@method";req: POST\n' +
                        '"@signature-params": ("@status" "content-length" "content-type" "signature";req;key="sig1" "@authority";req "@method";req);created=1618884479;keyid="test-key-ecc-p256"',
                    ),
                    base64.decode('mh17P4TbYYBmBwsXPT4nsyVzW4Rp9Fb8WcvnfqKCQLoMvzOBLD/n32tL/GPW6XE5GAS5bdsg1khK6lBzV1Cx/Q=='),
                    {
                        keyid: 'test-key-ecc-p256',
                        created: new Date(1618884479 * 1000),
                    }
                );
            });
        });
        describe('error conditions', () => {
            const request: Request = {
                method: 'post',
                url: 'https://example.com/foo?param=Value&Pet=dog',
                headers: {
                    'Host': 'example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                    'Content-Type': 'application/json',
                    'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                    'Content-Length': '18',
                    'Signature-Input': 'sig1=("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884473;keyid="test-key-rsa-pss"',
                    'Signature': 'sig1=:HIbjHC5rS0BYaa9v4QfD4193TORw7u9edguPh0AW3dMq9WImrlFrCGUDih47vAxi4L2YRZ3XMJc1uOKk/J0ZmZ+wcta4nKIgBkKq0rM9hs3CQyxXGxHLMCy8uqK488o+9jrptQ+xFPHK7a9sRL1IXNaagCNN3ZxJsYapFj+JXbmaI5rtAdSfSvzPuBCh+ARHBmWuNo1UzVVdHXrl8ePL4cccqlazIJdC4QEjrF+Sn4IxBQzTZsL9y9TP5FsZYzHvDqbInkTNigBcE9cKOYNFCn4D/WM7F6TNuZO9EgtzepLWcjTymlHzK7aXq6Am6sfOrpIC49yXjj3ae6HRalVc/g==:',
                },
            };
            it('throws if there are missing inputs', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const headers = { ... request.headers };
                delete headers['Signature-Input'];
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                    }, {
                        ...request,
                        headers,
                    });
                } catch (e) {
                    expect(keyLookup).to.have.callCount(0);
                    expect(verifierStub).to.have.callCount(0);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws if there are missing signatures', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const headers = { ... request.headers };
                delete headers['Signature'];
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                    }, {
                        ...request,
                        headers,
                    });
                } catch (e) {
                    expect(keyLookup).to.have.callCount(0);
                    expect(verifierStub).to.have.callCount(0);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws if it cannot validate all signatures when required', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                        all: true,
                    }, {
                        ...request,
                        headers: {
                            ...request.headers,
                            'Signature': [
                                'sig-b21=:d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==:',
                                'sig-b22=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                                'sig=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                            ],
                            'Signature-Input': [
                                'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                                'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
                                'sig=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="unknwon-key";tag="header-example"',
                            ],
                        },
                    });
                } catch (e) {
                    expect(e).to.be.instanceOf(UnknownKeyError);
                    expect(keyLookup).to.have.callCount(3);
                    expect(verifierStub).to.have.callCount(2);
                    expect(verifierStub).to.have.been.calledWithExactly(
                        new TextEncoder().encode(
                            '"@signature-params": ();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                        ),
                        base64.decode('d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q=='),
                        {
                            created: new Date(1618884473 * 1000),
                            keyid: 'test-key-rsa-pss',
                            nonce: 'b3k2pp5k7z-50gnwp.yemd',
                        },
                    );
                    expect(verifierStub).to.have.been.calledWithExactly(
                        new TextEncoder().encode('"@authority": example.com\n' +
                            '"content-digest": sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:\n' +
                            '"@query-param";name="Pet": dog\n' +
                            '"@signature-params": ("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
                        ),
                        base64.decode('LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw=='),
                        {
                            created: new Date(1618884473 * 1000),
                            keyid: 'test-key-rsa-pss',
                            tag: 'header-example',
                        },
                    );
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws if it cannot validate signatures when required', async () => {
                const syntheticError = new Error('failed to verify');
                const verifierStub = stub().rejects(syntheticError);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                    }, {
                        ...request,
                        headers: {
                            ...request.headers,
                            'Signature': [
                                'sig-b21=:d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==:',
                                'sig-b22=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                            ],
                            'Signature-Input': [
                                'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                                'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
                            ],
                        },
                    });
                } catch (e) {
                    expect(e).to.equal(syntheticError);
                    expect(keyLookup).to.have.callCount(2);
                    expect(verifierStub).to.have.callCount(2);
                    expect(verifierStub).to.have.been.calledWithExactly(
                        new TextEncoder().encode(
                            '"@signature-params": ();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                        ),
                        base64.decode('d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q=='),
                        {
                            created: new Date(1618884473 * 1000),
                            keyid: 'test-key-rsa-pss',
                            nonce: 'b3k2pp5k7z-50gnwp.yemd',
                        },
                    );
                    expect(verifierStub).to.have.been.calledWithExactly(
                        new TextEncoder().encode('"@authority": example.com\n' +
                            '"content-digest": sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:\n' +
                            '"@query-param";name="Pet": dog\n' +
                            '"@signature-params": ("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
                        ),
                        base64.decode('LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw=='),
                        {
                            created: new Date(1618884473 * 1000),
                            keyid: 'test-key-rsa-pss',
                            tag: 'header-example',
                        },
                    );
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('shortcuts validation if not all signatures can be validated', async () => {
                const syntheticError = new Error('failed to verify');
                const verifierStub = stub().rejects(syntheticError);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                    }, {
                        ...request,
                        headers: {
                            ...request.headers,
                            'Signature': [
                                'sig-b21=:d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==:',
                                'sig-b22=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                            ],
                            'Signature-Input': [
                                'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                                'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="unknown";tag="header-example"',
                            ],
                        },
                    });
                } catch (e) {
                    expect(e).to.equal(syntheticError);
                    expect(keyLookup).to.have.callCount(2);
                    expect(verifierStub).to.have.callCount(1);
                    expect(verifierStub).to.have.been.calledWithExactly(
                        new TextEncoder().encode(
                            '"@signature-params": ();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                        ),
                        base64.decode('d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q=='),
                        {
                            created: new Date(1618884473 * 1000),
                            keyid: 'test-key-rsa-pss',
                            nonce: 'b3k2pp5k7z-50gnwp.yemd',
                        },
                    );
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('ignores keys it does not know', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, {
                    ...request,
                    headers: {
                        ...request.headers,
                        'Signature': [
                            'sig=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                            'sig-b21=:d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==:',
                            'sig-b22=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                        ],
                        'Signature-Input': [
                            'sig=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="unknown";tag="header-example"',
                            'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                            'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="unknown";tag="header-example"',
                        ],
                    },
                });
                expect(valid).to.equal(true);
                expect(keyLookup).to.have.callCount(3);
                expect(verifierStub).to.have.callCount(1);
                expect(verifierStub).to.have.been.calledWithExactly(
                    new TextEncoder().encode(
                        '"@signature-params": ();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                    ),
                    base64.decode('d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q=='),
                    {
                        created: new Date(1618884473 * 1000),
                        keyid: 'test-key-rsa-pss',
                        nonce: 'b3k2pp5k7z-50gnwp.yemd',
                    },
                );
            });
            it('throws if key does not support alg', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub, algs: ['hmac-sha256'] } : null);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                    }, {
                        ...request,
                        headers: {
                            ...request.headers,
                            'Signature': [
                                'sig=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                                'sig-b21=:d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==:',
                                'sig-b22=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                            ],
                            'Signature-Input': [
                                'sig=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;alg="rsa-pss-sha512";keyid="unknown";tag="header-example"',
                                'sig-b21=();created=1618884473;alg="rsa-pss-sha512";keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                                'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");alg="rsa-pss-sha512";created=1618884473;keyid="unknown";tag="header-example"',
                            ],
                        },
                    });
                } catch (e) {
                    expect(e).to.be.instanceOf(UnsupportedAlgorithmError);
                    expect(keyLookup).to.have.callCount(3);
                    expect(verifierStub).to.have.callCount(0);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws for malformed signature input', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub, algs: ['hmac-sha256'] } : null);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                    }, {
                        ...request,
                        headers: {
                            ...request.headers,
                            'Signature': [
                                'sig=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                            ],
                            'Signature-Input': [
                                'sig=123;keyid="test-key-rsa-pss"',
                            ],
                        },
                    });
                } catch (e) {
                    expect(e).to.be.instanceOf(MalformedSignatureError);
                    expect(keyLookup).to.have.callCount(1);
                    expect(verifierStub).to.have.callCount(0);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws if signatures do not have required params', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                        requiredParams: ['tag'],
                    }, {
                        ...request,
                        headers: {
                            ...request.headers,
                            'Signature': [
                                'sig=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                            ],
                            'Signature-Input': [
                                'sig=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;alg="rsa-pss-sha512";keyid="test-key-rsa-pss"',
                            ],
                        },
                    });
                } catch (e) {
                    expect(e).to.be.instanceOf(UnacceptableSignatureError);
                    expect(keyLookup).to.have.callCount(1);
                    expect(verifierStub).to.have.callCount(0);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws if signatures do not have required signed fields', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                        requiredFields: ['@method'],
                    }, {
                        ...request,
                        headers: {
                            ...request.headers,
                            'Signature': [
                                'sig=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                            ],
                            'Signature-Input': [
                                'sig=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;alg="rsa-pss-sha512";keyid="test-key-rsa-pss"',
                            ],
                        },
                    });
                } catch (e) {
                    expect(e).to.be.instanceOf(UnacceptableSignatureError);
                    expect(keyLookup).to.have.callCount(1);
                    expect(verifierStub).to.have.callCount(0);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws if signatures is missing', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                    }, {
                        ...request,
                        headers: {
                            ...request.headers,
                            'Signature': [
                                'sig1=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                            ],
                            'Signature-Input': [
                                'sig=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;alg="rsa-pss-sha512";keyid="test-key-rsa-pss"',
                            ],
                        },
                    });
                } catch (e) {
                    expect(e).to.be.instanceOf(MalformedSignatureError);
                    expect(keyLookup).to.have.callCount(1);
                    expect(verifierStub).to.have.callCount(0);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws if signatures is malformed', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                    }, {
                        ...request,
                        headers: {
                            ...request.headers,
                            'Signature': [
                                'sig="LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw=="',
                            ],
                            'Signature-Input': [
                                'sig=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;alg="rsa-pss-sha512";keyid="test-key-rsa-pss"',
                            ],
                        },
                    });
                } catch (e) {
                    expect(e).to.be.instanceOf(MalformedSignatureError);
                    expect(keyLookup).to.have.callCount(1);
                    expect(verifierStub).to.have.callCount(0);
                    return;
                }
                expect.fail('Expected to throw');
            });
        });
        describe('config tests', () => {
            const request: Request = {
                method: 'post',
                url: 'https://example.com/foo?param=Value&Pet=dog',
                headers: {
                    'Host': 'example.com',
                    'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                    'Content-Type': 'application/json',
                    'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                    'Content-Length': '18',
                    'Signature-Input': 'sig1=("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884473;expires=1618884773;keyid="test-key-rsa-pss"',
                    'Signature': 'sig1=:HIbjHC5rS0BYaa9v4QfD4193TORw7u9edguPh0AW3dMq9WImrlFrCGUDih47vAxi4L2YRZ3XMJc1uOKk/J0ZmZ+wcta4nKIgBkKq0rM9hs3CQyxXGxHLMCy8uqK488o+9jrptQ+xFPHK7a9sRL1IXNaagCNN3ZxJsYapFj+JXbmaI5rtAdSfSvzPuBCh+ARHBmWuNo1UzVVdHXrl8ePL4cccqlazIJdC4QEjrF+Sn4IxBQzTZsL9y9TP5FsZYzHvDqbInkTNigBcE9cKOYNFCn4D/WM7F6TNuZO9EgtzepLWcjTymlHzK7aXq6Am6sfOrpIC49yXjj3ae6HRalVc/g==:',
                },
            };
            before('mock time', () => {
                // expires time plus 5 seconds
                MockDate.set(new Date((1618884773 + 5) * 1000));
            });
            after('reset time', () => MockDate.reset());
            it('allows expired signatures within tolerance', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const result = await httpbis.verifyMessage({
                    keyLookup,
                    tolerance: 5,
                }, request);
                expect(result).to.equal(true);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                    }, request);
                } catch (e) {
                    expect(e).to.be.instanceOf(ExpiredError);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('enforces maxAge of signature', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                        maxAge: 150,
                    }, request);
                } catch (e) {
                    expect(e).to.be.instanceOf(ExpiredError);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws if signature is created too early', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const result = await httpbis.verifyMessage({
                    keyLookup,
                    notAfter: new Date(1618884472 * 1000),
                    tolerance: 5,
                }, request);
                expect(result).to.equal(true);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                        notAfter: new Date(1618884472 * 1000),
                    }, request);
                } catch (e) {
                    expect(e).to.be.instanceOf(ExpiredError);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('throws if signature is created too early', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const result = await httpbis.verifyMessage({
                    keyLookup,
                    notAfter: 1618884472,
                    tolerance: 5,
                }, request);
                expect(result).to.equal(true);
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                        notAfter: 1618884472 * 1000,
                    }, request);
                } catch (e) {
                    expect(e).to.be.instanceOf(ExpiredError);
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('validates signatures with no created param', async () => {
                const verifierStub = stub().resolves(true);
                const keyLookup = stub().callsFake(async ({ keyid }) => keyid === 'test-key-rsa-pss' ? { verify: verifierStub } : null);
                const result = await httpbis.verifyMessage({
                    keyLookup,
                }, {
                    ...request,
                    headers: {
                        ...request.headers,
                        'Signature-Input': 'sig1=("@method" "@authority" "@path" "content-digest" "content-length" "content-type");keyid="test-key-rsa-pss"',
                    },
                });
                expect(result).to.equal(true);
            });
        });
    });
});
