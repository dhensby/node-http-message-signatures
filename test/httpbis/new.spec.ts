import * as httpbis from '../../src/httpbis';
import { Request, Response, SigningKey } from '../../src';
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
                expect(httpbis.deriveComponent('@method', req)).to.deep.equal(['GET']);
                expect(httpbis.deriveComponent('@method', {
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
                expect(httpbis.deriveComponent('@target-uri', req)).to.deep.equal([
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
                expect(httpbis.deriveComponent('@authority', req)).to.deep.equal([
                    'www.example.com',
                ]);
                expect(httpbis.deriveComponent('@authority', {
                    ...req,
                    url: 'https://www.EXAMPLE.com/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', {
                    ...req,
                    url: 'https://www.example.com:8080/path?param=value',
                })).to.deep.equal(['www.example.com:8080']);
                expect(httpbis.deriveComponent('@authority', {
                    ...req,
                    url: 'https://www.example.com:443/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', {
                    ...req,
                    url: 'http://www.example.com:80/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority', {
                    ...req,
                    url: 'https://www.example.com:80/path?param=value',
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
                expect(httpbis.deriveComponent('@scheme', req)).to.deep.equal(['https']);
                expect(httpbis.deriveComponent('@scheme', {
                    ...req,
                    url: 'http://example.com',
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
                expect(httpbis.deriveComponent('@request-target', req)).to.deep.equal([
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
                expect(httpbis.deriveComponent('@path', req)).to.deep.equal([
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
                expect(httpbis.deriveComponent('@query', req)).to.deep.equal([
                    '?param=value&foo=bar&baz=batman',
                ]);
                expect(httpbis.deriveComponent('@query', {
                    ...req,
                    url: 'https://www.example.com/path?queryString',
                })).to.deep.equal([
                    '?queryString',
                ]);
                expect(httpbis.deriveComponent('@query', {
                    ...req,
                    url: 'https://www.example.com/path',
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
                expect(httpbis.deriveComponent('"@query-param";name="baz"', req)).to.deep.equal([
                    'batman',
                ]);
                expect(httpbis.deriveComponent('"@query-param";name="qux"', req)).to.deep.equal([
                    '',
                ]);
                expect(httpbis.deriveComponent('@query-param;name=param', req)).to.deep.equal([
                    'value',
                ]);
                expect(httpbis.deriveComponent('@query-param;name=param', {
                    ...req,
                    url: 'https://example.com/path?param=value&param=value2',
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
                expect(httpbis.deriveComponent('@status', res, req)).to.deep.equal(['200']);
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
                expect(httpbis.deriveComponent('@method;req', res, req)).to.deep.equal(['GET']);
                expect(httpbis.deriveComponent('@method;req', res, {
                    ...req,
                    method: 'POST',
                })).to.deep.equal(['POST']);
            });
            it('derives @target-uri', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@target-uri;req', res, req)).to.deep.equal([
                    'https://www.example.com/path?param=value',
                ]);
            });
            it('derives @authority', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@authority;req', res, req)).to.deep.equal([
                    'www.example.com',
                ]);
                expect(httpbis.deriveComponent('@authority;req', res, {
                    ...req,
                    url: 'https://www.EXAMPLE.com/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority;req', res, {
                    ...req,
                    url: 'https://www.example.com:8080/path?param=value',
                })).to.deep.equal(['www.example.com:8080']);
                expect(httpbis.deriveComponent('@authority;req', res, {
                    ...req,
                    url: 'https://www.example.com:443/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority;req', res, {
                    ...req,
                    url: 'http://www.example.com:80/path?param=value',
                })).to.deep.equal(['www.example.com']);
                expect(httpbis.deriveComponent('@authority;req', res, {
                    ...req,
                    url: 'https://www.example.com:80/path?param=value',
                })).to.deep.equal(['www.example.com:80']);
            });
            it('derives @scheme', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@scheme;req', res, req)).to.deep.equal(['https']);
                expect(httpbis.deriveComponent('@scheme;req', res, {
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
                expect(httpbis.deriveComponent('@request-target;req', res, req)).to.deep.equal([
                    '/path?param=value',
                ]);
            });
            it('derives @path', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@path;req', res, req)).to.deep.equal([
                    '/path',
                ]);
            });
            it('derives @query', () => {
                const res: Response = {
                    status: 200,
                    headers: {},
                };
                expect(httpbis.deriveComponent('@query;req', res, req)).to.deep.equal([
                    '?param=value',
                ]);
                expect(httpbis.deriveComponent('@query;req', res, {
                    ...req,
                    url: 'https://www.example.com/path?queryString',
                })).to.deep.equal([
                    '?queryString',
                ]);
                expect(httpbis.deriveComponent('@query;req', res, {
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
                expect(httpbis.deriveComponent('"@query-param";req;name="baz"', res, {
                    ...req,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    'batman',
                ]);
                expect(httpbis.deriveComponent('"@query-param";req;name="qux"', res, {
                    ...req,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    '',
                ]);
                expect(httpbis.deriveComponent('@query-param;req;name=param', res, {
                    ...req,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    'value',
                ]);
                expect(httpbis.deriveComponent('@query-param;req;name=param', res, {
                    ...req,
                    url: 'https://example.com/path?param=value&param=value2',
                })).to.deep.equal([
                    'value',
                    'value2',
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
                expect(httpbis.extractHeader('host', request)).to.deep.equal(['www.example.com']);
                expect(httpbis.extractHeader('date', request)).to.deep.equal(['Tue, 20 Apr 2021 02:07:56 GMT']);
                expect(httpbis.extractHeader('X-OWS-Header', request)).to.deep.equal(['Leading and trailing whitespace.']);
                expect(httpbis.extractHeader('x-obs-fold-header', request)).to.deep.equal(['Obsolete line folding.']);
                expect(httpbis.extractHeader('cache-control', request)).to.deep.equal(['max-age=60, must-revalidate']);
                expect(httpbis.extractHeader('example-dict', request)).to.deep.equal(['a=1,    b=2;x=1;y=2,   c=(a   b   c)']);
                expect(httpbis.extractHeader('x-empty-header', request)).to.deep.equal(['']);
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
                expect(httpbis.extractHeader('example-dict;sf', request)).to.deep.equal(['a=1, b=2;x=1;y=2, c=(a b c)']);
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
                expect(httpbis.extractHeader('example-dict;key="a"', request)).to.deep.equal(['1']);
            });
            it('pulls out a boolean key', () => {
                expect(httpbis.extractHeader('example-dict;key="d"', request)).to.deep.equal(['?1']);
            });
            it('pulls out parameters', () => {
                expect(httpbis.extractHeader('example-dict;key="b"', request)).to.deep.equal(['2;x=1;y=2']);
            });
            it('pulls out an inner list', () => {
                expect(httpbis.extractHeader('example-dict;key="c"', request)).to.deep.equal(['(a b c)']);
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
                expect(httpbis.extractHeader('Example-Header;bs', request)).to.deep.equal([':dmFsdWUsIHdpdGgsIGxvdHM=:, :b2YsIGNvbW1hcw==:']);
                expect(httpbis.extractHeader('Example-Header;bs', {
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
                expect(httpbis.extractHeader('Signature;req;key=sig1', response, request)).to.deep.equal([
                    ':LAH8BjcfcOcLojiuOBFWn0P5keD3xAOuJRGziCLuD8r5MW9S0RoXXLzLSRfGY/3SF8kVIkHjE13SEFdTo4Af/fJ/Pu9wheqoLVdwXyY/UkBIS1M8Brc8IODsn5DFIrG0IrburbLi0uCc+E2ZIIb6HbUJ+o+jP58JelMTe0QE3IpWINTEzpxjqDf5/Df+InHCAkQCTuKsamjWXUpyOT1Wkxi7YPVNOjW4MfNuTZ9HdbD2Tr65+BXeTG9ZS/9SWuXAc+BZ8WyPz0QRz//ec3uWXd7bYYODSjRAxHqX+S1ag3LZElYyUKaAIjZ8MGOt4gXEwCSLDv/zqxZeWLj/PDkn6w==:',
                ]);
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
                expect(httpbis.createSignatureBase([
                    'host',
                    'date',
                    'x-ows-header',
                    'x-obs-fold-header',
                    'cache-control',
                    'example-dict',
                ], request)).to.deep.equal([
                    ['"host"', ['www.example.com']],
                    ['"date"', ['Tue, 20 Apr 2021 02:07:56 GMT']],
                    ['"x-ows-header"', ['Leading and trailing whitespace.']],
                    ['"x-obs-fold-header"', ['Obsolete line folding.']],
                    ['"cache-control"', ['max-age=60, must-revalidate']],
                    ['"example-dict"', ['a=1,    b=2;x=1;y=2,   c=(a   b   c)']],
                ]);
            });
            it('extracts an empty header', () => {
                expect(httpbis.createSignatureBase([
                    'X-Empty-Header',
                ], request)).to.deep.equal([
                    ['"x-empty-header"', ['']],
                ]);
            });
            it('extracts strict formatted headers', () => {
                expect(httpbis.createSignatureBase([
                    'example-dict;sf',
                ], request)).to.deep.equal([
                    ['"example-dict";sf', ['a=1, b=2;x=1;y=2, c=(a b c)']],
                ]);
            });
            it('extracts keys from dictionary headers', () => {
                expect(httpbis.createSignatureBase([
                    'example-dict;key="a"',
                    'example-dict;key="d"',
                    'example-dict;key="b"',
                    'example-dict;key="c"',
                ], {
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
                expect(httpbis.createSignatureBase([
                    'example-header;bs',
                ], {
                    ...request,
                    headers: {
                        'Example-Header': ['value, with, lots', 'of, commas'],
                    },
                } as Request)).to.deep.equal([
                    ['"example-header";bs', [':dmFsdWUsIHdpdGgsIGxvdHM=:, :b2YsIGNvbW1hcw==:']],
                ]);
                expect(httpbis.createSignatureBase([
                    'example-header;bs',
                ], {
                    ...request,
                    headers: {
                        'Example-Header': ['value, with, lots, of, commas'],
                    },
                } as Request)).to.deep.equal([
                    ['"example-header";bs', [':dmFsdWUsIHdpdGgsIGxvdHMsIG9mLCBjb21tYXM=:']],
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
                expect(httpbis.createSignatureBase(['@method'], request)).to.deep.equal([
                    ['"@method"', ['POST']],
                ]);
            });
            it('derives @target-uri', () => {
                expect(httpbis.createSignatureBase(['@target-uri'], request)).to.deep.equal([
                    ['"@target-uri"', ['https://www.example.com/path?param=value']],
                ]);
            });
            it('derives @authority', () => {
                expect(httpbis.createSignatureBase(['@authority'], request)).to.deep.equal([
                    ['"@authority"', ['www.example.com']],
                ]);
            });
            it('derives @scheme', () => {
                expect(httpbis.createSignatureBase(['@scheme'], request)).to.deep.equal([
                    ['"@scheme"', ['https']],
                ]);
            });
            it('derives @request-target', () => {
                expect(httpbis.createSignatureBase(['@request-target'], request)).to.deep.equal([
                    ['"@request-target"', ['/path?param=value']],
                ]);
            });
            it('derives @path', () => {
                expect(httpbis.createSignatureBase(['@path'], request)).to.deep.equal([
                    ['"@path"', ['/path']],
                ]);
            });
            it('derives @query', () => {
                expect(httpbis.createSignatureBase(['@query'], {
                    ...request,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman',
                })).to.deep.equal([
                    ['"@query"', ['?param=value&foo=bar&baz=batman']],
                ]);
                expect(httpbis.createSignatureBase(['@query'], {
                    ...request,
                    url: 'https://www.example.com/path?queryString',
                })).to.deep.equal([
                    ['"@query"', ['?queryString']],
                ]);
                expect(httpbis.createSignatureBase(['@query'], {
                    ...request,
                    url: 'https://www.example.com/path',
                })).to.deep.equal([
                    ['"@query"', ['?']],
                ]);
            });
            it('derives @query-param', () => {
                expect(httpbis.createSignatureBase(['@query-param;name="baz"'], {
                    ...request,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    ['"@query-param";name="baz"', ['batman']],
                ]);
                expect(httpbis.createSignatureBase(['@query-param;name="qux"'], {
                    ...request,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    ['"@query-param";name="qux"', ['']],
                ]);
                expect(httpbis.createSignatureBase(['@query-param;name="param"'], {
                    ...request,
                    url: 'https://www.example.com/path?param=value&foo=bar&baz=batman&qux=',
                })).to.deep.equal([
                    ['"@query-param";name="param"', ['value']],
                ]);
            });
            it('derives @status', () => {
                expect(httpbis.createSignatureBase(['@status'], {
                    status: 200,
                    headers: {},
                }, request)).to.deep.equal([
                    ['"@status"', ['200']],
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
                expect(httpbis.createSignatureBase([
                    '@method',
                    '@authority',
                    '@path',
                    'content-digest',
                    'content-length',
                    'content-type',
                ], request)).to.deep.equal([
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
                expect(Array.from(httpbis.createSigningParameters({
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
                expect(Array.from(httpbis.createSigningParameters({
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
                expect(Array.from(httpbis.createSigningParameters({
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
                expect(Array.from(httpbis.createSigningParameters({
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
                expect(Array.from(httpbis.createSigningParameters({
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
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        sign: () => Promise.resolve(Buffer.from('')),
                    },
                }).entries())).to.deep.equal([
                    ['created', 1664267652],
                    ['expires', 1664267952],
                ]);
            });
            it('returns nothing if no data', () => {
                expect(Array.from(httpbis.createSigningParameters({
                    key: {
                        sign: () => Promise.resolve(Buffer.from('')),
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
                expect(Array.from(httpbis.createSigningParameters({
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
    describe('.augmentHeaders', () => {
        it('adds a new signature and input header', () => {
            expect(httpbis.augmentHeaders({}, Buffer.from('a fake signature'), '("@method";req);created=12345')).to.deep.equal({
                'Signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                'Signature-Input': 'sig=("@method";req);created=12345',
            });
        });
        it('adds to an existing headers', () => {
            expect(httpbis.augmentHeaders({
                'signature': 'sig1=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                'signature-input': 'sig1=("@method";req);created=12345',
            }, Buffer.from('another fake signature'), '("@request-target";req);created=12345')).to.deep.equal({
                'signature': 'sig1=:YSBmYWtlIHNpZ25hdHVyZQ==:, sig=:YW5vdGhlciBmYWtlIHNpZ25hdHVyZQ==:',
                'signature-input': 'sig1=("@method";req);created=12345, sig=("@request-target";req);created=12345',
            });
        });
        it('avoids naming clashes with existing signatures', () => {
            expect(httpbis.augmentHeaders({
                'signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                'signature-input': 'sig=("@method";req);created=12345',
            }, Buffer.from('another fake signature'), '("@request-target";req);created=12345')).to.deep.equal({
                'signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:, sig0=:YW5vdGhlciBmYWtlIHNpZ25hdHVyZQ==:',
                'signature-input': 'sig=("@method";req);created=12345, sig0=("@request-target";req);created=12345',
            });
        });
        it('uses a provided signature name', () => {
            expect(httpbis.augmentHeaders({
                'signature': 'sig=:YSBmYWtlIHNpZ25hdHVyZQ==:',
                'signature-input': 'sig=("@method";req);created=12345',
            }, Buffer.from('another fake signature'), '("@request-target";req);created=12345', 'reqres')).to.deep.equal({
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
                    sign: stub().resolves(Buffer.from('a fake signature')),
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
                expect(signer.sign).to.have.been.calledOnceWithExactly(Buffer.from(
                    '"@method": POST\n' +
                    '"@authority": example.com\n' +
                    '"@path": /foo\n' +
                    '"content-digest": sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:\n' +
                    '"content-length": 18\n' +
                    '"content-type": application/json\n' +
                    '"@signature-params": ("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884473;keyid="test-key-rsa-pss"'
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
                expect(signer.sign).to.have.been.calledOnceWithExactly(Buffer.from(
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
                    sign: stub().resolves(Buffer.from('a fake signature')),
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
                expect(signer.sign).to.have.been.calledOnceWithExactly(Buffer.from(
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
                const valid = await httpbis.verifyMessage({
                    verifier: verifierStub,
                }, request);
                expect(valid).to.equal(true);
                expect(verifierStub).to.have.callCount(1);
                expect(verifierStub).to.have.been.calledOnceWithExactly(
                    Buffer.from('"@method": POST\n' +
                        '"@authority": example.com\n' +
                        '"@path": /foo\n' +
                        '"content-digest": sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:\n' +
                        '"content-length": 18\n' +
                        '"content-type": application/json\n' +
                        '"@signature-params": ("@method" "@authority" "@path" "content-digest" "content-length" "content-type");created=1618884473;keyid="test-key-rsa-pss"',
                    ),
                    Buffer.from('HIbjHC5rS0BYaa9v4QfD4193TORw7u9edguPh0AW3dMq9WImrlFrCGUDih47vAxi4L2YRZ3XMJc1uOKk/J0ZmZ+wcta4nKIgBkKq0rM9hs3CQyxXGxHLMCy8uqK488o+9jrptQ+xFPHK7a9sRL1IXNaagCNN3ZxJsYapFj+JXbmaI5rtAdSfSvzPuBCh+ARHBmWuNo1UzVVdHXrl8ePL4cccqlazIJdC4QEjrF+Sn4IxBQzTZsL9y9TP5FsZYzHvDqbInkTNigBcE9cKOYNFCn4D/WM7F6TNuZO9EgtzepLWcjTymlHzK7aXq6Am6sfOrpIC49yXjj3ae6HRalVc/g==', 'base64'),
                    {
                        created: new Date(1618884473 * 1000),
                        keyid: 'test-key-rsa-pss',
                    },
                );
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
                const result = await httpbis.verifyMessage({
                    verifier: verifierStub,
                }, response);
                expect(result).to.equal(true);
                expect(verifierStub).to.have.callCount(1);
                expect(verifierStub).to.have.been.calledOnceWithExactly(
                    Buffer.from('"@status": 200\n' +
                        '"content-type": application/json\n' +
                        '"content-digest": sha-512=:JlEy2bfUz7WrWIjc1qV6KVLpdr/7L5/L4h7Sxvh6sNHpDQWDCL+GauFQWcZBvVDhiyOnAQsxzZFYwi0wDH+1pw==:\n' +
                        '"content-length": 23\n' +
                        '"@signature-params": ("@status" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-ecc-p256"',
                    ),
                    Buffer.from('wNmSUAhwb5LxtOtOpNa6W5xj067m5hFrj0XQ4fvpaCLx0NKocgPquLgyahnzDnDAUy5eCdlYUEkLIj+32oiasw==', 'base64'),
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
                const stubVerifier = stub().resolves(true);
                const result = await httpbis.verifyMessage({
                    verifier: stubVerifier,
                }, response, request);
                expect(result).to.equal(true);
                expect(stubVerifier).to.have.callCount(1);
                expect(stubVerifier).to.have.been.calledOnceWithExactly(
                    Buffer.from('"@status": 503\n' +
                        '"content-length": 62\n' +
                        '"content-type": application/json\n' +
                        '"signature";req;key="sig1": :LAH8BjcfcOcLojiuOBFWn0P5keD3xAOuJRGziCLuD8r5MW9S0RoXXLzLSRfGY/3SF8kVIkHjE13SEFdTo4Af/fJ/Pu9wheqoLVdwXyY/UkBIS1M8Brc8IODsn5DFIrG0IrburbLi0uCc+E2ZIIb6HbUJ+o+jP58JelMTe0QE3IpWINTEzpxjqDf5/Df+InHCAkQCTuKsamjWXUpyOT1Wkxi7YPVNOjW4MfNuTZ9HdbD2Tr65+BXeTG9ZS/9SWuXAc+BZ8WyPz0QRz//ec3uWXd7bYYODSjRAxHqX+S1ag3LZElYyUKaAIjZ8MGOt4gXEwCSLDv/zqxZeWLj/PDkn6w==:\n' +
                        '"@authority";req: example.com\n' +
                        '"@method";req: POST\n' +
                        '"@signature-params": ("@status" "content-length" "content-type" "signature";req;key="sig1" "@authority";req "@method";req);created=1618884479;keyid="test-key-ecc-p256"',
                    ),
                    Buffer.from('mh17P4TbYYBmBwsXPT4nsyVzW4Rp9Fb8WcvnfqKCQLoMvzOBLD/n32tL/GPW6XE5GAS5bdsg1khK6lBzV1Cx/Q==', 'base64'),
                    {
                        keyid: 'test-key-ecc-p256',
                        created: new Date(1618884479 * 1000),
                    }
                );
            });
        });
    });
});
