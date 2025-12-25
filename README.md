# LushList - React Native Expo App

A React Native mobile application built with Expo, compatible with iOS and Android, and ready to use with Expo Go.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or later)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo Go app](https://expo.dev/client) installed on your iOS or Android device
  - iOS: Download from [App Store](https://apps.apple.com/app/expo-go/id982107779)
  - Android: Download from [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

## Installation

1. Install dependencies:
```bash
npm install
```

or

```bash
yarn install
```

## Running the App

### Start the Expo development server:

```bash
npm start
```

or

```bash
yarn start
```

This will:
- Start the Metro bundler
- Display a QR code in your terminal
- Open Expo DevTools in your browser

### Connect with Expo Go:

1. **On your mobile device:**
   - Open the Expo Go app
   - Tap "Scan QR Code"
   - Scan the QR code displayed in your terminal or browser

2. **Alternative methods:**
   - **iOS**: Use the Camera app to scan the QR code (it will prompt to open in Expo Go)
   - **Android**: Use the Expo Go app's built-in QR scanner

### Platform-specific commands:

- **iOS**: `npm run ios` (requires macOS and Xcode)
- **Android**: `npm run android` (requires Android Studio and emulator setup)
- **Web**: `npm run web`

## Project Structure

```
lushlist-proto/
├── App.js              # Main application component
├── app.json            # Expo configuration
├── package.json        # Dependencies and scripts
├── babel.config.js     # Babel configuration
└── assets/            # Images and other assets
    ├── icon.png
    ├── splash.png
    ├── adaptive-icon.png
    └── favicon.png
```

## Development Tips

- **Hot Reload**: Changes to your code will automatically reload in Expo Go
- **Debugging**: Shake your device or press `Cmd+D` (iOS) / `Cmd+M` (Android) to open the developer menu
- **Logs**: Check the terminal where you ran `npm start` for console logs

## Building for Production

When you're ready to build standalone apps:

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS/Android
eas build --platform ios
eas build --platform android
```

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Go Guide](https://docs.expo.dev/get-started/expo-go/)

## Notes

- This app is configured to work with Expo Go
- Make sure your mobile device and computer are on the same Wi-Fi network
- For testing on physical devices, you may need to use a tunnel connection (Expo will prompt you)

