import {
  Component,
  HeaderExtractionOptions,
  Parameter,
  Parameters,
  RequestLike,
  ResponseLike,
  ParsedSignatureInput,
  SignOptions,
  VerifyOptions,
} from '../types';
import { URL } from 'url';

export const defaultSigningComponents: Component[] = [
  '@method',
  '@path',
  '@query',
  '@authority',
  'content-type',
  'digest',
  'content-digest',
];

export function extractHeader({ headers }: RequestLike | ResponseLike, header: string, opts?: HeaderExtractionOptions): string {
  const lcHeader = header.toLowerCase();
  const key = Object.keys(headers).find((name) => name.toLowerCase() === lcHeader);
  const allowMissing = opts?.allowMissing ?? true;
  if (!allowMissing && !key) {
    throw new Error(`Unable to extract header "${header}" from message`);
  }
  let val = key ? headers[key] ?? '' : '';
  if (Array.isArray(val)) {
    val = val.join(', ');
  }
  return val.toString().replace(/\s+/g, ' ');
}

function populateDefaultParameters(parameters: Parameters) {
  return {
    created: new Date(),
    ...parameters,
  };
}

// see https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures-06#section-2.3
export function extractComponent(message: RequestLike | ResponseLike, component: string): string {
  switch (component) {
    case '@method':
      return message.method.toUpperCase();
    case '@target-uri':
      return message.url;
    case '@authority': {
      const url = new URL(message.url);
      const port = url.port ? parseInt(url.port, 10) : null;
      return `${url.host}${port && ![80, 443].includes(port) ? `:${port}` : ''}`;
    }
    case '@scheme': {
      const { protocol } = new URL(message.url);
      return protocol.slice(0, -1);
    }
    case '@request-target': {
      const { pathname, search } = new URL(message.url);
      return `${pathname}${search}`;
    }
    case '@path': {
      const { pathname } = new URL(message.url);
      return pathname;
    }
    case '@query': {
      const { search } = new URL(message.url);
      return search;
    }
    case '@status':
      if (!(message as ResponseLike).status) {
        throw new Error(`${component} is only valid for responses`);
      }
      return (message as ResponseLike).status.toString();
    case '@query-params':
    case '@request-response':
      throw new Error(`${component} is not implemented yet`);
    default:
      throw new Error(`Unknown specialty component ${component}`);
  }
}

export function buildSignatureInputString(componentNames: Component[], parameters: Parameters): string {
  const components = componentNames.map((name) => `"${name.toLowerCase()}"`).join(' ');
  return `(${components})${Object.entries(parameters).map(([parameter, value]) => {
    if (typeof value === 'number') {
      return `;${parameter}=${value}`;
    } else if (value instanceof Date) {
      return `;${parameter}=${Math.floor(value.getTime() / 1000)}`;
    } else {
      return `;${parameter}="${value.toString()}"`;
    }
  }).join('')}`
}

export function parseSignatureInputString(signatureInput: string): { [signatureName: string]: ParsedSignatureInput } {

  return signatureInput.split[','].reduce((signatureInputs, signatureInputString) => {
    
    const [signatureName, signatureInputValue] = signatureInputString.trim().split['=']
    const parameterStrings: string[] = signatureInputValue.split[';']
  
    const componentList = parameterStrings.splice(0,1)[0]
    if(!componentList.startsWith('(') || !componentList.endsWith(')')) {
      throw new Error('Error parsing component list')
    }
    
    const components = componentList.substring(1,componentList.length -1).split(' ')
    let keyId = undefined
    const parameters = parameterStrings.reduce((parameters: Parameters, parameterString) => {
      const [key, value] = parameterString.split('=')
      switch(key as Parameter) {
        case 'created':
        case 'expires':
          return {...parameters, [key]: new Date(parseInt(value))}
        case 'nonce':
        case 'alg':
          return {...parameters, [key]: value}
        case 'kid':
          keyId = value
          return parameters
        default:
          return {...parameters, [key]: value}
      }
    }, {})
  
    return {
      ...signatureInputs,
      [signatureName.trim()] : {
        raw: signatureInputString.trim(),
        components,
        parameters,
        keyId
      }
    }
  }, {})
}

export function parseSignaturesString(signaturesString: string): { [signatureName: string]: Buffer }  {
  return signaturesString.split(',').reduce((signatures, signatureString) => {

    const [signatureName, signature] = signatureString.trim().split['=']
    if(!signature.startsWith(':') || !signature.endsWith(':')) {
      throw new Error('Error parsing signature')
    }
    return {...signatures, [signatureName.trim()]: Buffer.from(signature.substring(1,signature.length -1), 'base64')}
  }, {})
}

export function buildSignedData(request: RequestLike, components: Component[], signatureInputString: string): string {
  const parts = components.map((component) => {
    let value;
    if (component.startsWith('@')) {
      value = extractComponent(request, component);
    } else {
      value = extractHeader(request, component);
    }
    return `"${component.toLowerCase()}": ${value}`
  });
  parts.push(`"@signature-params": ${signatureInputString}`);
  return parts.join('\n');
}

// @todo - should be possible to sign responses too
export async function sign(request: RequestLike, opts: SignOptions): Promise<RequestLike> {
  const signingComponents: Component[] = opts.components ?? defaultSigningComponents;
  const signingParams: Parameters = populateDefaultParameters({
    ...opts.parameters,
    keyid: opts.keyId,
    alg: opts.signer.alg,
  });
  const signatureInputString = buildSignatureInputString(signingComponents, signingParams);
  const dataToSign = buildSignedData(request, signingComponents, signatureInputString);
  const signature = await opts.signer(Buffer.from(dataToSign));
  Object.assign(request.headers, {
    'Signature': `sig1=:${signature.toString('base64')}:`,
    'Signature-Input': `sig1=${signatureInputString}`,
  });
  return request;
}

export async function verify(request: RequestLike, opts: VerifyOptions): Promise<boolean> {

  const signatureInputs = parseSignatureInputString(extractHeader(request, 'signature-input'))
  const signatures = parseSignaturesString(extractHeader(request, 'signature'))

  return (await Promise.all(Object.entries(signatureInputs).map( ([signatureName, {components, raw}]) => {

    // @todo - select verifier based on keyid and alg parameters
    return opts.verifier(
      Buffer.from(buildSignedData(request, components, raw)), 
      signatures[signatureName])
  }))).reduce((acc, result) => acc && result, true)
}