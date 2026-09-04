const DEFAULT_HUGGING_FACE_ENDPOINT = 'https://hf-mirror.com/';

function normalizeEndpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`HF_ENDPOINT must use http or https, got ${url.protocol}`);
  }
  return url.toString().replace(/\/+$/, '') + '/';
}

/**
 * Resolve the model host used by every runtime speech-model downloader.
 * `HF_ENDPOINT` matches the convention used by huggingface_hub and by the
 * repository's build-time model downloader.
 */
export function resolveHuggingFaceEndpoint(
  configured = process.env.HF_ENDPOINT,
): string {
  const value = configured?.trim() || DEFAULT_HUGGING_FACE_ENDPOINT;
  try {
    return normalizeEndpoint(value);
  } catch (error: any) {
    throw new Error(`Invalid HF_ENDPOINT "${value}": ${error?.message ?? String(error)}`);
  }
}

export function configureTransformersEndpoint(env: { remoteHost: string }): string {
  const endpoint = resolveHuggingFaceEndpoint();
  env.remoteHost = endpoint;
  return endpoint;
}

export function buildHuggingFaceResolveUrl(
  repo: string,
  file: string,
  revision = 'main',
): string {
  const endpoint = resolveHuggingFaceEndpoint();
  const relativePath = `${repo}/resolve/${encodeURIComponent(revision)}/${file}`;
  return new URL(relativePath, endpoint).toString();
}
