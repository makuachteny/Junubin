// Verify FindFriends screen is registered in the navigator
const fs = require('fs');
const path = require('path');

describe('FindFriends route registration', () => {
  const navigatorSource = fs.readFileSync(
    path.resolve(__dirname, '../AppNavigator.js'),
    'utf8'
  );

  it('imports FindFriendsScreen', () => {
    expect(navigatorSource).toContain("import('../screens/FindFriendsScreen')");
  });

  it('registers FindFriends route in MainStack', () => {
    expect(navigatorSource).toContain('name="FindFriends"');
    expect(navigatorSource).toContain('component={FindFriendsScreen}');
  });
});
