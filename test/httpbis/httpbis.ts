import { Request } from '../../src';
import {
    deriveComponent,
    extractHeader,
} from '../../src/httpbis';
import { expect } from 'chai';

describe('httpbis', () => {
    describe('.extractHeader', () => {
        const headers = {
            'testheader': 'test',
            'test-header-1': 'test1',
            'Test-Header-2': 'test2',
            'test-Header-3': 'test3',
            'TEST-HEADER-4': 'test4',
        };
        Object.entries(headers).forEach(([headerName, expectedValue]) => {
            it(`successfully extracts a matching header (${headerName})`, () => {
                expect(extractHeader(headerName.toLowerCase(), new Map(), { headers } as unknown as Request)).to.deep.equal([expectedValue]);
            });
        });
        it('throws on missing headers', () => {
            expect(() => extractHeader('missing', new Map(), { headers } as unknown as Request)).to.throw(Error, 'No header "missing" found in headers');
        });
    });
    describe('.deriveComponent', () => {
        it('correctly extracts the @method', () => {
            const result = deriveComponent('@method', new Map(), {
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['POST']);
        });
        it('correctly extracts the @target-uri', () => {
            const result = deriveComponent('@target-uri', new Map(), {
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['https://www.example.com/path?param=value']);
        });
        it('correctly extracts the @authority', () => {
            const result = deriveComponent('@authority', new Map(), {
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['www.example.com']);
        });
        it('correctly extracts the @scheme', () => {
            const result = deriveComponent('@scheme', new Map(), {
                method: 'POST',
                url: 'http://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['http']);
        });
        it('correctly extracts the @request-target', () => {
            const result = deriveComponent('@request-target', new Map(), {
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['/path?param=value']);
        });
        it('correctly extracts the @path', () => {
            const result = deriveComponent('@path', new Map(), {
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['/path']);
        });
        it('correctly extracts the @query', () => {
            const result = deriveComponent('@query', new Map(), {
                method: 'POST',
                url: 'https://www.example.com/path?param=value&foo=bar&baz=batman',
            } as unknown as Request);
            expect(result).to.deep.equal(['?param=value&foo=bar&baz=batman']);
        });
        it('correctly extracts the @query', () => {
            const result = deriveComponent('@query', new Map(), {
                method: 'POST',
                url: 'https://www.example.com/path?queryString',
            } as unknown as Request);
            expect(result).to.deep.equal(['?queryString']);
        });
    });
});
