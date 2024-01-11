import * as http from 'http';
import * as http2 from 'http2';
import { Server, Socket } from 'net';
import { expect } from 'chai';
import {
    createVerifier,
    httpbis,
    Request,
    UnacceptableSignatureError,
    VerifyingKey,
} from '../../src';
import { promises as fs } from 'fs';
import { parse } from 'path';
import { stub } from 'sinon';
import { lookup, LookupOneOptions } from 'dns';

interface ServerConfig {
    port: number;
    privateKey?: string;
}

interface TestServer {
    server: Server,
    start: () => Promise<void>;
    stop: () => Promise<void>;
    requests: Request[];
    clear: () => void;
}

function createHttpServer(config: ServerConfig): TestServer {
    const requests: Request[] = [];
    const server = http.createServer((req) => {
        const domain = req.headers.host ?? 'localhost';
        const request: Request = {
            method: req.method as string,
            headers: req.headers as Record<string, string | string[]>,
            url: `http://${domain}${req.url}`,
        };
        requests.push(request);
    });
    return {
        server,
        start: () => new Promise<void>((resolve) => {
            server.once('listening', () => resolve());
            server.listen(config.port);
        }),
        stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
        requests,
        clear: () => requests.splice(0),
    };
}

function createHttp2Server(config: ServerConfig): TestServer {
    const requests: Request[] = [];
    const connections: Socket[] = [];
    const server = http2.createServer();
    server.on('connection', (conn) => {
        connections.push(conn);
    });
    server.on('stream', (stream, headers) => {
        const domain = headers[':authority'] ?? 'localhost';
        const request: Request = {
            method: headers[':method'] as string,
            headers: headers as Record<string, string | string[]>,
            url: `http://${domain}${headers[':path']}`,
        };
        requests.push(request);
    });
    return {
        server,
        start: () => new Promise<void>((resolve) => {
            server.once('listening', () => resolve());
            server.listen(config.port);
        }),
        stop: () => new Promise<void>((resolve) => {
            Promise.all(connections.map((conn) => new Promise<void>((done) => {
                if (conn.destroyed) {
                    done();
                } else {
                    conn.destroy();
                    conn.on('close', done);
                }
            }))).then(() => server.close(() => resolve()));
        }),
        requests,
        clear: () => new Promise<void>((resolve) => {
            requests.splice(0);
            Promise.all(connections.map((conn) => new Promise<void>((closed) => {
                if (conn.destroyed) {
                    closed();
                } else {
                    conn.destroy();
                    conn.on('close', closed);
                }
            }))).then(() => resolve());
        }),
    };
}

function makeHttpRequest(request: Request, port?: number): Promise<http.IncomingMessage> {
    return new Promise<http.IncomingMessage>((resolve, reject) => {
        const url = typeof request.url === 'string' ? new URL(request.url) : request.url;
        const req = http.request({
            lookup: (hostname: string, options: LookupOneOptions, callback) => {
                lookup('localhost', options, callback);
            },
            hostname: url.hostname,
            port: port ?? url.port ?? 80,
            path: `${url.pathname}${url.search}`,
            method: request.method,
            headers: request.headers,
        }, resolve).once('error', reject);
        req.end();
    });
}

function makeHttp2Request(request: Request & { body?: string; }, port?: number): Promise<{ headers: Record<string, string | string[]>; body: Buffer; }> {
    return new Promise<{ headers: Record<string, string | string[]>; body: Buffer; }>((resolve, reject) => {
        const url = typeof request.url === 'string' ? new URL(request.url) : request.url;
        const client = http2.connect(request.url, {
            lookup: (hostname: string, options: LookupOneOptions, callback) => {
                lookup('localhost', options, callback);
            },
            // host: url.host,
            port: port ?? parseInt(url.port, 10) ?? 80,
        });
        const req: http2.ClientHttp2Stream = client.request({
            ...request.headers,
            ':method': request.method,
            ':path': `${url.pathname}${url.search}`,
        });
        let headers: Record<string, string | string[]>;
        req.end(request.body);
        req.on('response', (h) => {
            headers = h as Record<string, string | string[]>;
        });
        req.on('error', (e) => {
            client.close(() => reject(e));
        });
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            client.close(() => resolve({
                headers,
                body: Buffer.concat(chunks),
            }));
        });
    });
}

