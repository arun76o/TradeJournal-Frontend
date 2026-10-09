// Development environment (used by `ng serve` and `ng build -c development`).
// The production build swaps this file for environment.prod.ts via the
// "fileReplacements" entry of the production configuration in angular.json,
// so production always talks to the deployed Render API.
export const environment = {
  production: false,
  // apiUrl: 'https://tradejournal-api-bomp.onrender.com/api',
  apiUrl: 'https://localhost:7265/api',
  firebase: {
    apiKey: 'AIzaSyCtfznyQQm2TGWEIjj0cc9KewPMVMStPEk',
    authDomain: 'tradejournal-5d4cf.firebaseapp.com',
    projectId: 'tradejournal-5d4cf',
    storageBucket: 'tradejournal-5d4cf.firebasestorage.app',
    messagingSenderId: '431636816183',
    appId: '1:431636816183:web:c12995360d8ad2f0aabab2'
  },
};
