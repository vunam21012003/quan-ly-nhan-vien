-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: quan_ly_nhan_su
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
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
  `trang_thai` enum('Đi làm','Nghỉ phép','Nghỉ không phép') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cc_nv` (`nhan_vien_id`),
  CONSTRAINT `cham_cong_ibfk_1` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`),
  CONSTRAINT `fk_cc_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cham_cong`
--

LOCK TABLES `cham_cong` WRITE;
/*!40000 ALTER TABLE `cham_cong` DISABLE KEYS */;
INSERT INTO `cham_cong` VALUES (1,1,'2025-07-01','08:00:00','17:00:00','Đi làm'),(2,1,'2025-07-02','08:10:00','17:15:00','Đi làm'),(3,2,'2025-07-01',NULL,NULL,'Nghỉ phép'),(4,2,'2025-07-02','08:10:00','17:15:00','Đi làm'),(5,2,'2025-07-03','08:05:00','17:00:00','Đi làm'),(9,5,'2025-07-01','08:30:00','17:30:00','Đi làm');
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chuc_vu`
--

LOCK TABLES `chuc_vu` WRITE;
/*!40000 ALTER TABLE `chuc_vu` DISABLE KEYS */;
INSERT INTO `chuc_vu` VALUES (1,'Nhân viên'),(2,'Trưởng phòng'),(3,'Giám đốc'),(4,'Giám đốc');
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
  `luong_thoa_thuan` decimal(15,0) DEFAULT NULL,
  `file_hop_dong` varchar(255) DEFAULT NULL,
  `ghi_chu` text,
  PRIMARY KEY (`id`),
  KEY `fk_hd_nv` (`nhan_vien_id`),
  CONSTRAINT `fk_hd_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE CASCADE,
  CONSTRAINT `hop_dong_ibfk_1` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hop_dong`
--

LOCK TABLES `hop_dong` WRITE;
/*!40000 ALTER TABLE `hop_dong` DISABLE KEYS */;
INSERT INTO `hop_dong` VALUES (1,1,'Xác định thời hạn','2023-01-01','2024-01-01',8000000,NULL,'Hợp đồng chính thức'),(2,2,'Không xác định thời hạn','2022-05-01',NULL,12000000,NULL,'Không ghi chú'),(4,4,'Xác định thời hạn','2020-03-15','2023-03-14',20000000,NULL,'Đã hết hạn'),(5,5,'Xác định thời hạn','2024-02-01','2024-04-30',9000000,NULL,'Thử việc 2 tháng');
/*!40000 ALTER TABLE `hop_dong` ENABLE KEYS */;
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
  `tong_luong` decimal(15,2) DEFAULT NULL,
  `ngay_tra` date DEFAULT NULL,
  `ghi_chu` text,
  PRIMARY KEY (`id`),
  KEY `fk_ls_nv` (`nhan_vien_id`),
  CONSTRAINT `fk_ls_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lich_su_tra_luong_ibfk_1` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lich_su_tra_luong`
--

LOCK TABLES `lich_su_tra_luong` WRITE;
/*!40000 ALTER TABLE `lich_su_tra_luong` DISABLE KEYS */;
INSERT INTO `lich_su_tra_luong` VALUES (1,1,7,2025,9300000.00,'2025-08-01',NULL),(2,2,7,2025,13200000.00,'2025-08-01',NULL),(4,4,7,2025,20000000.00,'2025-08-01',NULL),(5,5,7,2025,9000000.00,'2025-08-01','Trả theo thử việc');
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
  `luong_co_ban` decimal(15,2) DEFAULT NULL,
  `phu_cap` decimal(15,2) DEFAULT NULL,
  `thuong` decimal(15,2) DEFAULT NULL,
  `khau_tru` decimal(15,2) DEFAULT NULL,
  `thang` int DEFAULT NULL,
  `nam` int DEFAULT NULL,
  `ngay_tinh` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_luong_nv` (`nhan_vien_id`),
  CONSTRAINT `fk_luong_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE CASCADE,
  CONSTRAINT `luong_ibfk_1` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `luong`
--

