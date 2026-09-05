import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kyvon.ops',
  appName: 'KyvonOPS',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#090a0f',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#38bdf8',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#090a0f',
    },
  },
};

export default config;
