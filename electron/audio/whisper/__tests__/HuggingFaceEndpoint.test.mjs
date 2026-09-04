import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const compiledPath = path.resolve(
  dirname,
  '../../../../dist-electron/electron/audio/whisper/huggingFaceEndpoint.js',
);
const {
  buildHuggingFaceResolveUrl,
  configureTransformersEndpoint,
  resolveHuggingFaceEndpoint,
} = await import(pathToFileURL(compiledPath).href);

test('HF_ENDPOINT is normalized for Transformers.js', () => {
  assert.equal(resolveHuggingFaceEndpoint(''), 'https://hf-mirror.com/');
  assert.equal(
    resolveHuggingFaceEndpoint('https://hf-mirror.com'),
    'https://hf-mirror.com/',
  );
  assert.equal(
    resolveHuggingFaceEndpoint(' https://example.test/hf/// '),
    'https://example.test/hf/',
  );
});

test('Transformers.js receives the configured HF_ENDPOINT', () => {
  const previous = process.env.HF_ENDPOINT;
  process.env.HF_ENDPOINT = 'https://hf-mirror.com';
  try {
    const env = { remoteHost: 'https://huggingface.co/' };
    const endpoint = configureTransformersEndpoint(env);
    assert.equal(endpoint, 'https://hf-mirror.com/');
    assert.equal(env.remoteHost, 'https://hf-mirror.com/');
  } finally {
    if (previous === undefined) delete process.env.HF_ENDPOINT;
    else process.env.HF_ENDPOINT = previous;
  }
});

test('direct model downloads use the configured HF_ENDPOINT', () => {
  const previous = process.env.HF_ENDPOINT;
  process.env.HF_ENDPOINT = 'https://hf-mirror.com';
  try {
    assert.equal(
      buildHuggingFaceResolveUrl('org/model', 'onnx/encoder.onnx'),
      'https://hf-mirror.com/org/model/resolve/main/onnx/encoder.onnx',
    );
  } finally {
    if (previous === undefined) delete process.env.HF_ENDPOINT;
    else process.env.HF_ENDPOINT = previous;
  }
});

test('invalid HF_ENDPOINT protocols fail with a clear error', () => {
  assert.throws(
    () => resolveHuggingFaceEndpoint('file:///tmp/models'),
    /HF_ENDPOINT must use http or https/,
  );
});
