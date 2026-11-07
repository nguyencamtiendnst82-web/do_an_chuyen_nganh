-- Migration: tạo bảng notifications
CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,  -- khớp kiểu với users.id (INT, không UNSIGNED)
  type ENUM('appointment_confirmed','appointment_cancelled','new_invoice') NOT NULL,
  payload JSON NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;