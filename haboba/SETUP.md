# Haboba - Dating App for the South Sudanese Community

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (iOS/Android)

### Install & Run

```bash
cd haboba
npm install
npx expo start
```

Then scan the QR code with Expo Go (Android) or Camera app (iOS).

### Run on Simulator
```bash
npx expo start --ios     # iOS Simulator
npx expo start --android # Android Emulator
```

## Project Structure

```
haboba/
├── App.js                    # Entry point with splash + navigation
├── app.json                  # Expo config
├── package.json              # Dependencies
├── babel.config.js           # Babel config with reanimated plugin
├── assets/                   # App icons & splash screen
│   ├── icon.png
│   ├── splash.png
│   ├── adaptive-icon.png
│   └── favicon.png
└── src/
    ├── assets/               # In-app assets
    │   └── logo.png
    ├── components/           # Reusable UI components
    │   ├── ActionButtons.js  # Swipe action buttons (like, nope, etc.)
    │   ├── HabobaLogo.js     # Branded logo component
    │   ├── ModeToggle.js     # Social/Dating mode toggle
    │   ├── PostCard.js       # Community feed post card
    │   └── ProfileCard.js    # Swipeable profile card
    ├── data/
    │   └── mockProfiles.js   # Mock data for profiles, posts, groups
    ├── navigation/
    │   └── AppNavigator.js   # Bottom tabs + stack navigation
    ├── screens/
    │   ├── HomeScreen.js     # Main swiping screen
    │   ├── LikesScreen.js    # Who liked you
    │   ├── CommunityScreen.js # Feed, Local, Groups
    │   ├── MessagesScreen.js # Connections & messages
    │   ├── ProfileScreen.js  # User profile
    │   ├── SettingsScreen.js # Full settings page
    │   ├── PreferencesScreen.js # Dating preferences
    │   ├── BoostScreen.js    # Purchase boosts
    │   ├── EliteScreen.js    # Elite subscription
    │   └── SplashScreen.js   # Animated splash
    └── theme/
        ├── colors.js         # Cream/brown color palette
        ├── typography.js     # Text styles
        └── index.js          # Theme exports
```

## Features

- **Profile Swiping** — Tinder-style cards with gesture-based like/nope
- **Social/Dating Modes** — Toggle between dating and social networking
- **Community Feed** — For You, Local, and Groups tabs
- **Groups** — Join and discover community groups
- **Messages** — View connections and conversations
- **Likes** — See who's interested (blurred for free users)
- **Profile** — Edit photos, view stats (boosts, super likes, notes)
- **Preferences** — Distance, age range, gender preferences
- **Boost** — Purchase profile boost packs
- **Elite/Premium** — Subscription tiers with feature carousel
- **Settings** — Full settings including notifications, account management

## Customization

### Replace the Logo
Put your `haboba-lg.png` in `src/assets/logo.png`, then update `HabobaLogo.js`:
```js
import { Image } from 'react-native';
const logo = require('../assets/logo.png');
// Replace the Text component with: <Image source={logo} style={{ width: 120, height: 40 }} />
```

### Color Theme
Edit `src/theme/colors.js` to adjust the cream/brown palette.

### Mock Data
Edit `src/data/mockProfiles.js` to change sample profiles, posts, and groups.
