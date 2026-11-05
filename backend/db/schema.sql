-- Campus Resource Sharing Platform - schema
-- Applied by `npm run db:setup` (drops and recreates every table).

CREATE DATABASE IF NOT EXISTS campus_resource_sharing
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campus_resource_sharing;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS wishlist;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS borrow_requests;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  college_id VARCHAR(50),
  department VARCHAR(100),
  bio VARCHAR(500),
  role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  profile_image VARCHAR(255),
  -- deposit balance: money topped up (or earned) and not yet spent or held
  wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_verified (is_verified)
) ENGINE=InnoDB;

CREATE TABLE categories (
  slug VARCHAR(40) PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  icon VARCHAR(40) NOT NULL,
  color VARCHAR(9) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(40) NOT NULL,
  condition_status ENUM('new', 'like_new', 'good', 'fair') NOT NULL DEFAULT 'good',
  location VARCHAR(150),
  max_borrow_days INT NOT NULL DEFAULT 7,
  price_per_day DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- refundable security deposit the borrower puts down; returned when the owner confirms the return
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url VARCHAR(255),
  -- reserved = request accepted, waiting for the owner to release; borrowed = released to the borrower
  availability_status ENUM('available', 'reserved', 'borrowed', 'unavailable') NOT NULL DEFAULT 'available',
  views INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category) REFERENCES categories(slug),
  INDEX idx_res_category (category),
  INDEX idx_res_status (availability_status),
  INDEX idx_res_owner (owner_id)
) ENGINE=InnoDB;

CREATE TABLE borrow_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resource_id INT NOT NULL,
  borrower_id INT NOT NULL,
  owner_id INT NOT NULL,
  request_message TEXT,
  -- pending -> accepted -> borrowed (released) -> returned. Fee + deposit are held from the borrower's balance when requesting.
  status ENUM('pending', 'accepted', 'borrowed', 'rejected', 'returned', 'cancelled') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  borrow_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- fee_status: held -> paid to the owner on release (or refunded if rejected/cancelled)
  fee_status ENUM('none', 'held', 'paid', 'refunded') NOT NULL DEFAULT 'none',
  -- deposit_status: held until the owner confirms the return (or refunded if rejected/cancelled)
  deposit_status ENUM('none', 'held', 'refunded') NOT NULL DEFAULT 'none',
  released_at TIMESTAMP NULL,
  returned_at TIMESTAMP NULL,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_br_status (status),
  INDEX idx_br_borrower (borrower_id),
  INDEX idx_br_owner (owner_id),
  INDEX idx_br_resource (resource_id)
) ENGINE=InnoDB;

CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  borrow_request_id INT NOT NULL,
  reviewer_id INT NOT NULL,
  reviewee_id INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (borrow_request_id) REFERENCES borrow_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_review (borrow_request_id, reviewer_id),
  INDEX idx_rev_reviewee (reviewee_id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  message VARCHAR(500) NOT NULL,
  link VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB;

CREATE TABLE wishlist (
  user_id INT NOT NULL,
  resource_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, resource_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  borrow_request_id INT NOT NULL,
  sender_id INT NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (borrow_request_id) REFERENCES borrow_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_msg_request (borrow_request_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id INT NOT NULL,
  resource_id INT NOT NULL,
  reason VARCHAR(60) NOT NULL,
  details VARCHAR(1000),
  status ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  INDEX idx_rep_status (status)
) ENGINE=InnoDB;

CREATE TABLE wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  borrow_request_id INT NULL,
  -- deposit = user topped up; hold = fee/deposit set aside for a request; refund = held money returned;
  -- earning = rental fee received by the owner
  type ENUM('deposit', 'hold', 'refund', 'earning') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,           -- signed: negative when money leaves the balance
  balance_after DECIMAL(12,2) NOT NULL,
  note VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (borrow_request_id) REFERENCES borrow_requests(id) ON DELETE SET NULL,
  INDEX idx_wt_user (user_id, created_at),
  INDEX idx_wt_request (borrow_request_id)
) ENGINE=InnoDB;
