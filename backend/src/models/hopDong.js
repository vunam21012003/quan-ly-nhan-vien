// models/HopDong.ts
import { DataTypes } from "sequelize";
import sequelize from "../config/db";

const HopDong = sequelize.define(
  "HopDong",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nhan_vien_id: { type: DataTypes.INTEGER, allowNull: false },
    so_hop_dong: { type: DataTypes.STRING, allowNull: false },
    loai_hop_dong: DataTypes.STRING,
    ngay_ky: DataTypes.DATE,
    ngay_bat_dau: DataTypes.DATE,
    ngay_ket_thuc: DataTypes.DATE,
    luong_thoa_thuan: DataTypes.FLOAT,
    phu_cap: DataTypes.FLOAT,
    ghi_chu: DataTypes.TEXT,
    trang_thai: DataTypes.STRING,
    file_hop_dong: DataTypes.STRING,
  },
  {
    tableName: "hop_dong",
    timestamps: false,
  }
);

export default HopDong;
