export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

// Bezpečné výchozí hodnoty pro veřejný repozitář.
// Skutečné hodnoty doplň přes GitHub Secrets/Variables nebo lokální .env.
export const firebaseConfig: FirebaseWebConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};
