import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AgentStreamService {
  public messages$ = new Subject<any>();
  private ws!: WebSocket;

  connect(taskId: string): void {
    this.ws = new WebSocket(`ws://127.0.0.1:8000/agents/ws/${taskId}`);
    
    this.ws.onmessage = (event) => {
      this.messages$.next(JSON.parse(event.data));
    };
    
    this.ws.onerror = (error) => {
      console.error('Stream error:', error);
      this.messages$.next({ status: 'error', message: 'WebSocket connection failed.' });
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket closed for task:', taskId);
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}