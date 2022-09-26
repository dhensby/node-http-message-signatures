import {
    Dictionary as DictType,
    isInnerList,
    Item as ItemType,
    List as ListType,
    parseDictionary,
    parseItem,
    parseList,
    serializeDictionary,
    serializeInnerList,
    serializeItem,
    serializeList,
} from 'structured-headers';

export class Dictionary {
    private readonly parsed: DictType;
    private readonly raw: string;
    constructor(input: string) {
        this.raw = input;
        this.parsed = parseDictionary(input);
    }

    toString(): string {
        return this.serialize();
    }

    serialize(): string {
        return serializeDictionary(this.parsed);
    }

    has(key: string): boolean {
        return this.parsed.has(key);
    }

    get(key: string): string | undefined {
        const value = this.parsed.get(key);
        if (!value) {
            return value;
        }
        if (isInnerList(value)) {
            return serializeInnerList(value);
        }
        return serializeItem(value);
    }
}

export class List {
    private readonly parsed: ListType;
    private readonly raw: string;
    constructor(input: string) {
        this.raw = input;
        this.parsed = parseList(input);
    }

    toString(): string {
        return this.serialize();
    }

    serialize(): string {
        return serializeList(this.parsed);
    }
}

export class Item {
    private readonly parsed: ItemType;
    private readonly raw: string;
    constructor(input: string) {
        this.raw = input;
        this.parsed = parseItem(input);
    }

    toString(): string {
        return this.serialize();
    }

    serialize(): string {
        return serializeItem(this.parsed);
    }
}

export function parseHeader(header: string): List | Dictionary | Item {
    const classes = [List, Dictionary, Item];
    for (let i = 0; i < classes.length; i++) {
        try {
            return new classes[i](header);
        } catch (e) {
            // noop
        }
    }
    throw new Error('Unable to parse header as structured field');
}
