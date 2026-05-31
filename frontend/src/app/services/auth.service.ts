import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, user } from '@angular/fire/auth';
import { from, Observable, BehaviorSubject, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Make Auth optional so the app can run without Firebase configured
  private auth = inject(Auth, { optional: true }) as Auth | undefined;

  user$ = this.auth ? user(this.auth) : of(null);
  private orgIdSubject = new BehaviorSubject<string | null>(null);
  public orgId$ = this.orgIdSubject.asObservable();

  login(email: string, pass: string) {
    if (!this.auth) return from(Promise.reject(new Error('Firebase Auth not configured')));
    return from(signInWithEmailAndPassword(this.auth, email, pass));
  }

  register(email: string, pass: string) {
    if (!this.auth) return from(Promise.reject(new Error('Firebase Auth not configured')));
    return from(createUserWithEmailAndPassword(this.auth, email, pass));
  }

  logout() {
    this.orgIdSubject.next(null);
    if (!this.auth) return from(Promise.resolve<void>(undefined));
    return from(signOut(this.auth));
  }

  async getToken(): Promise<string | null> {
    if (!this.auth) return null;
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      return await currentUser.getIdToken(false);
    }
    return null;
  }

  setOrgId(orgId: string | null): void {
    this.orgIdSubject.next(orgId);
  }

  getOrgId(): string | null {
    return this.orgIdSubject.value;
  }
}