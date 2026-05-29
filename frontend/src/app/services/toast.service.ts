import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toasts$ = new BehaviorSubject<ToastMessage[]>([]);

  get messages() {
    return this.toasts$.asObservable();
  }

  push(text: string, type: 'info' | 'success' | 'error' = 'info', timeout = 4000) {
    const id = Math.random().toString(36).slice(2, 9);
    const msg: ToastMessage = { id, text, type };
    const current = this.toasts$.value.slice();
    current.push(msg);
    this.toasts$.next(current);
    if (timeout > 0) setTimeout(() => this.dismiss(id), timeout);
  }

  dismiss(id: string) {
    const filtered = this.toasts$.value.filter(t => t.id !== id);
    this.toasts$.next(filtered);
  }
}
