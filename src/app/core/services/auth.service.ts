import { Injectable, inject } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private auth = inject(Auth);

  login(email: string, password: string) {
    return signInWithEmailAndPassword( this.auth, email, password );
  }

  register(email: string, password: string) {
    return createUserWithEmailAndPassword(
      this.auth,
      email,
      password
    );
  }

  // googleLogin() {
  //   return signInWithPopup(
  //     this.auth,
  //     new GoogleAuthProvider()
  //   );
  // }

  googleLogin() {
  const provider = new GoogleAuthProvider();

  provider.addScope('email');
  provider.addScope('profile');

  provider.setCustomParameters({
    prompt: 'select_account'
  });

  return signInWithPopup(this.auth, provider);
}

  logout() {
    return signOut(this.auth);
  }
}