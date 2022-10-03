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

## Limitations in compliance with the specification

As with many libraries and environments, HTTP Requests and Responses are abstracted away from the
developer. This fact is noted in the specification. As such (in compliance with the specification),
consumers of this library should take care to make sure that they are processing signatures that
only cover fields/components whose values can be reliably resolved. Below is a list of limitations
that you should be aware of when selecting a list of parameters to sign or accept.

### Derived component limitations

Many of the derived components are expected to be sourced from what are effectively http2 pseudo
headers. However, if the application is not running in http2 mode or the message being signed is
not being built as a http2 message, then some of these pseudo headers will not be available to the
application and must be derived from a URL.

#### @request-target

The [`@request-target`](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-2.2.5)
component is intended to be the equivalent to the "request target portion of the request line".
See the specification for examples of what this means. In NodeJS, this line in requests is automatically
constructed for consumers, so it's not possible to know for certainty what this will be. For incoming
requests, it is possible to extract, but for simplicity’s sake this library does not process the raw
headers for the incoming request and, as such, cannot calculate this value with certainty. It is
recommended that this component is avoided.

### Multiple message component contexts

As described in [section 7.4.4](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-7.4.4)
it is deemed that complex message context resolution is outside the scope of this library.

This means that it is the responsibility of the consumer of this library to construct the equivalent
message context for signatures that need to be reinterpreted based on other signer contexts.


### Padding attacks

As described in [section 7.5.7](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures-13#section-7.5.7)
it is expected that the NodeJS application has taken steps to ensure that headers are valid and not
"garbage". For this library to take on that obligation would be to widen the scope of the library to
a complete HTTP Message validator.

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
