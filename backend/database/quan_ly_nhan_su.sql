-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: quan_ly_nhan_su
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `cham_cong`
--

DROP TABLE IF EXISTS `cham_cong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cham_cong` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nhan_vien_id` int DEFAULT NULL,
  `ngay_lam` date DEFAULT NULL,
  `gio_vao` time DEFAULT NULL,
  `gio_ra` time DEFAULT NULL,
  `trang_thai` enum('di_lam','di_muon','ve_som','di_muon_ve_som','nghi_phep','vang_khong_phep','ngay_le') NOT NULL DEFAULT 'di_lam',
  `ghi_chu` varchar(255) DEFAULT NULL,
  `tong_gio` float DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_nv_ngay` (`nhan_vien_id`,`ngay_lam`),
  CONSTRAINT `fk_cc_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=76 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cham_cong`
--

LOCK TABLES `cham_cong` WRITE;
/*!40000 ALTER TABLE `cham_cong` DISABLE KEYS */;
INSERT INTO `cham_cong` VALUES (34,30,'2025-10-16','08:10:00','16:00:00','di_lam','Đi muộn ≤10p, Về sớm ≤60p',6.83333),(35,31,'2025-10-16','09:13:00','17:05:00','di_muon','Đi muộn >60p',6.86667),(36,32,'2025-10-16','08:16:00','18:10:00','di_lam','Đi muộn ≤30p, Tăng ca 0.90h (x1.5)',8.9),(37,33,'2025-10-16','09:19:00','16:15:00','di_muon','Đi muộn >60p, Về sớm ≤60p',5.93333),(38,34,'2025-10-16','08:22:00','17:20:00','di_lam','Đi muộn ≤30p',7.96667),(39,35,'2025-10-16','09:25:00','18:25:00','di_muon','Đi muộn >60p',8),(40,30,'2025-10-17','08:10:00','16:00:00','di_lam','Đi muộn ≤10p, Về sớm ≤60p',6.83333),(41,31,'2025-10-17','09:13:00','17:05:00','di_muon','Đi muộn >60p',6.86667),(42,32,'2025-10-17','08:16:00','18:10:00','di_lam','Đi muộn ≤30p, Tăng ca 0.90h (x1.5)',8.9),(43,33,'2025-10-17',NULL,NULL,'vang_khong_phep','Vắng không phép',0),(44,34,'2025-10-17','08:22:00','17:20:00','di_lam','Đi muộn ≤30p',7.96667),(45,35,'2025-10-17','09:25:00','18:25:00','di_muon','Đi muộn >60p',8),(46,30,'2025-10-18','08:10:00','16:00:00','di_lam','Ngày lễ',6.83333),(47,31,'2025-10-18','09:13:00','17:05:00','di_lam','Ngày lễ',6.86667),(48,32,'2025-10-18','08:16:00','18:10:00','di_lam','Ngày lễ',8.9),(49,33,'2025-10-18','09:19:00','16:15:00','di_lam','Ngày lễ',5.93333),(50,34,'2025-10-18','08:22:00','17:20:00','di_lam','Ngày lễ',7.96667),(51,35,'2025-10-18','09:25:00','18:25:00','di_lam','Ngày lễ',8),(52,30,'2025-10-19','08:10:00','16:00:00','di_lam','Ngày lễ',6.83333),(53,31,'2025-10-19','09:13:00','17:05:00','di_lam','Ngày lễ',6.86667),(54,32,'2025-10-19','08:16:00','18:10:00','di_lam','Ngày lễ',8.9),(55,33,'2025-10-19','09:19:00','16:15:00','di_lam','Ngày lễ',5.93333),(56,34,'2025-10-19','08:22:00','17:20:00','di_lam','Ngày lễ',7.96667),(57,35,'2025-10-19','09:25:00','18:25:00','di_lam','Ngày lễ',8),(70,30,'2025-11-02','08:10:00','16:00:00','di_lam','Làm bù (ngày nghỉ), Đi muộn ≤10p, Về sớm ≤60p',6.83333),(71,31,'2025-11-02','09:13:00','17:05:00','di_muon','Làm bù (ngày nghỉ), Đi muộn >60p',6.86667),(72,32,'2025-11-02','08:16:00','18:10:00','di_lam','Làm bù (ngày nghỉ), Đi muộn ≤30p, Tăng ca 0.90h (x1.0)',8.9),(73,33,'2025-11-02',NULL,NULL,'vang_khong_phep','Vắng không phép',0),(74,34,'2025-11-02','08:22:00','17:20:00','di_lam','Làm bù (ngày nghỉ), Đi muộn ≤30p',7.96667),(75,35,'2025-11-02','09:25:00','18:25:00','di_muon','Làm bù (ngày nghỉ), Đi muộn >60p',8);
/*!40000 ALTER TABLE `cham_cong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chuc_vu`
--

DROP TABLE IF EXISTS `chuc_vu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chuc_vu` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ten_chuc_vu` varchar(100) NOT NULL,
  `mo_ta` text,
  `quyen_mac_dinh` enum('admin','manager','employee') DEFAULT 'employee',
  `muc_luong_co_ban` decimal(15,2) DEFAULT '0.00',
  `phong_ban_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_chucvu_phongban` (`phong_ban_id`),
  CONSTRAINT `fk_chucvu_phongban` FOREIGN KEY (`phong_ban_id`) REFERENCES `phong_ban` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chuc_vu`
--

LOCK TABLES `chuc_vu` WRITE;
/*!40000 ALTER TABLE `chuc_vu` DISABLE KEYS */;
INSERT INTO `chuc_vu` VALUES (7,'Giám đốc','Điều hành toàn bộ công ty','admin',18000000.00,NULL),(8,'Kế toán / Nhân sự','Chấm công, tính lương, quản lý hồ sơ nhân viên','manager',12000000.00,5),(9,'Trưởng phòng kỹ thuật','Quản lý nhân viên kỹ thuật','manager',12000000.00,6),(10,'Trưởng phòng kinh doanh','Quản lý đội ngũ kinh doanh','manager',12000000.00,7),(11,'Nhân viên kỹ thuật','Thực hiện công việc kỹ thuật','employee',8000000.00,6),(12,'Nhân viên kinh doanh','Bán hàng, chăm sóc khách hàng','employee',8000000.00,7);
/*!40000 ALTER TABLE `chuc_vu` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hop_dong`
--

DROP TABLE IF EXISTS `hop_dong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hop_dong` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nhan_vien_id` int DEFAULT NULL,
  `loai_hop_dong` enum('Thử việc','Xác định thời hạn','Không xác định thời hạn') NOT NULL,
  `ngay_bat_dau` date NOT NULL,
  `ngay_ket_thuc` date DEFAULT NULL,
  `luong_thoa_thuan` decimal(15,2) NOT NULL COMMENT 'Lương thỏa thuận (P1 - Gross)',
  `trang_thai` enum('con_hieu_luc','het_han','da_cham_dut') DEFAULT 'con_hieu_luc',
  `file_hop_dong` varchar(255) DEFAULT NULL,
  `ghi_chu` text,
  `so_hop_dong` varchar(50) NOT NULL,
  `ngay_ky` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_hd_nv` (`nhan_vien_id`),
  CONSTRAINT `fk_hd_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hop_dong`
--

LOCK TABLES `hop_dong` WRITE;
/*!40000 ALTER TABLE `hop_dong` DISABLE KEYS */;
INSERT INTO `hop_dong` VALUES (7,30,'Không xác định thời hạn','2025-01-01',NULL,18000000.00,'con_hieu_luc','/uploads/HD-GD-2025-001.pdf','Giám đốc điều hành toàn công ty','HD-GD-2025-001','2025-01-01'),(8,31,'Xác định thời hạn','2025-01-02','2026-01-02',12000000.00,'con_hieu_luc','/uploads/HD-KT-2025-001.pdf','Phụ trách chấm công và tính lương','HD-KT-2025-001','2025-01-02'),(9,32,'Xác định thời hạn','2025-01-03','2026-01-03',12000000.00,'con_hieu_luc','/uploads/HD-KTKT-2025-001.pdf','Quản lý đội ngũ kỹ thuật viên','HD-KTKT-2025-001','2025-01-03'),(10,33,'Xác định thời hạn','2025-01-03','2026-01-03',12000000.00,'con_hieu_luc','/uploads/HD-KD-2025-001.pdf','Quản lý nhân viên kinh doanh','HD-KD-2025-001','2025-01-03'),(11,34,'Thử việc','2025-01-04',NULL,8000000.00,'het_han',NULL,'Thử việc kỹ thuật viên','HD-NVKT-2025-001','2025-01-04'),(12,35,'Thử việc','2025-01-01','2025-03-01',4000000.00,'het_han',NULL,'Thử việc nhân viên kinh doanh','HD-NVKD-2025-001','2025-01-01'),(13,39,'Thử việc','2025-10-30','2026-11-30',5000000.00,'con_hieu_luc',NULL,NULL,'HD-2025-001','2025-10-29'),(14,34,'Xác định thời hạn','2025-11-22','2026-11-04',5000000.00,'con_hieu_luc',NULL,NULL,'HD-2025-002','2025-11-04'),(15,35,'Xác định thời hạn','2025-11-04','2027-11-04',7000000.00,'con_hieu_luc',NULL,'','HD-2025-002','2025-11-02');
/*!40000 ALTER TABLE `hop_dong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knex_migrations`
--

DROP TABLE IF EXISTS `knex_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knex_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `batch` int DEFAULT NULL,
  `migration_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knex_migrations`
--

LOCK TABLES `knex_migrations` WRITE;
/*!40000 ALTER TABLE `knex_migrations` DISABLE KEYS */;
/*!40000 ALTER TABLE `knex_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knex_migrations_lock`
--

DROP TABLE IF EXISTS `knex_migrations_lock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knex_migrations_lock` (
  `index` int unsigned NOT NULL AUTO_INCREMENT,
  `is_locked` int DEFAULT NULL,
  PRIMARY KEY (`index`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knex_migrations_lock`
--

LOCK TABLES `knex_migrations_lock` WRITE;
/*!40000 ALTER TABLE `knex_migrations_lock` DISABLE KEYS */;
INSERT INTO `knex_migrations_lock` VALUES (1,0);
/*!40000 ALTER TABLE `knex_migrations_lock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lich_su_tra_luong`
--

DROP TABLE IF EXISTS `lich_su_tra_luong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lich_su_tra_luong` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nhan_vien_id` int DEFAULT NULL,
  `thang` int DEFAULT NULL,
  `nam` int DEFAULT NULL,
  `so_tien_thuc_tra` decimal(15,2) DEFAULT NULL,
  `ngay_tra` date DEFAULT NULL,
  `nguoi_thuc_hien_id` int DEFAULT NULL,
  `trang_thai` enum('cho_xu_ly','da_thanh_toan','that_bai','con_no') NOT NULL DEFAULT 'cho_xu_ly',
  `ghi_chu` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_lstrl_user` (`nguoi_thuc_hien_id`),
  KEY `fk_lich_su_tra_luong_nhanvien` (`nhan_vien_id`),
  CONSTRAINT `fk_lich_su_tra_luong_nguoi_thuc_hien` FOREIGN KEY (`nguoi_thuc_hien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_lich_su_tra_luong_nhanvien` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lich_su_tra_luong`
--

LOCK TABLES `lich_su_tra_luong` WRITE;
/*!40000 ALTER TABLE `lich_su_tra_luong` DISABLE KEYS */;
INSERT INTO `lich_su_tra_luong` VALUES (49,30,10,2025,NULL,NULL,30,'cho_xu_ly','Duyệt lương tháng 10/2025','2025-11-18 02:16:48','2025-11-18 02:16:48'),(50,31,10,2025,NULL,NULL,30,'cho_xu_ly','Duyệt lương tháng 10/2025','2025-11-18 02:16:48','2025-11-18 02:16:48'),(51,32,10,2025,NULL,NULL,30,'cho_xu_ly','Duyệt lương tháng 10/2025','2025-11-18 02:16:48','2025-11-18 02:16:48'),(52,33,10,2025,NULL,NULL,30,'cho_xu_ly','Duyệt lương tháng 10/2025','2025-11-18 02:16:48','2025-11-18 02:16:48'),(53,39,10,2025,NULL,NULL,30,'cho_xu_ly','Duyệt lương tháng 10/2025','2025-11-18 02:16:48','2025-11-18 02:16:48'),(54,34,10,2025,NULL,NULL,30,'cho_xu_ly','Duyệt lương tháng 10/2025','2025-11-18 02:16:48','2025-11-18 02:16:48'),(55,35,10,2025,NULL,NULL,30,'cho_xu_ly','Duyệt lương tháng 10/2025','2025-11-18 02:16:48','2025-11-18 02:16:48'),(56,35,10,2025,3576923.08,'2025-11-18',30,'da_thanh_toan',NULL,'2025-11-18 02:17:29','2025-11-18 02:17:29'),(57,30,10,2025,4000000.00,'2025-11-18',30,'con_no',NULL,'2025-11-18 02:18:30','2025-11-18 02:18:30'),(58,30,10,2025,2000000.00,'2025-11-18',30,'con_no',NULL,'2025-11-18 02:19:25','2025-11-18 02:19:25'),(59,30,10,2025,1007884.62,'2025-11-18',30,'con_no',NULL,'2025-11-18 02:19:39','2025-11-18 02:19:39'),(60,39,10,2025,200000.00,'2025-11-18',30,'con_no',NULL,'2025-11-18 02:31:26','2025-11-18 02:31:26'),(61,39,10,2025,200000.00,'2025-11-18',30,'con_no',NULL,'2025-11-18 02:31:40','2025-11-18 02:31:40'),(62,39,10,2025,200000.00,'2025-11-18',30,'da_thanh_toan',NULL,'2025-11-18 02:31:57','2025-11-18 02:31:57'),(63,32,10,2025,3000000.00,'2025-11-18',30,'con_no',NULL,'2025-11-18 02:34:25','2025-11-18 02:34:25'),(64,32,10,2025,2544230.77,'2025-11-18',30,'da_thanh_toan',NULL,'2025-11-18 02:34:33','2025-11-18 02:34:33'),(65,34,10,2025,2826442.31,'2025-11-18',30,'da_thanh_toan',NULL,'2025-11-18 03:30:49','2025-11-18 03:30:49');
/*!40000 ALTER TABLE `lich_su_tra_luong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `luong`
--

DROP TABLE IF EXISTS `luong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `luong` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nhan_vien_id` int DEFAULT NULL,
  `luong_thoa_thuan` decimal(15,2) NOT NULL COMMENT 'Lương thỏa thuận (P1 - Gross)',
  `luong_p2` decimal(15,2) DEFAULT '0.00',
  `luong_p3` decimal(15,2) DEFAULT '0.00',
  `luong_p1` decimal(15,2) DEFAULT '0.00',
  `thang` int DEFAULT NULL,
  `nam` int DEFAULT NULL,
  `ngay_cong` decimal(5,2) DEFAULT '0.00',
  `ngay_cong_lam` decimal(6,2) DEFAULT '0.00',
  `so_ngay_le` decimal(6,2) DEFAULT '0.00',
  `gio_tang_ca` decimal(6,2) DEFAULT '0.00',
  `ngay_tinh` date DEFAULT NULL,
  `tong_luong` decimal(15,2) DEFAULT '0.00' COMMENT 'Tổng lương gross (chưa trừ bảo hiểm, thuế)',
  `bhxh` decimal(15,2) DEFAULT '0.00' COMMENT 'Bảo hiểm xã hội (8%)',
  `bhyt` decimal(15,2) DEFAULT '0.00' COMMENT 'Bảo hiểm y tế (1.5%)',
  `bhtn` decimal(15,2) DEFAULT '0.00' COMMENT 'Bảo hiểm thất nghiệp (1%)',
  `tong_bh` decimal(15,2) DEFAULT '0.00' COMMENT 'Tổng bảo hiểm (BHXH+BHYT+BHTN)',
  `thue_tncn` decimal(15,2) DEFAULT '0.00' COMMENT 'Thuế thu nhập cá nhân',
  `luong_thuc_nhan` decimal(15,2) DEFAULT '0.00' COMMENT 'Lương thực nhận (Net, sau thuế và bảo hiểm)',
  `lich_su_tra_luong_id` int DEFAULT NULL,
  `trang_thai_duyet` enum('chua_duyet','da_duyet') DEFAULT 'chua_duyet',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_luong_unique` (`nhan_vien_id`,`thang`,`nam`),
  KEY `idx_luong_nhanvien` (`nhan_vien_id`),
  KEY `fk_luong_lich_su` (`lich_su_tra_luong_id`),
  CONSTRAINT `fk_luong_lich_su` FOREIGN KEY (`lich_su_tra_luong_id`) REFERENCES `lich_su_tra_luong` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_luong_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=148 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `luong`
--

LOCK TABLES `luong` WRITE;
/*!40000 ALTER TABLE `luong` DISABLE KEYS */;
INSERT INTO `luong` VALUES (70,30,18000000.00,0.00,0.00,692307.69,11,2025,1.00,0.85,0.00,0.00,'2025-11-17',692307.69,0.00,0.00,0.00,0.00,0.00,692307.69,NULL,'chua_duyet'),(71,31,12000000.00,0.00,0.00,461538.46,11,2025,1.00,0.86,0.00,0.00,'2025-11-17',461538.46,0.00,0.00,0.00,0.00,0.00,461538.46,NULL,'chua_duyet'),(72,32,12000000.00,0.00,77884.62,461538.46,11,2025,1.00,1.11,0.00,1.35,'2025-11-17',539423.08,0.00,0.00,0.00,0.00,0.00,539423.08,NULL,'chua_duyet'),(73,33,12000000.00,0.00,0.00,0.00,11,2025,0.00,0.00,0.00,0.00,'2025-11-17',0.00,0.00,0.00,0.00,0.00,0.00,0.00,NULL,'chua_duyet'),(74,39,5000000.00,600000.00,0.00,0.00,11,2025,0.00,0.00,0.00,0.00,'2025-11-17',600000.00,0.00,0.00,0.00,0.00,0.00,600000.00,NULL,'chua_duyet'),(80,30,18000000.00,0.00,3546346.15,3461538.46,10,2025,2.00,3.42,3.00,40.98,'2025-11-17',7007884.62,0.00,0.00,0.00,0.00,0.00,7007884.62,NULL,'da_duyet'),(81,31,12000000.00,0.00,2378076.92,2307692.31,10,2025,2.00,3.44,3.00,41.22,'2025-11-17',4685769.23,0.00,0.00,0.00,0.00,0.00,4685769.23,NULL,'da_duyet'),(82,32,12000000.00,0.00,3236538.46,2307692.31,10,2025,2.00,4.45,3.00,56.10,'2025-11-17',5544230.77,0.00,0.00,0.00,0.00,0.00,5544230.77,NULL,'da_duyet'),(83,33,12000000.00,0.00,2052692.31,1846153.85,10,2025,1.00,2.22,3.00,35.58,'2025-11-17',3898846.15,0.00,0.00,0.00,0.00,0.00,3898846.15,NULL,'da_duyet'),(84,39,5000000.00,600000.00,0.00,0.00,10,2025,0.00,0.00,0.00,0.00,'2025-11-17',600000.00,0.00,0.00,0.00,0.00,0.00,600000.00,NULL,'da_duyet'),(90,34,5000000.00,715384.62,1149519.23,961538.46,10,2025,2.00,3.99,3.00,47.82,'2025-11-17',2826442.31,0.00,0.00,0.00,0.00,0.00,2826442.31,NULL,'da_duyet'),(91,35,7000000.00,615384.62,1615384.62,1346153.85,10,2025,2.00,4.00,3.00,48.00,'2025-11-17',3576923.08,0.00,0.00,0.00,0.00,0.00,3576923.08,NULL,'da_duyet'),(132,34,5000000.00,707692.31,0.00,192307.69,11,2025,1.00,1.00,0.00,0.00,'2025-11-17',900000.00,0.00,0.00,0.00,0.00,0.00,900000.00,NULL,'chua_duyet'),(133,35,7000000.00,607692.31,0.00,269230.77,11,2025,1.00,1.00,0.00,0.00,'2025-11-17',876923.08,0.00,0.00,0.00,0.00,0.00,876923.08,NULL,'chua_duyet');
/*!40000 ALTER TABLE `luong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ngay_le`
--

DROP TABLE IF EXISTS `ngay_le`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ngay_le` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ngay` date NOT NULL,
  `ten_ngay` varchar(255) NOT NULL,
  `loai` enum('le','tet','cuoi_tuan','lam_bu') DEFAULT 'le',
  `mo_ta` text,
  `so_ngay_nghi` int DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ngay` (`ngay`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ngay_le`
--

LOCK TABLES `ngay_le` WRITE;
/*!40000 ALTER TABLE `ngay_le` DISABLE KEYS */;
INSERT INTO `ngay_le` VALUES (4,'2025-10-18','ngày 18/10','le',NULL,2),(5,'2025-10-20','20/10','le',NULL,1),(16,'2025-11-02','làm bù','lam_bu',NULL,1);
/*!40000 ALTER TABLE `ngay_le` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nhan_vien`
--

DROP TABLE IF EXISTS `nhan_vien`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nhan_vien` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ho_ten` varchar(100) NOT NULL,
  `gioi_tinh` enum('Nam','Nữ') NOT NULL,
  `ngay_sinh` date DEFAULT NULL,
  `dia_chi` varchar(255) DEFAULT NULL,
  `so_dien_thoai` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `anh_dai_dien` varchar(255) DEFAULT NULL,
  `phong_ban_id` int DEFAULT NULL,
  `chuc_vu_id` int DEFAULT NULL,
  `ngay_vao_lam` date DEFAULT NULL,
  `trang_thai` varchar(50) DEFAULT 'hoat_dong',
  `ghi_chu` text,
  `so_nguoi_phu_thuoc` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_nv_chucvu` (`chuc_vu_id`),
  KEY `idx_nhanvien_phongban` (`phong_ban_id`),
  CONSTRAINT `fk_nv_chucvu` FOREIGN KEY (`chuc_vu_id`) REFERENCES `chuc_vu` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_nv_phongban` FOREIGN KEY (`phong_ban_id`) REFERENCES `phong_ban` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nhan_vien`
--

LOCK TABLES `nhan_vien` WRITE;
/*!40000 ALTER TABLE `nhan_vien` DISABLE KEYS */;
INSERT INTO `nhan_vien` VALUES (30,'Nguyễn Văn A','Nam','1980-05-10','Hà Nội','0900000001','giamdoc@congty.com',NULL,5,7,'2025-01-01','dang_lam',NULL,0),(31,'Trần Thị B','Nữ','1985-07-12','Hà Nội','0900000002','namvu2112003@gmail.com',NULL,5,8,'2025-01-02','dang_lam',NULL,0),(32,'Lê Văn C','Nam','1988-08-20','Hải Phòng','0900000003','namvu2112003@gmail.com',NULL,6,9,'2025-01-03','dang_lam',NULL,0),(33,'Phạm Văn D','Nam','1989-09-15','Hồ Chí Minh','0900000004','namvu2112003@gmail.com',NULL,7,10,'2025-01-03','dang_lam',NULL,0),(34,'Hoàng Văn E','Nam','1995-11-22','Hải Dương','0900000005','namvu2112003@gmail.com',NULL,6,11,'2025-01-04','dang_lam',NULL,0),(35,'Ngô Thị F','Nữ','1996-04-08','Hồ Chí Minh','0900000006','namvu2112003@gmail.com',NULL,7,12,'2025-01-04','dang_lam',NULL,0),(36,'Vũ Hoài Nam','Nam','2003-01-21','điện biên','0865132865','namvu2112003@gmail.com',NULL,6,11,'2025-10-27','dang_lam','nhân viên mới',0),(38,'Ngyễn Xuân Lộc','Nam','2005-04-27','phú thọ','0779292393','namvu2112003@gmail.com',NULL,7,12,'2025-10-27','dang_lam',NULL,0),(39,'Đỗ Huy Hoàng','Nam',NULL,'điện biên','0865132865','namvu2112003@gmail.com',NULL,7,12,'2025-10-30','dang_lam',NULL,0);
/*!40000 ALTER TABLE `nhan_vien` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phan_cong_lam_bu`
--

DROP TABLE IF EXISTS `phan_cong_lam_bu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phan_cong_lam_bu` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ngay` date NOT NULL,
  `nhan_vien_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phan_cong_lam_bu`
--

LOCK TABLES `phan_cong_lam_bu` WRITE;
/*!40000 ALTER TABLE `phan_cong_lam_bu` DISABLE KEYS */;
INSERT INTO `phan_cong_lam_bu` VALUES (5,'2025-11-09',34,'2025-11-06 07:46:13'),(6,'2025-11-09',32,'2025-11-06 07:46:13'),(15,'2025-11-02',39,'2025-11-13 07:34:02'),(16,'2025-11-02',34,'2025-11-13 07:34:02'),(17,'2025-11-02',32,'2025-11-13 07:34:02'),(18,'2025-11-02',35,'2025-11-13 07:34:02'),(19,'2025-11-02',30,'2025-11-13 07:34:02'),(20,'2025-11-02',38,'2025-11-13 07:34:02'),(21,'2025-11-02',33,'2025-11-13 07:34:02'),(22,'2025-11-02',31,'2025-11-13 07:34:02'),(23,'2025-11-02',36,'2025-11-13 07:34:02');
/*!40000 ALTER TABLE `phan_cong_lam_bu` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phan_tich_cong`
--

DROP TABLE IF EXISTS `phan_tich_cong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phan_tich_cong` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nhan_vien_id` int NOT NULL,
  `thang` int NOT NULL,
  `nam` int NOT NULL,
  `tong_gio` decimal(10,2) DEFAULT '0.00',
  `gio_tang_ca` decimal(10,2) DEFAULT '0.00',
  `so_ngay_cong` decimal(8,3) DEFAULT '0.000',
  `so_ngay_nghi_huong_luong` int DEFAULT '0',
  `so_ngay_nghi_phep` int DEFAULT '0',
  `so_ngay_nghi_khong_phep` int DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nhan_vien_id` (`nhan_vien_id`),
  CONSTRAINT `phan_tich_cong_ibfk_1` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phan_tich_cong`
--

LOCK TABLES `phan_tich_cong` WRITE;
/*!40000 ALTER TABLE `phan_tich_cong` DISABLE KEYS */;
INSERT INTO `phan_tich_cong` VALUES (1,30,10,2025,27.32,40.98,2.000,3,0,0,'2025-11-02 07:12:21'),(2,31,10,2025,27.48,41.22,2.000,3,0,0,'2025-11-02 07:12:21'),(3,32,10,2025,35.60,56.10,2.000,3,0,0,'2025-11-02 07:12:21'),(4,33,10,2025,17.79,35.58,1.000,3,0,1,'2025-11-02 07:12:21'),(5,34,10,2025,31.88,47.82,2.000,3,0,0,'2025-11-02 07:12:21'),(6,35,10,2025,32.00,48.00,2.000,3,0,0,'2025-11-02 07:12:21'),(7,30,11,2025,6.83,0.00,1.000,0,0,0,'2025-11-06 10:09:49'),(8,31,11,2025,6.87,0.00,1.000,0,0,0,'2025-11-06 10:09:49'),(9,32,11,2025,8.90,1.35,1.000,0,0,0,'2025-11-06 10:09:49'),(10,33,11,2025,0.00,0.00,0.000,0,0,1,'2025-11-06 10:09:49'),(11,34,11,2025,7.97,0.00,1.000,0,0,0,'2025-11-06 10:09:49'),(12,35,11,2025,8.00,0.00,1.000,0,0,0,'2025-11-06 10:09:49');
/*!40000 ALTER TABLE `phan_tich_cong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phong_ban`
--

DROP TABLE IF EXISTS `phong_ban`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phong_ban` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ten_phong_ban` varchar(100) NOT NULL,
  `mo_ta` text,
  `manager_taikhoan_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_phongban_manager` (`manager_taikhoan_id`),
  CONSTRAINT `fk_phong_ban_manager` FOREIGN KEY (`manager_taikhoan_id`) REFERENCES `tai_khoan` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_phongban_manager` FOREIGN KEY (`manager_taikhoan_id`) REFERENCES `tai_khoan` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phong_ban`
--

LOCK TABLES `phong_ban` WRITE;
/*!40000 ALTER TABLE `phong_ban` DISABLE KEYS */;
INSERT INTO `phong_ban` VALUES (5,'Phòng Kế Toán','Chịu trách nhiệm chấm công, tính lương, quản lý hồ sơ nhân sự',18),(6,'Phòng Kỹ Thuật','Đảm bảo hoạt động kỹ thuật, bảo trì, hỗ trợ kỹ thuật',19),(7,'Phòng Kinh Doanh','Bán hàng và chăm sóc khách hàng',20),(8,'Phòng Nhân Sự','Tuyển dụng và quản lý hồ sơ nhân viên',NULL);
/*!40000 ALTER TABLE `phong_ban` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phu_cap_chi_tiet`
--

DROP TABLE IF EXISTS `phu_cap_chi_tiet`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phu_cap_chi_tiet` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nhan_vien_id` int DEFAULT NULL,
  `hop_dong_id` int DEFAULT NULL,
  `loai_id` int NOT NULL,
  `thang` int DEFAULT NULL,
  `nam` int DEFAULT NULL,
  `so_tien` decimal(15,2) NOT NULL DEFAULT '0.00',
  `ghi_chu` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `nhan_vien_id` (`nhan_vien_id`),
  KEY `hop_dong_id` (`hop_dong_id`),
  KEY `loai_id` (`loai_id`),
  CONSTRAINT `phu_cap_chi_tiet_ibfk_1` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE CASCADE,
  CONSTRAINT `phu_cap_chi_tiet_ibfk_2` FOREIGN KEY (`hop_dong_id`) REFERENCES `hop_dong` (`id`) ON DELETE CASCADE,
  CONSTRAINT `phu_cap_chi_tiet_ibfk_3` FOREIGN KEY (`loai_id`) REFERENCES `phu_cap_loai` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phu_cap_chi_tiet`
--

LOCK TABLES `phu_cap_chi_tiet` WRITE;
/*!40000 ALTER TABLE `phu_cap_chi_tiet` DISABLE KEYS */;
INSERT INTO `phu_cap_chi_tiet` VALUES (1,NULL,12,1,NULL,NULL,200000.00,NULL),(2,NULL,13,1,NULL,NULL,200000.00,NULL),(3,NULL,14,1,NULL,NULL,300000.00,NULL),(4,NULL,15,1,NULL,NULL,200000.00,NULL),(8,NULL,12,4,NULL,NULL,200000.00,NULL),(9,NULL,13,4,NULL,NULL,200000.00,NULL),(10,NULL,14,4,NULL,NULL,200000.00,NULL),(11,NULL,15,4,NULL,NULL,200000.00,NULL),(15,NULL,13,5,NULL,NULL,200000.00,NULL),(16,NULL,14,5,NULL,NULL,200000.00,NULL),(17,NULL,15,5,NULL,NULL,200000.00,NULL),(18,NULL,13,6,NULL,NULL,200000.00,NULL),(19,NULL,14,6,NULL,NULL,200000.00,NULL),(20,NULL,15,6,NULL,NULL,200000.00,NULL);
/*!40000 ALTER TABLE `phu_cap_chi_tiet` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phu_cap_loai`
--

DROP TABLE IF EXISTS `phu_cap_loai`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phu_cap_loai` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ten` varchar(100) NOT NULL,
  `mo_ta` varchar(255) DEFAULT NULL,
  `tinh_bhxh` tinyint(1) DEFAULT '1',
  `mac_dinh` decimal(15,2) DEFAULT '0.00',
  `is_fixed` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phu_cap_loai`
--

LOCK TABLES `phu_cap_loai` WRITE;
/*!40000 ALTER TABLE `phu_cap_loai` DISABLE KEYS */;
INSERT INTO `phu_cap_loai` VALUES (1,'Phụ cấp đi lại',NULL,0,0.00,1),(2,'Phụ cấp ăn giữa ca',NULL,0,0.00,1),(3,'Phụ cấp nhà ở',NULL,1,0.00,1),(4,'Phụ cấp thâm niên',NULL,1,0.00,1),(5,'Phụ cấp trách nhiệm',NULL,1,0.00,1),(6,'Phụ cấp năng lực (KPI)',NULL,0,0.00,0),(7,'Phụ cấp dự án theo tháng',NULL,0,0.00,0);
/*!40000 ALTER TABLE `phu_cap_loai` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tai_khoan`
--

DROP TABLE IF EXISTS `tai_khoan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tai_khoan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nhan_vien_id` int DEFAULT NULL,
  `chuc_vu_id` int DEFAULT NULL,
  `trang_thai` enum('active','inactive') DEFAULT 'active',
  `ten_dang_nhap` varchar(50) NOT NULL,
  `mat_khau` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ten_dang_nhap` (`ten_dang_nhap`),
  UNIQUE KEY `uq_taikhoan_username` (`ten_dang_nhap`),
  KEY `idx_taikhoan_nhanvien` (`nhan_vien_id`),
  KEY `fk_taikhoan_chucvu` (`chuc_vu_id`),
  CONSTRAINT `fk_taikhoan_chucvu` FOREIGN KEY (`chuc_vu_id`) REFERENCES `chuc_vu` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tk_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tai_khoan`
--

LOCK TABLES `tai_khoan` WRITE;
/*!40000 ALTER TABLE `tai_khoan` DISABLE KEYS */;
INSERT INTO `tai_khoan` VALUES (17,30,7,'active','giamdoc','$2a$12$tJSTzn0OOw/qUVSlubtoxuh/wvQIgLEStDeX.w5z.K6gfT5jQ0tee'),(18,31,8,'active','ketoan','$2a$10$Q/2iF8kIPrt4oZ4zJvT3FeOeW3FY6aXj4wTmtW7n50SxuOEGFkJyy'),(19,32,9,'active','truongkt','$2a$10$Q/2iF8kIPrt4oZ4zJvT3FeOeW3FY6aXj4wTmtW7n50SxuOEGFkJyy'),(20,33,10,'active','truongkd','$2a$10$Q/2iF8kIPrt4oZ4zJvT3FeOeW3FY6aXj4wTmtW7n50SxuOEGFkJyy'),(21,34,11,'active','nvkt1','$2a$10$Q/2iF8kIPrt4oZ4zJvT3FeOeW3FY6aXj4wTmtW7n50SxuOEGFkJyy'),(22,35,12,'active','nvkd1','$2a$10$Q/2iF8kIPrt4oZ4zJvT3FeOeW3FY6aXj4wTmtW7n50SxuOEGFkJyy'),(24,38,12,'active','loc.ngyen','$2b$10$TciWQ83GfZik1U6EFpjUe.ETuCelx8rqTk1YT/lf.YN6DuNr/yKGS'),(25,39,12,'active','hoang.do','$2b$10$EF2sj/VaDs7XEyrg8fJO9udeEOsf/lYqUxoouXcrLF90JB9Y.C1Mq');
/*!40000 ALTER TABLE `tai_khoan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `thuong_phat`
--

DROP TABLE IF EXISTS `thuong_phat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `thuong_phat` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nhan_vien_id` int DEFAULT NULL,
  `phong_ban_id` int DEFAULT NULL,
  `thang` int DEFAULT NULL,
  `nam` int DEFAULT NULL,
  `loai` enum('THUONG','PHAT') NOT NULL,
  `so_tien` decimal(15,2) NOT NULL,
  `ly_do` varchar(255) NOT NULL,
  `ghi_chu` text,
  `nguoi_tao_id` int NOT NULL,
  `ngay_tao` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_tp_nv` (`nhan_vien_id`),
  KEY `fk_tp_pb` (`phong_ban_id`),
  KEY `fk_tp_tao` (`nguoi_tao_id`),
  CONSTRAINT `fk_tp_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`),
  CONSTRAINT `fk_tp_pb` FOREIGN KEY (`phong_ban_id`) REFERENCES `phong_ban` (`id`),
  CONSTRAINT `fk_tp_tao` FOREIGN KEY (`nguoi_tao_id`) REFERENCES `tai_khoan` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `thuong_phat`
--

LOCK TABLES `thuong_phat` WRITE;
/*!40000 ALTER TABLE `thuong_phat` DISABLE KEYS */;
INSERT INTO `thuong_phat` VALUES (1,35,NULL,10,2025,'THUONG',100000.00,'hoàn thành tốt nhiệm vụ',NULL,17,'2025-10-31 23:44:38');
/*!40000 ALTER TABLE `thuong_phat` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-18 13:22:16
