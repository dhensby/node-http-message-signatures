import { extractHeader } from '../httpbis'
import { DigestAlgorithm, RequestLike } from '../types'
import { createHash } from 'crypto'

export function createContentDigestHeader(body: string | Buffer | undefined, algorithms: DigestAlgorithm[]): string {
    return algorithms.map((algo) => {
        return `${algo}=:${createHash(algo).update(body || '').digest('base64')}:`
    }).join(', ')
}

export function verifyContentDigest( request : RequestLike) {
    const digestHeaderString = extractHeader(request, 'content-digest')
    if(!digestHeaderString){
        throw new Error('No content-digest header in request.')
    }

    const digests = digestHeaderString.split(',')
    return digests.map(async (digestHeader) => {
        const [key, value] = digestHeader.split('=')
        const algo = key.trim().replace('-','')
        if (!value.startsWith(':') || !value.endsWith(':')) {
            throw new Error('Error parsing digest value')
        }
        if(algo !== 'sha256' && algo !== 'sha512') {
            throw new Error(`Unsupported hash algorithm '${key} used for content digest`)
        }
        const digest = value.substring(1, value.length - 1)
        const hash = createHash(algo).update(request.body || '').digest('base64')
        return digest === hash
    }).every(isValid => isValid)
}
