import { Request } from '../../src';
import { createSignatureBase, formatSignatureBase } from '../../src/cavage';
import { expect } from 'chai';

describe('cavage', () => {
    describe('.buildSignedData', () => {
        describe('specification examples', () => {
            const testRequest: Request = {
                method: 'GET',
                url: 'https://example.org/foo',
                headers: {
                    'Host': 'example.org',
                    'Date': 'Tue, 07 Jun 2014 20:51:35 GMT',
                    'X-Example': 'Example header\n    with some whitespace.',
                    'X-EmptyHeader': '',
                    'Cache-Control': ['max-age=60', 'must-revalidate'],
                },
            };
            it('builds the signed data payload', () => {
                const payload = formatSignatureBase(createSignatureBase([
                    '@request-target',
                    '@created',
                    'host',
                    'date',
                    'cache-control',
                    'x-emptyheader',
                    'x-example',
                ], testRequest, new Map([['created', 1402170695]])));
                expect(payload).to.equal('(request-target): get /foo\n' +
                    '(created): 1402170695\n' +
                    'host: example.org\n' +
                    'date: Tue, 07 Jun 2014 20:51:35 GMT\n' +
                    'cache-control: max-age=60, must-revalidate\n' +
                    'x-emptyheader: \n' +
                    'x-example: Example header with some whitespace.');
            });
        });
    })
});
