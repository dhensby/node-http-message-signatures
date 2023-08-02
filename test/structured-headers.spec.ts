import { Dictionary, Item, List } from '../src/structured-header';
import { expect } from 'chai';

describe('structured-headers', () => {
    describe('Dictionary', () => {
        it('parses a dictionary', () => {
            const dict = new Dictionary('a=(1 2), b=3, c=4;aa=bb, d=(5 6);valid');
            expect(dict).to.be.instanceOf(Dictionary);
            expect(dict.has('a')).to.equal(true);
            expect(dict.has('b')).to.equal(true);
            expect(dict.has('c')).to.equal(true);
            expect(dict.has('d')).to.equal(true);
            expect(dict.get('a')).to.equal('(1 2)');
            expect(dict.get('b')).to.equal('3');
            expect(dict.get('c')).to.equal('4;aa=bb');
            expect(dict.get('d')).to.equal('(5 6);valid');
            expect(dict.get('e')).to.equal(undefined);
        });
    });
    describe('List', () => {
        it('parses a list', () => {
            const list = new List('sugar, tea, rum');
            expect(list).to.be.instanceOf(List);
            expect(list.toString()).to.equal('sugar, tea, rum');
            expect(list.serialize()).to.equal('sugar, tea, rum');
        });
    });
    describe('Item', () => {
        it('parses an integer', () => {
            const item = new Item('42');
            expect(item).to.be.instanceOf(Item);
            expect(item.toString()).to.equal('42');
            expect(item.serialize()).to.equal('42');
        });
        it('parses a decimal', () => {
            const item = new Item('42.1');
            expect(item).to.be.instanceOf(Item);
            expect(item.toString()).to.equal('42.1');
            expect(item.serialize()).to.equal('42.1');
        });
        it('parses a string', () => {
            const item = new Item('"a string"');
            expect(item).to.be.instanceOf(Item);
            expect(item.toString()).to.equal('"a string"');
            expect(item.serialize()).to.equal('"a string"');
        });
        it('parses a token', () => {
            const item = new Item('token');
            expect(item).to.be.instanceOf(Item);
            expect(item.toString()).to.equal('token');
            expect(item.serialize()).to.equal('token');
        });
        it('parses a byte sequence', () => {
            const item = new Item(':AAA=:');
            expect(item).to.be.instanceOf(Item);
            expect(item.toString()).to.equal(':AAA=:');
            expect(item.serialize()).to.equal(':AAA=:');
        });
        it('parses a boolean', () => {
            const item = new Item('?1');
            expect(item).to.be.instanceOf(Item);
            expect(item.toString()).to.equal('?1');
            expect(item.serialize()).to.equal('?1');
        });
    });
});
