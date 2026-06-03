import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService implements OnDestroy {
  private readonly prefKey = 'themeMode';
  private readonly legacyKey = 'darkMode';
  private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly onSystemChange = () => {
    if (this.modeSubject.value === 'system') {
      this.applyTheme('system');
    }
  };

  private readonly modeSubject = new BehaviorSubject<ThemeMode>('system');
  readonly mode$ = this.modeSubject.asObservable();

  constructor() {
    this.initFromStorage();
    this.mediaQuery.addEventListener('change', this.onSystemChange);
  }

  ngOnDestroy() {
    this.mediaQuery.removeEventListener('change', this.onSystemChange);
  }

  get mode(): ThemeMode {
    return this.modeSubject.value;
  }

  get isDark(): boolean {
    return this.resolveDark(this.modeSubject.value);
  }

  initFromStorage() {
    try {
      const stored = localStorage.getItem(this.prefKey) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        this.setMode(stored, false);
        return;
      }

      const legacy = localStorage.getItem(this.legacyKey);
      if (legacy === 'true') {
        this.setMode('dark', false);
      } else if (legacy === 'false') {
        this.setMode('light', false);
      } else {
        this.setMode('system', false);
      }
    } catch {
      this.setMode('system', false);
    }
  }

  setMode(mode: ThemeMode, persist = true) {
    this.modeSubject.next(mode);
    this.applyTheme(mode);

    if (!persist) {
      return;
    }

    try {
      localStorage.setItem(this.prefKey, mode);
      localStorage.setItem(this.legacyKey, String(this.resolveDark(mode)));
    } catch {
      // ignore storage errors
    }
  }

  toggleLightDark() {
    this.setMode(this.isDark ? 'light' : 'dark');
  }

  private resolveDark(mode: ThemeMode): boolean {
    if (mode === 'dark') {
      return true;
    }
    if (mode === 'light') {
      return false;
    }
    return this.mediaQuery.matches;
  }

  private applyTheme(mode: ThemeMode) {
    document.documentElement.classList.toggle('dark', this.resolveDark(mode));
  }
}
