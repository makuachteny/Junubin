// Load-smoke: ensures the screens touched by the picker work import and
// wire up without syntax/import errors. Module load executes all
// top-level imports (DateWheelPicker, SearchablePicker, etc.) and const
// setup, so a broken wiring throws here even though we don't render.

describe('picker screens load without wiring errors', () => {
  it('EditProfileScreen exports a component', () => {
    expect(typeof require('../EditProfileScreen').default).toBe('function');
  });

});