LOCK TABLES `luong` WRITE;
/*!40000 ALTER TABLE `luong` DISABLE KEYS */;
INSERT INTO `luong` VALUES (1,1,8000000.00,500000.00,1000000.00,200000.00,7,2025,'2025-07-31'),(2,2,12000000.00,0.00,1500000.00,300000.00,7,2025,'2025-07-31'),(4,4,20000000.00,1000000.00,1500000.00,400000.00,7,2025,'2025-07-31'),(5,5,9000000.00,0.00,500000.00,100000.00,7,2025,'2025-07-31');
/*!40000 ALTER TABLE `luong` ENABLE KEYS */;
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
  `phong_ban_id` int DEFAULT NULL,
  `chuc_vu_id` int DEFAULT NULL,
  `ngay_vao_lam` date DEFAULT NULL,
  `trang_thai` varchar(50) DEFAULT 'hoat_dong',
  PRIMARY KEY (`id`),
  KEY `fk_nv_phongban` (`phong_ban_id`),
  KEY `fk_nv_chucvu` (`chuc_vu_id`),
  CONSTRAINT `fk_nv_chucvu` FOREIGN KEY (`chuc_vu_id`) REFERENCES `chuc_vu` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_nv_phongban` FOREIGN KEY (`phong_ban_id`) REFERENCES `phong_ban` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nhan_vien`
--

LOCK TABLES `nhan_vien` WRITE;
/*!40000 ALTER TABLE `nhan_vien` DISABLE KEYS */;
INSERT INTO `nhan_vien` VALUES (1,'Nguyễn Văn A','Nam','1990-01-15','123 Lê Lợi, Hà Nội','0901234567','a@example.com',NULL,NULL,'2020-06-01','hoat_dong'),(2,'Trần Thị B','Nữ','1992-03-22','456 Trần Hưng Đạo, HCM','0912345678','b@example.com',2,2,'2021-01-15','hoat_dong'),(4,'Trần Thị B','Nữ','1992-03-22','456 Trần Hưng Đạo, HCM','0912345678','b@example.com',2,2,'2021-01-15','hoat_dong'),(5,'Đỗ Văn E','Nam','1998-02-27','TP.HCM','0905677889','e.do@example.com',5,1,'2024-02-01','hoat_dong'),(6,'Nguyễn Văn Mới','Nam','1995-05-20','Hà Nội','0911222333','new@example.com',NULL,2,'2025-08-09','hoat_dong'),(9,'Nguyễn Văn A','Nam','1999-05-20','Hà Nội','0912345678','a@example.com',9,2,'2025-08-01','hoat_dong');
/*!40000 ALTER TABLE `nhan_vien` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phan_tich_cong`
--

DROP TABLE IF EXISTS `phan_tich_cong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phan_tich_cong` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nhan_vien_id` int DEFAULT NULL,
  `thang` int DEFAULT NULL,
  `nam` int DEFAULT NULL,
  `tong_gio_lam` decimal(10,2) DEFAULT NULL,
  `so_ngay_cong` int DEFAULT NULL,
  `so_ngay_nghi_phep` int DEFAULT NULL,
  `so_ngay_nghi_khong_phep` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ptc_nv` (`nhan_vien_id`),
  CONSTRAINT `fk_ptc_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE CASCADE,
  CONSTRAINT `phan_tich_cong_ibfk_1` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phan_tich_cong`
--

LOCK TABLES `phan_tich_cong` WRITE;
/*!40000 ALTER TABLE `phan_tich_cong` DISABLE KEYS */;
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phong_ban`
--

LOCK TABLES `phong_ban` WRITE;
/*!40000 ALTER TABLE `phong_ban` DISABLE KEYS */;
INSERT INTO `phong_ban` VALUES (2,'Phòng Nhân Sự'),(3,'Phòng Kỹ Thuật'),(4,'Phòng Kỹ Thuật'),(5,'Phòng Hành Chính'),(6,'Kinh doanh'),(7,'Kinh doanh'),(9,'Kinh doanh');
/*!40000 ALTER TABLE `phong_ban` ENABLE KEYS */;
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
  `ten_dang_nhap` varchar(50) NOT NULL,
  `mat_khau` varchar(255) NOT NULL,
  `quyen` enum('admin','nhanvien') DEFAULT 'nhanvien',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ten_dang_nhap` (`ten_dang_nhap`),
  KEY `fk_tk_nv` (`nhan_vien_id`),
  CONSTRAINT `fk_tk_nv` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`) ON DELETE SET NULL,
  CONSTRAINT `tai_khoan_ibfk_1` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhan_vien` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tai_khoan`
--

LOCK TABLES `tai_khoan` WRITE;
/*!40000 ALTER TABLE `tai_khoan` DISABLE KEYS */;
INSERT INTO `tai_khoan` VALUES (1,1,'nva','123456','nhanvien'),(2,2,'ttb','123456','admin'),(3,1,'a.nguyen','User@123','nhanvien'),(4,2,'b.tran','User@123','nhanvien'),(5,5,'e.do','User@123','nhanvien');
/*!40000 ALTER TABLE `tai_khoan` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-08-26 14:48:14
