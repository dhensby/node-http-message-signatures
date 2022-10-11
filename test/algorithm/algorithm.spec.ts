import { expect } from 'chai';
import { createSigner, createVerifier, UnknownAlgorithmError } from '../../src';

describe('algorithm', () => {
    describe('.createSigner', () => {
        it('throws for unknown algs', () => {
            try {
                createSigner(Buffer.from(''), 'unknown-alg');
            } catch (e) {
                expect(e).to.be.instanceOf(UnknownAlgorithmError);
                return;
            }
            expect.fail('Expected to throw');
        });
        it('adds the id prop if provided', () => {
            const signer = createSigner(Buffer.from(''), 'hmac-sha256', 'my-id');
            expect(signer).to.have.property('id', 'my-id');
        });
        it('has no id prop if not provided', () => {
            const signer = createSigner(Buffer.from(''), 'hmac-sha256');
            expect(signer).to.not.have.property('id');
        });
    });
    describe('.createVerifier', () => {
        it('throws for unknown algs', () => {
            try {
                createVerifier(Buffer.from(''), 'unknown-alg');
            } catch (e) {
                expect(e).to.be.instanceOf(UnknownAlgorithmError);
                return;
            }
            expect.fail('Expected to throw');
        });
    });
});
