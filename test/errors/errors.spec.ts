import * as errors from '../../src/errors';
import { expect } from 'chai';

describe('errors', () => {
    it('has all errors', () => {
        expect(Object.values(errors)).to.have.lengthOf(7);
    });
});
