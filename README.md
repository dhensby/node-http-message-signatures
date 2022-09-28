# HTTP Message Signatures

[![Node.js CI](https://github.com/dhensby/node-http-message-signatures/actions/workflows/nodejs.yml/badge.svg)](https://github.com/dhensby/node-http-message-signatures/actions/workflows/nodejs.yml)

Based on the draft specifications for HTTP Message Signatures, this library facilitates the signing
of HTTP messages before being sent.

## Specifications

Two specifications are supported by this library:

1. [HTTPbis](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures)
2. [Cavage](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures) and subsequent [RichAnna](https://datatracker.ietf.org/doc/html/draft-richanna-http-message-signatures)

## Approach

As the Cavage/RichAnna specification is now expired and superseded by the HTTPbis one, this library takes a
"HTTPbis-first" approach. This means that most support and maintenance will go into the HTTPbis
implementation and syntax. The syntax is then back-ported to the as much as possible.

## Caveats

The Cavage/RichAnna specifications have changed over time, introducing new features. The aim is to support
the [latest version of the specification](https://datatracker.ietf.org/doc/html/draft-richanna-http-message-signatures)
and not to try to support each version in isolation.

## Examples

### Signing a request

```js
const { sign, createSigner } = require('http-message-signing');

(async () => {
    const signedRequest = await sign({
        method: 'POST',
        url: 'https://example.com',
        headers: {
            'content-type': 'text/plain',
        },
        body: 'test',
    }, {
        components: [
            '@method',
            '@authority',
            'content-type',
        ],
        parameters: {
            created: Math.floor(Date.now() / 1000),
        },
        keyId: 'my-hmac-secret',
        signer: createSigner('hmac-sha256'),
    });
    // signedRequest now has the `Signature` and `Signature-Input` headers
})().catch(console.error);
```

### Signing with your own signer

It's possible to provide your own signer (this is useful if you're using a secure enclave or key
management service). To do so, you must implement a callable that has the `alg` prop set to a valid
algorithm value. It's possible to use proprietary algorithm values if you have some internal signing
logic you need to support.

```js
const mySigner = async (data) => {
    return Buffer.from('my sig');
}
mySigner.alg = 'custom-123';
```
