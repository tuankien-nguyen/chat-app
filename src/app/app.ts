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

  // --- THÊM CÁC BIẾN CHO TRẠNG THÁI GÕ CHỮ ---
  typingMessage = signal(''); 
  private typingTimeout: any;

  // Biến lưu trữ kết nối Socket
  private socket!: Socket;

  ngOnInit() {
    // 1. Kết nối tới Server Node.js
    this.socket = io('https://tuankien-chat-backend.onrender.com');

    // 2. Lắng nghe tin nhắn từ Server truyền về cho tất cả mọi người
    this.socket.on('receiveMessage', (data: Message) => {
      this.messages.update(prev => [...prev, data]);
    });

    // 3. LẮNG NGHE KHI CÓ NGƯỜI KHÁC ĐANG GÕ CHỮ
    this.socket.on('userTyping', (typingUser: string) => {
      this.typingMessage.set(`${typingUser} đang gõ...`);
    });

    // 4. LẮNG NGHE KHI NGƯỜI ĐÓ DỪNG GÕ HOẶC GỬI TIN
    this.socket.on('userStopTyping', () => {
      this.typingMessage.set('');
    });
  }

  // HÀM GỬI TÍN HIỆU ĐANG GÕ CHỮ LÊN SERVER
  onInputChange() {
    // Chỉ gửi tín hiệu khi người dùng thực sự có gõ chữ
    if (this.currentMessage().trim() !== '') {
      this.socket.emit('typing', this.username());

      // Xoá bộ đếm thời gian cũ
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }

      // Đặt bộ đếm 1.5 giây: Nếu dừng gõ 1.5s thì gửi sự kiện ngưng gõ lên server
      this.typingTimeout = setTimeout(() => {
        this.socket.emit('stopTyping');
      }, 1500);
    } else {
      // Nếu xoá sạch kí tự trong ô input, lập tức báo dừng gõ luôn
      this.socket.emit('stopTyping');
    }
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

      // Ngắt trạng thái gõ và báo ngay cho server
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }
      this.socket.emit('stopTyping');
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