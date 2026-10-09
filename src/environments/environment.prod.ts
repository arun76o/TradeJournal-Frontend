// Production build environment.
// apiUrl is the deployed Render API (taken from the reference in environment.ts).
// This file is swapped in by the "fileReplacements" entry of the production
// configuration in angular.json - the development file keeps pointing at localhost.
export const environment = {
  production: true,
  apiUrl: 'https://tradejournal-api-bomp.onrender.com/api',
  firebase: {
    apiKey: 'AIzaSyCtfznyQQm2TGWEIjj0cc9KewPMVMStPEk',
    authDomain: 'tradejournal-5d4cf.firebaseapp.com',
    projectId: 'tradejournal-5d4cf',
    storageBucket: 'tradejournal-5d4cf.firebasestorage.app',
    messagingSenderId: '431636816183',
    appId: '1:431636816183:web:c12995360d8ad2f0aabab2',
  },
};
