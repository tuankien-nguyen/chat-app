import { Component, model, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Import Socket.io Client
import { io, Socket } from 'socket.io-client';

// Import các linh kiện giao diện của Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';

interface Message {
  sender: string;
  content: string;
  time: string;
}

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatToolbarModule,
    MatDividerModule,
    MatIconModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  username = model('');       
  isLoggedIn = signal(false);  
  currentMessage = model('');

  // Danh sách tin nhắn động (Bắt đầu bằng mảng rỗng)
  messages = signal<Message[]>([]);

  // Biến lưu trữ kết nối Socket
  private socket!: Socket;

  ngOnInit() {
    // 1. Kết nối tới Server Node.js
    this.socket = io('https://tuankien-chat-backend.onrender.com');

    // 2. Lắng nghe tin nhắn từ Server truyền về cho tất cả mọi người
    this.socket.on('receiveMessage', (data: Message) => {
      this.messages.update(prev => [...prev, data]);
    });
  }

  joinRoom() {
    if (this.username().trim() !== '') {
      this.isLoggedIn.set(true); 
    }
  }

  // Gửi tin nhắn lên Server thay vì tự thêm vào mảng local
  sendMessage() {
    const text = this.currentMessage().trim();
    if (text !== '') {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const newMessage: Message = {
        sender: this.username(),
        content: text,
        time: timeStr
      };

      // Bắn tin nhắn lên server thông qua cổng 'sendMessage'
      this.socket.emit('sendMessage', newMessage);

      // Xóa ô nhập liệu
      this.currentMessage.set('');
    }
  }

  logout() {
    this.isLoggedIn.set(false);
    this.username.set('');
  }

  ngOnDestroy() {
    // Ngắt kết nối socket khi component bị hủy để tránh rò rỉ bộ nhớ
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}