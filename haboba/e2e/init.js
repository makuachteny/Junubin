const detox = require('detox');
const adapter = require('detox/runners/jest/adapter');

jest.setTimeout(180000);

beforeAll(async () => {
  await detox.init(undefined, { launchApp: false });
}, 180000);

beforeEach(async () => {
  await adapter.beforeEach();
});

afterAll(async () => {
  await adapter.afterAll();
  await detox.cleanup();
}, 180000);
