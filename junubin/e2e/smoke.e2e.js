describe('App Smoke', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('shows onboarding content on cold launch', async () => {
    await expect(element(by.id('onboarding-hero-connect'))).toBeVisible();
    await expect(element(by.id('onboarding-skip'))).toBeVisible();
  });
});
