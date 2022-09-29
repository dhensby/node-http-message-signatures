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
                expect(extractHeader( headerName, { headers } as unknown as Request)).to.deep.equal([expectedValue]);
            });
            it(`successfully extracts a lower cased header (${headerName})`, () => {
                expect(extractHeader( headerName.toLowerCase(), { headers } as unknown as Request)).to.deep.equal([expectedValue]);
            });
            it(`successfully extracts an upper cased header (${headerName})`, () => {
                expect(extractHeader( headerName.toUpperCase(), { headers } as unknown as Request)).to.deep.equal([expectedValue]);
            });
        });
        it('throws on missing headers', () => {
            expect(() => extractHeader('missing', { headers } as unknown as Request)).to.throw(Error, 'No header "missing" found in headers');
        });
    });
    describe('.deriveComponent', () => {
        it('correctly extracts the @method', () => {
            const result = deriveComponent('@method', {
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['POST']);
        });
        it('correctly extracts the @target-uri', () => {
            const result = deriveComponent('@target-uri', {
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['https://www.example.com/path?param=value']);
        });
        it('correctly extracts the @authority', () => {
            const result = deriveComponent('@authority', {
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['www.example.com']);
        });
        it('correctly extracts the @scheme', () => {
            const result = deriveComponent('@scheme', {
                method: 'POST',
                url: 'http://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['http']);
        });
        it('correctly extracts the @request-target', () => {
            const result = deriveComponent('@request-target', {
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['/path?param=value']);
        });
        it('correctly extracts the @path', () => {
            const result = deriveComponent('@path', {
                method: 'POST',
                url: 'https://www.example.com/path?param=value',
            } as unknown as Request);
            expect(result).to.deep.equal(['/path']);
        });
        it('correctly extracts the @query', () => {
            const result = deriveComponent('@query', {
                method: 'POST',
                url: 'https://www.example.com/path?param=value&foo=bar&baz=batman',
            } as unknown as Request);
            expect(result).to.deep.equal(['?param=value&foo=bar&baz=batman']);
        });
        it('correctly extracts the @query', () => {
            const result = deriveComponent('@query', {
                method: 'POST',
                url: 'https://www.example.com/path?queryString',
            } as unknown as Request);
            expect(result).to.deep.equal(['?queryString']);
        });
    });
});
