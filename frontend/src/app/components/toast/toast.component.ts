import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../services/toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss'
})
export class ToastComponent implements OnInit {
  messages: ToastMessage[] = [];

  constructor(private toast: ToastService) {}

  ngOnInit(): void {
    this.toast.messages.subscribe(m => this.messages = m);
  }

  dismiss(id: string) { this.toast.dismiss(id); }
}