describe('httpbis', () => {
    let keys: VerifyingKey[];
    before('load keys', async () => {
        keys = await Promise.all([{
            file: 'test-key-rsa.pem',
            alg: 'rsa-v1_5-sha256',
        }, {
            file: 'test-key-rsa-pss.pem',
            alg: 'rsa-pss-sha512',
        }, {
            file: 'test-key-ecc-p256.pem',
            alg: 'ecdsa-p256-sha256',
        }, {
            file: 'test-key-ed25519.pem',
            alg: 'ed25519',
        }, {
            file: 'test-shared-secret.txt',
            alg: 'hmac-sha256',
        }].map(async ({file, alg}) => {
            const key = await fs.readFile(`./test/etc/${file}`);
            return {
                id: parse(file).name,
                algs: [alg],
                verify: createVerifier(alg.startsWith('hmac-') ? Buffer.from(key.toString(), 'base64') : key, alg),
            };
        }));
    });
    describe('http', () => {
        let server: TestServer;
        before('create server', async () => {
            server = createHttpServer({port: 8080});
            server.server.on('request', (req, res) => {
                res.setHeader('Date', 'Tue, 20 Apr 2021 02:07:56 GMT');
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Digest', 'sha-512=:mEWXIS7MaLRuGgxOBdODa3xqM1XdEvxoYhvlCFJ41QJgJc4GTsPp29l5oGX69wWdXymyU0rjJuahq4l5aGgfLQ==:');
                res.setHeader('Content-Length', '23');
                res.setHeader('Signature-Input', 'sig-b24=("@status" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-ecc-p256"');
                res.setHeader('Signature', 'sig-b24=:wNmSUAhwb5LxtOtOpNa6W5xj067m5hFrj0XQ4fvpaCLx0NKocgPquLgyahnzDnDAUy5eCdlYUEkLIj+32oiasw==:');
                res.end('{"message": "good dog"}');
            });
            return server.start();
        });
        beforeEach('reset requests', () => server.clear());
        after('stop server', async function stopServer () {
            this.timeout(5000);
            return server.stop();
        });
        describe('rsa-pss-sha512', () => {
            it('verifies minimal example', async () => {
                await makeHttpRequest({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        'Host': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                        'Signature': 'sig-b21=:d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==:',
                    },
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({keyid}) => {
                    if (keyid) {
                        return keys.find(({id}) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-key-rsa-pss',
                    nonce: 'b3k2pp5k7z-50gnwp.yemd',
                    created: new Date(1618884473 * 1000),
                })
                expect(valid).to.equal(true);
            });
            it('rejects minimal example if we add required params', async () => {
                await makeHttpRequest({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        'Host': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                        'Signature': 'sig-b21=:d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==:',
                    },
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({keyid}) => {
                    if (keyid) {
                        return keys.find(({id}) => id === keyid) ?? null;
                    }
                    return null;
                });
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                        requiredFields: ['content-digest'],
                    }, request);
                } catch (e) {
                    expect(e).to.be.instanceOf(UnacceptableSignatureError);
                    expect(keyLookup).to.have.callCount(1);
                    expect(keyLookup).to.have.been.calledOnceWithExactly({
                        keyid: 'test-key-rsa-pss',
                        nonce: 'b3k2pp5k7z-50gnwp.yemd',
                        created: new Date(1618884473 * 1000),
                    });
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('verifies selective components', async () => {
                await makeHttpRequest({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        'Host': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
                        'Signature': 'sig-b22=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                    },
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({ keyid }) => {
                    if (keyid) {
                        return keys.find(({ id }) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-key-rsa-pss',
                    tag: 'header-example',
                    created: new Date(1618884473 * 1000),
                });
                expect(valid).to.equal(true);
            });
            it('verifies full coverage', async () => {
                await makeHttpRequest({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        'Host': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b23=("date" "@method" "@path" "@query" "@authority" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-rsa-pss"',
                        'Signature': 'sig-b23=:bbN8oArOxYoyylQQUU6QYwrTuaxLwjAC9fbY2F6SVWvh0yBiMIRGOnMYwZ/5MR6fb0Kh1rIRASVxFkeGt683+qRpRRU5p2voTp768ZrCUb38K0fUxN0O0iC59DzYx8DFll5GmydPxSmme9v6ULbMFkl+V5B1TP/yPViV7KsLNmvKiLJH1pFkh/aYA2HXXZzNBXmIkoQoLd7YfW91kE9o/CCoC1xMy7JA1ipwvKvfrs65ldmlu9bpG6A9BmzhuzF8Eim5f8ui9eH8LZH896+QIF61ka39VBrohr9iyMUJpvRX2Zbhl5ZJzSRxpJyoEZAFL2FUo5fTIztsDZKEgM4cUA==:',
                    },
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({ keyid }) => {
                    if (keyid) {
                        return keys.find(({ id }) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-key-rsa-pss',
                    created: new Date(1618884473 * 1000),
                });
                expect(valid).to.equal(true);
            });
        });
        describe('ecdsa-p256-sha256', () => {
            it('verifies a response', async () => {
                const response = await makeHttpRequest({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        'Host': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b23=("date" "@method" "@path" "@query" "@authority" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-rsa-pss"',
                        'Signature': 'sig-b23=:bbN8oArOxYoyylQQUU6QYwrTuaxLwjAC9fbY2F6SVWvh0yBiMIRGOnMYwZ/5MR6fb0Kh1rIRASVxFkeGt683+qRpRRU5p2voTp768ZrCUb38K0fUxN0O0iC59DzYx8DFll5GmydPxSmme9v6ULbMFkl+V5B1TP/yPViV7KsLNmvKiLJH1pFkh/aYA2HXXZzNBXmIkoQoLd7YfW91kE9o/CCoC1xMy7JA1ipwvKvfrs65ldmlu9bpG6A9BmzhuzF8Eim5f8ui9eH8LZH896+QIF61ka39VBrohr9iyMUJpvRX2Zbhl5ZJzSRxpJyoEZAFL2FUo5fTIztsDZKEgM4cUA==:',
                    },
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({ keyid }) => {
                    if (keyid) {
                        return keys.find(({ id }) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, {
                    status: response.statusCode as number,
                    headers: response.headers as Record<string, string | string[]>,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-key-ecc-p256',
                    created: new Date(1618884473 * 1000),
                });
                expect(valid).to.equal(true);
            });
        });
        describe('hmac-sha256', () => {
            // There seems to be a problem in node in verifying ecdsa signatures from external sources
            it('verifies a request', async () => {
                await makeHttpRequest({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        'Host': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b25=("date" "@authority" "content-type");created=1618884473;keyid="test-shared-secret"',
                        'Signature': 'sig-b25=:pxcQw6G3AjtMBQjwo8XzkZf/bws5LelbaMk5rGIGtE8=:',
                    },
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({ keyid }) => {
                    if (keyid) {
                        return keys.find(({ id }) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-shared-secret',
                    created: new Date(1618884473 * 1000),
                });
                expect(valid).to. equal(true);
            });
        });
        describe('ed25519', () => {
            // There seems to be a problem in node in verifying ecdsa signatures from external sources
            it('verifies a request', async () => {
                await makeHttpRequest({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        'Host': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b26=("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"',
                        'Signature': 'sig-b26=:wqcAqbmYJ2ji2glfAMaRy4gruYYnx2nEFN2HN6jrnDnQCK1u02Gb04v9EDgwUPiu4A0w6vuQv5lIp5WPpBKRCw==:',
                    },
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({ keyid }) => {
                    if (keyid) {
                        return keys.find(({ id }) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-key-ed25519',
                    created: new Date(1618884473 * 1000),
                });
                expect(valid).to. equal(true);
            });
        });
    });
    describe('http2', () => {
        let server: TestServer;
        before('create server', async () => {
            server = createHttp2Server({ port: 8080 });
            server.server.on('stream', (stream) => {
                stream.respond({
                    ':status': 200,
                    'date': 'Tue, 20 Apr 2021 02:07:56 GMT',
                    'content-type': 'application/json',
                    'content-digest': 'sha-512=:mEWXIS7MaLRuGgxOBdODa3xqM1XdEvxoYhvlCFJ41QJgJc4GTsPp29l5oGX69wWdXymyU0rjJuahq4l5aGgfLQ==:',
                    'content-length': '23',
                    'signature-input': 'sig-b24=("@status" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-ecc-p256"',
                    'signature': 'sig-b24=:wNmSUAhwb5LxtOtOpNa6W5xj067m5hFrj0XQ4fvpaCLx0NKocgPquLgyahnzDnDAUy5eCdlYUEkLIj+32oiasw==:',
                });
                stream.end('{"message": "good dog"}');
                stream.close();
            });
            return server.start();
        });
        beforeEach('reset requests', () => server.clear());
        after('stop server', async () => {
            return server.stop();
        });
        describe('rsa-pss-sha512', () => {
            it('verifies minimal example', async () => {
                await makeHttp2Request({
                    method: 'POST',
                    url: 'http://localhost:8080/foo?param=Value&Pet=dog',
                    headers: {
                        ':authority': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                        'Signature': 'sig-b21=:d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==:',
                    },
                    body: '{"hello": "world"}',
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({keyid}) => {
                    if (keyid) {
                        return keys.find(({id}) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-key-rsa-pss',
                    nonce: 'b3k2pp5k7z-50gnwp.yemd',
                    created: new Date(1618884473 * 1000),
                })
                expect(valid).to.equal(true);
            });
            it('rejects minimal example if we add required params', async () => {
                await makeHttp2Request({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        ':authority': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
                        'Signature': 'sig-b21=:d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==:',
                    },
                    body: '{"hello": "world"}',
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({keyid}) => {
                    if (keyid) {
                        return keys.find(({id}) => id === keyid) ?? null;
                    }
                    return null;
                });
                try {
                    await httpbis.verifyMessage({
                        keyLookup,
                        requiredFields: ['content-digest'],
                    }, request);
                } catch (e) {
                    expect(e).to.be.instanceOf(UnacceptableSignatureError);
                    expect(keyLookup).to.have.callCount(1);
                    expect(keyLookup).to.have.been.calledOnceWithExactly({
                        keyid: 'test-key-rsa-pss',
                        nonce: 'b3k2pp5k7z-50gnwp.yemd',
                        created: new Date(1618884473 * 1000),
                    });
                    return;
                }
                expect.fail('Expected to throw');
            });
            it('verifies selective components', async () => {
                await makeHttp2Request({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        ':authority': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
                        'Signature': 'sig-b22=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:',
                    },
                    body: '{"hello": "world"}',
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({ keyid }) => {
                    if (keyid) {
                        return keys.find(({ id }) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-key-rsa-pss',
                    tag: 'header-example',
                    created: new Date(1618884473 * 1000),
                });
                expect(valid).to.equal(true);
            });
            it('verifies full coverage', async () => {
                await makeHttp2Request({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        ':authority': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b23=("date" "@method" "@path" "@query" "@authority" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-rsa-pss"',
                        'Signature': 'sig-b23=:bbN8oArOxYoyylQQUU6QYwrTuaxLwjAC9fbY2F6SVWvh0yBiMIRGOnMYwZ/5MR6fb0Kh1rIRASVxFkeGt683+qRpRRU5p2voTp768ZrCUb38K0fUxN0O0iC59DzYx8DFll5GmydPxSmme9v6ULbMFkl+V5B1TP/yPViV7KsLNmvKiLJH1pFkh/aYA2HXXZzNBXmIkoQoLd7YfW91kE9o/CCoC1xMy7JA1ipwvKvfrs65ldmlu9bpG6A9BmzhuzF8Eim5f8ui9eH8LZH896+QIF61ka39VBrohr9iyMUJpvRX2Zbhl5ZJzSRxpJyoEZAFL2FUo5fTIztsDZKEgM4cUA==:',
                    },
                    body: '{"hello": "world"}',
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({ keyid }) => {
                    if (keyid) {
                        return keys.find(({ id }) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-key-rsa-pss',
                    created: new Date(1618884473 * 1000),
                });
                expect(valid).to.equal(true);
            });
        });
        describe('ecdsa-p256-sha256', () => {
            it('verifies a response', async () => {
                const response = await makeHttp2Request({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        ':authority': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b23=("date" "@method" "@path" "@query" "@authority" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-rsa-pss"',
                        'Signature': 'sig-b23=:bbN8oArOxYoyylQQUU6QYwrTuaxLwjAC9fbY2F6SVWvh0yBiMIRGOnMYwZ/5MR6fb0Kh1rIRASVxFkeGt683+qRpRRU5p2voTp768ZrCUb38K0fUxN0O0iC59DzYx8DFll5GmydPxSmme9v6ULbMFkl+V5B1TP/yPViV7KsLNmvKiLJH1pFkh/aYA2HXXZzNBXmIkoQoLd7YfW91kE9o/CCoC1xMy7JA1ipwvKvfrs65ldmlu9bpG6A9BmzhuzF8Eim5f8ui9eH8LZH896+QIF61ka39VBrohr9iyMUJpvRX2Zbhl5ZJzSRxpJyoEZAFL2FUo5fTIztsDZKEgM4cUA==:',
                    },
                    body: '{"hello": "world"}',
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({ keyid }) => {
                    if (keyid) {
                        return keys.find(({ id }) => id === keyid) ?? null;
                    }
                    return null;
                });
                console.log(response.headers);
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, {
                    status: response.headers[':status'] as unknown as number,
                    headers: response.headers as Record<string, string | string[]>,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-key-ecc-p256',
                    created: new Date(1618884473 * 1000),
                });
                expect(valid).to.equal(true);
            });
        });
        describe('hmac-sha256', () => {
            // There seems to be a problem in node in verifying ecdsa signatures from external sources
            it('verifies a request', async () => {
                await makeHttp2Request({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        ':authority': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b25=("date" "@authority" "content-type");created=1618884473;keyid="test-shared-secret"',
                        'Signature': 'sig-b25=:pxcQw6G3AjtMBQjwo8XzkZf/bws5LelbaMk5rGIGtE8=:',
                    },
                    body: '{"hello": "world"}',
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({ keyid }) => {
                    if (keyid) {
                        return keys.find(({ id }) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-shared-secret',
                    created: new Date(1618884473 * 1000),
                });
                expect(valid).to. equal(true);
            });
        });
        describe('ed25519', () => {
            // There seems to be a problem in node in verifying ecdsa signatures from external sources
            it('verifies a request', async () => {
                await makeHttp2Request({
                    method: 'POST',
                    url: 'http://example.com/foo?param=Value&Pet=dog',
                    headers: {
                        ':authority': 'example.com',
                        'Date': 'Tue, 20 Apr 2021 02:07:55 GMT',
                        'Content-Type': 'application/json',
                        'Content-Digest': 'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
                        'Content-Length': '18',
                        'Signature-Input': 'sig-b26=("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"',
                        'Signature': 'sig-b26=:wqcAqbmYJ2ji2glfAMaRy4gruYYnx2nEFN2HN6jrnDnQCK1u02Gb04v9EDgwUPiu4A0w6vuQv5lIp5WPpBKRCw==:',
                    },
                    body: '{"hello": "world"}',
                }, 8080);
                expect(server.requests).to.have.lengthOf(1);
                const [request] = server.requests;
                const keyLookup = stub().callsFake(async ({ keyid }) => {
                    if (keyid) {
                        return keys.find(({ id }) => id === keyid) ?? null;
                    }
                    return null;
                });
                const valid = await httpbis.verifyMessage({
                    keyLookup,
                }, request);
                expect(keyLookup).to.have.callCount(1);
                expect(keyLookup).to.have.been.calledOnceWithExactly({
                    keyid: 'test-key-ed25519',
                    created: new Date(1618884473 * 1000),
                });
                expect(valid).to. equal(true);
            });
        });
    });
});
