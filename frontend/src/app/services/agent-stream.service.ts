import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment.prod';

@Injectable({
  providedIn: 'root'
})
export class AgentStreamService {
  public messages$ = new Subject<any>();
  private ws!: WebSocket;

  connect(taskId: string): void {
    const wsUrl = environment.apiUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');

    this.ws = new WebSocket(`${wsUrl}/agents/ws/${taskId}`)

    this.ws.onopen = () => {
      this.messages$.next({ status: 'connected', task_id: taskId });
    };

    this.ws.onmessage = (event) => {
      try {
        this.messages$.next(JSON.parse(event.data));
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Stream error:', error);
      this.messages$.next({ status: 'error', message: 'WebSocket connection failed.' });
    };

    this.ws.onclose = (ev) => {
      console.log('WebSocket closed for task:', taskId, ev);
      this.messages$.next({ status: 'closed', task_id: taskId });
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}