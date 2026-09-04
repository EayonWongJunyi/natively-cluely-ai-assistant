// DeepSeek V4 Flash Vision integration regression coverage.
// Run after `npm run build:electron`.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module from 'node:module';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = (relative) => path.resolve(__dirname, '../../../dist-electron/electron', relative);

const deepseekModels = await import(pathToFileURL(dist('llm/deepseekModels.js')).href);
const { getModelCapabilities } = await import(pathToFileURL(dist('llm/modelCapabilities.js')).href);
const { filterDeepSeekModels } = await import(pathToFileURL(dist('utils/modelFetcher.js')).href);

// LLMHelper's bundle imports Electron for app paths even though the two methods
// exercised below need no Electron APIs. Match the repository's other plain-Node
// LLMHelper tests by installing a minimal module stub before requiring the bundle.
const require = createRequire(import.meta.url);
const electronPath = require.resolve('electron');
const electronStubModule = new Module(electronPath);
electronStubModule.exports = {
  app: {
    isReady: () => true,
    getPath: () => os.tmpdir(),
    getName: () => 'natively-test',
    getVersion: () => '0.0.0-test',
  },
  safeStorage: { isEncryptionAvailable: () => false },
  shell: { openPath: async () => '' },
  ipcMain: { on: () => {}, handle: () => {}, removeAllListeners: () => {} },
  BrowserWindow: { getAllWindows: () => [] },
};
electronStubModule.loaded = true;
require.cache[electronPath] = electronStubModule;
const { LLMHelper } = require(dist('LLMHelper.js'));

const VISION_MODEL = 'deepseek-v4-flash-vision-exp';

describe('DeepSeek model discovery and capability classification', () => {
  test('the official vision model survives catalog filtering', () => {
    const filtered = filterDeepSeekModels([
      { id: 'deepseek-v4-flash' },
      { id: VISION_MODEL },
      { id: 'deepseek-v4-image-generator' },
      { id: 'text-embedding-v1' },
    ]).map(model => model.id);

    assert.deepEqual(filtered, ['deepseek-v4-flash', VISION_MODEL]);
    assert.equal(deepseekModels.DEEPSEEK_DEFAULT_MODEL_IDS.includes(VISION_MODEL), true,
      'fallback catalog must keep Vision-Exp visible when /models is unavailable');
  });

  test('only Vision-Exp claims image support', () => {
    assert.equal(deepseekModels.deepseekSupportsImages(VISION_MODEL), true);
    assert.equal(getModelCapabilities(VISION_MODEL, false).supportsImages, true);
    assert.equal(getModelCapabilities('deepseek-v4-flash', false).supportsImages, false);
    assert.equal(getModelCapabilities('deepseek-v4-pro', false).supportsImages, false);
  });
});

function capturingClient(captured) {
  return {
    chat: {
      completions: {
        create: async (body) => {
          captured.push(body);
          if (body.stream) {
            return (async function* () {
              yield { choices: [{ delta: { content: 'ok' } }] };
            })();
          }
          return { choices: [{ message: { content: 'ok' } }] };
        },
      },
    },
  };
}

function makeHelper(captured, scopeCalls) {
  const helper = Object.create(LLMHelper.prototype);
  helper.isLocalOnlyMode = false;
  helper.currentModelId = VISION_MODEL;
  helper.deepseekPermanentlyDead = false;
  helper.rateLimiters = { deepseek: { acquire: async () => {} } };
  Object.defineProperty(helper, 'deepseekClient', { value: capturingClient(captured), writable: true });
  helper.assertOutboundScopes = (provider, message, imagePaths) => {
    scopeCalls.push({ provider, message, imagePaths });
  };
  helper.processImage = async () => ({ mimeType: 'image/png', data: 'aW1hZ2U=' });
  helper.withRetry = (fn) => fn();
  helper.withTimeout = (promise) => promise;
  return helper;
}

async function drain(stream) {
  let out = '';
  for await (const chunk of stream) out += chunk;
  return out;
}

describe('DeepSeek Chat Completions multimodal payload', () => {
  test('streaming and non-streaming calls send OpenAI-compatible image_url blocks', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-vision-'));
    const imagePath = path.join(tmp, 'screen.png');
    fs.writeFileSync(imagePath, Buffer.from('fixture'));

    const captured = [];
    const scopeCalls = [];
    const helper = makeHelper(captured, scopeCalls);

    const streamed = await drain(helper.streamWithDeepseek('read this', 'system', VISION_MODEL, undefined, [imagePath]));
    const generated = await helper.generateWithDeepseek('read this', 'system', VISION_MODEL, [imagePath]);

    assert.equal(streamed, 'ok');
    assert.equal(generated, 'ok');
    assert.equal(captured.length, 2);
    for (const body of captured) {
      assert.equal(body.model, VISION_MODEL);
      const user = body.messages.find(message => message.role === 'user');
      assert.deepEqual(user.content[0], { type: 'text', text: 'read this' });
      assert.equal(user.content[1].type, 'image_url');
      assert.equal(user.content[1].image_url.url, 'data:image/png;base64,aW1hZ2U=');
    }
    assert.equal(scopeCalls.length, 2);
    assert.deepEqual(scopeCalls[0].imagePaths, [imagePath], 'privacy scope guard must see the screenshot');
  });

  test('text-only DeepSeek models reject images before dispatch', async () => {
    const captured = [];
    const helper = makeHelper(captured, []);

    await assert.rejects(
      drain(helper.streamWithDeepseek('read this', 'system', 'deepseek-v4-flash', undefined, ['/tmp/screen.png'])),
      /does not support image input/,
    );
    assert.equal(captured.length, 0);
  });
});
