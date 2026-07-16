import { Component, model, signal, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
  sender?: string;      // Để optional vì tin nhắn hệ thống (isSystem) sẽ không cần sender
  content: string;
  time: string;
  isSystem?: boolean;   // True nếu là tin nhắn hệ thống (vào/ra phòng)
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

  // Trạng thái đang gõ chữ
  typingMessage = signal(''); 
  private typingTimeout: any;

  // Lấy đối tượng message area từ HTML để xử lý tự động cuộn (Auto-scroll)
  @ViewChild('messageArea') private messageArea!: ElementRef;

  // Biến lưu trữ kết nối Socket
  private socket!: Socket;

  ngOnInit() {
    // 1. Kết nối tới Server Node.js (Render)
    this.socket = io('https://tuankien-chat-backend.onrender.com');

    // 2. Lắng nghe tin nhắn chat thông thường từ Server truyền về
    this.socket.on('receiveMessage', (data: Message) => {
      this.messages.update(prev => [...prev, data]);
      // Chờ giao diện render tin nhắn mới xong thì cuộn xuống
      setTimeout(() => this.scrollToBottom(), 50);
    });

    // 3. LẮNG NGHE TIN NHẮN HỆ THỐNG (VÀO / RA PHÒNG)
    this.socket.on('systemMessage', (data: Message) => {
      this.messages.update(prev => [...prev, data]);
      setTimeout(() => this.scrollToBottom(), 50);
    });

    // 4. LẮNG NGHE KHI CÓ NGƯỜI KHÁC ĐANG GÕ CHỮ
    this.socket.on('userTyping', (typingUser: string) => {
      this.typingMessage.set(`${typingUser} đang gõ...`);
    });

    // 5. LẮNG NGHE KHI NGƯỜI ĐÓ DỪNG GÕ HOẶC GỬI TIN
    this.socket.on('userStopTyping', () => {
      this.typingMessage.set('');
    });
  }

  // HÀM TỰ ĐỘNG CUỘN KHUNG CHAT XUỐNG DƯỚI CÙNG
  private scrollToBottom(): void {
    try {
      if (this.messageArea) {
        this.messageArea.nativeElement.scrollTop = this.messageArea.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Lỗi cuộn tin nhắn:', err);
    }
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

  // Đăng nhập vào phòng chat
  joinRoom() {
    if (this.username().trim() !== '') {
      this.isLoggedIn.set(true); 

      // BÁO CHO SERVER BIẾT MÌNH VỪA THAM GIA PHÒNG
      this.socket.emit('userJoin', this.username());

      // Cuộn xuống dưới cùng khi vừa vào phòng
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  // Gửi tin nhắn lên Server
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

      // Ngắt trạng thái gõ và báo ngay cho server dừng gõ
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }
      this.socket.emit('stopTyping');
    }
  }

  // Đăng xuất khỏi phòng chat
  logout() {
    // Ngắt kết nối socket để kích hoạt sự kiện disconnect trên server (báo rời phòng)
    this.socket.disconnect();

    this.isLoggedIn.set(false);
    this.username.set('');

    // Kết nối lại socket mới để chuẩn bị cho lượt đăng nhập tiếp theo
    this.socket = io('https://tuankien-chat-backend.onrender.com');
  }

  ngOnDestroy() {
    // Ngắt kết nối socket khi component bị hủy để tránh rò rỉ bộ nhớ
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}