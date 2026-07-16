import { Component, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Import các linh kiện giao diện của Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // Dùng model() thay cho signal() để hỗ trợ [(ngModel)] binding 2 chiều từ HTML
  username = model('');       
  
  // Trạng thái ẩn/hiện màn hình chat (chỉ đọc/ghi nội bộ nên dùng signal thuần)
  isLoggedIn = signal(false);  

  // Hàm xử lý khi nhấn nút hoặc bấm Enter
  joinRoom() {
    // Để đọc giá trị của một Signal/Model trong file .ts, ta gọi như một hàm: username()
    if (this.username().trim() !== '') {
      this.isLoggedIn.set(true); // Cập nhật giá trị mới dùng .set()
    }
  }
}