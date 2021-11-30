import { Signer, Verifier } from '../algorithm';

type HttpLike = {
    method: string,
    url: string,
    headers: { [header: string]: string | string[] | undefined },
    body?: string | Buffer,
}

export type RequestLike = HttpLike;

export type ResponseLike = HttpLike & {
    status: number,
}

// see https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures-06#section-2.3.1
export type Parameter = 'created' | 'expires' | 'nonce' | 'alg' | 'keyid' | string;

export type Component = '@method' | '@target-uri' | '@authority' | '@scheme' | '@request-target' | '@path' | '@query' | '@query-params' | string;

export type ResponseComponent = '@status' | '@request-response' | Component;

export type Parameters = { [name: Parameter]: string | number | Date | { [Symbol.toStringTag]: () => string } };

type CommonOptions = {
    format: 'httpbis' | 'cavage',
}

export type SignOptions = CommonOptions & {
    components?: Component[],
    parameters?: Parameters,
    allowMissingHeaders?: boolean,
    keyId: string,
    signer: Signer,
};

export type VerifyOptions = CommonOptions & {
    verifier: Verifier,
}

export type HeaderExtractionOptions = {
    allowMissing: boolean,
};
