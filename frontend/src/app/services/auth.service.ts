import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, user } from '@angular/fire/auth';
import { from, Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  
  user$ = user(this.auth);
  private orgIdSubject = new BehaviorSubject<string | null>(null);
  public orgId$ = this.orgIdSubject.asObservable();

  login(email: string, pass: string) {
    return from(signInWithEmailAndPassword(this.auth, email, pass));
  }

  register(email: string, pass: string) {
    return from(createUserWithEmailAndPassword(this.auth, email, pass));
  }

  logout() {
    this.orgIdSubject.next(null);
    return from(signOut(this.auth));
  }

  async getToken(): Promise<string | null> {
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