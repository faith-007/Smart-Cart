/// <reference types="vite/client" />

declare module "*/firebase-applet-config.json" {
  const value: {
    projectId: string;
    appId: string;
    apiKey: string;
    authDomain: string;
    firestoreDatabaseId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    measurementId?: string;
  };
  export default value;
}
