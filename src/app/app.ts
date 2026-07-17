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

// Định nghĩa cấu trúc cho Cảm xúc tin nhắn
interface Reaction {
  reactor: string;
  emoji: string;
}

// Mở rộng interface Message để hỗ trợ ID và Cảm xúc
interface Message {
  id: string;          // ID duy nhất cho từng tin nhắn để định vị khi thả emoji
  sender?: string;      // Để optional vì tin nhắn hệ thống (isSystem) sẽ không cần sender
  content: string;
  time: string;
  isSystem?: boolean;   // True nếu là tin nhắn hệ thống (vào/ra phòng)
  reactions?: Reaction[]; // Mảng chứa danh sách các cảm xúc của tin nhắn này
  showReactionPicker?: boolean; // Trạng thái ẩn/hiện bảng chọn emoji local
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
  linkOnline = "https://tuankien-chat-backend.onrender.com"
  linkLocal = "http://localhost:3000"
  LINK = this.linkOnline
  username = model('');       
  isLoggedIn = signal(false);  
  currentMessage = model('');

  // Danh sách tin nhắn động (Bắt đầu bằng mảng rỗng)
  messages = signal<Message[]>([]);

  // Tín hiệu lưu danh sách người dùng đang online trong phòng
  usersOnline = signal<string[]>([]);

  // Trạng thái đang gõ chữ
  typingMessage = signal(''); 
  private typingTimeout: any;

  // Danh sách các icon cảm xúc hỗ trợ thả nhanh
  availableEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  // Lấy đối tượng message area từ HTML để xử lý tự động cuộn (Auto-scroll)
  @ViewChild('messageArea') private messageArea!: ElementRef;

  // Biến lưu trữ kết nối Socket
  private socket!: Socket;

  ngOnInit() {
    // 1. Khởi tạo kết nối Socket một lần duy nhất khi Component chạy
    this.socket = io(this.LINK, { autoConnect: true });

    // 2. Đăng ký tất cả các hàm lắng nghe sự kiện từ Server
    this.setupSocketListeners();
  }

  // Tách riêng phần lắng nghe sự kiện để tránh lặp code hoặc mất kết nối
  private setupSocketListeners() {
    // Lắng nghe tin nhắn chat thông thường từ Server truyền về
    this.socket.on('receiveMessage', (data: Message) => {
      this.messages.update(prev => [...prev, data]);
      setTimeout(() => this.scrollToBottom(), 50);
    });

    // LẮNG NGHE TIN NHẮN HỆ THỐNG (VÀO / RA PHÒNG)
    this.socket.on('systemMessage', (data: Message) => {
      this.messages.update(prev => [...prev, data]);
      setTimeout(() => this.scrollToBottom(), 50);
    });

    // LẮNG NGHE DANH SÁCH NGƯỜI ONLINE CẬP NHẬT TỪ SERVER
    this.socket.on('updateUserList', (userList: string[]) => {
      this.usersOnline.set(userList);
    });

    // LẮNG NGHE SỰ KIỆN THẢ ICON CẢM XÚC TIN NHẮN TỪ PHÒNG CHAT
    this.socket.on('receiveReaction', (data: { messageId: string, reactor: string, emoji: string }) => {
      this.messages.update(prevMessages => 
        prevMessages.map(msg => {
          if (msg.id === data.messageId) {
            const currentReactions = msg.reactions || [];
            const filteredReactions = currentReactions.filter(r => r.reactor !== data.reactor);
            return {
              ...msg,
              reactions: [...filteredReactions, { reactor: data.reactor, emoji: data.emoji }]
            };
          }
          return msg;
        })
      );
    });

    // LẮNG NGHE KHI CÓ NGƯỜI KHÁC ĐANG GÕ CHỮ
    this.socket.on('userTyping', (typingUser: string) => {
      this.typingMessage.set(`${typingUser} đang gõ...`);
    });

    // LẮNG NGHE KHI NGƯỜI ĐÓ DỪNG GÕ HOẶC GỬI TIN
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
    if (this.currentMessage().trim() !== '') {
      this.socket.emit('typing', this.username());

      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }

      this.typingTimeout = setTimeout(() => {
        this.socket.emit('stopTyping');
      }, 1500);
    } else {
      this.socket.emit('stopTyping');
    }
  }

  // Đăng nhập vào phòng chat
  joinRoom() {
    if (this.username().trim() !== '') {
      // Đảm bảo socket đã kết nối trước khi gửi sự kiện đăng nhập
      if (!this.socket.connected) {
        this.socket.connect();
      }

      this.isLoggedIn.set(true); 

      // BÁO CHO SERVER BIẾT MÌNH VỪA THAM GIA PHÒNG VỚI USERNAME MỚI
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
      
      const newMessage = {
        sender: this.username(),
        content: text,
        time: timeStr
      };

      this.socket.emit('sendMessage', newMessage);
      this.currentMessage.set('');

      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }
      this.socket.emit('stopTyping');
    }
  }

  // HÀM GỬI LỆNH THẢ CẢM XÚC LÊN SERVER
  reactToMessage(messageId: string, emoji: string) {
    this.socket.emit('sendReaction', {
      messageId: messageId,
      reactor: this.username(),
      emoji: emoji
    });
    this.toggleReactionPicker(messageId, false);
  }

  // BẬT / TẮT POPUP CHỌN EMOJI CỦA TIN NHẮN
  toggleReactionPicker(messageId: string, forceState?: boolean) {
    this.messages.update(prev => 
      prev.map(msg => {
        if (msg.id === messageId) {
          return { ...msg, showReactionPicker: forceState !== undefined ? forceState : !msg.showReactionPicker };
        }
        return { ...msg, showReactionPicker: false };
      })
    );
  }

  // Đăng xuất khỏi phòng chat
  logout() {
    // 1. Chủ động báo ngắt kết nối lên Server (Server tự động xóa user cũ ra khỏi phòng chat)
    this.socket.disconnect();

    // 2. Reset sạch sẽ các trạng thái hiển thị tại Client
    this.isLoggedIn.set(false);
    this.username.set('');
    this.messages.set([]);        // Xóa tin nhắn cũ của phiên làm việc trước
    this.usersOnline.set([]);      // Xóa danh sách online cũ
    this.typingMessage.set('');    // Reset dòng chữ đang gõ

    // 3. Kết nối lại chính đối tượng socket này (Nó vẫn giữ nguyên tất cả sự kiện đã bind)
    // Sẵn sàng kết nối sạch sẽ cho username tiếp theo đăng nhập
    this.socket.connect();
  }

  ngOnDestroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}