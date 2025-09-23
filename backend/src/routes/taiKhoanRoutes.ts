import { Router } from "express";
import * as controller from "../controllers/taiKhoanController";

const router = Router();

router.get("/", controller.getAll);
router.post("/", controller.create);
router.post("/:id/change-password", controller.changePassword);
router.delete("/:id", controller.remove);

export default router;
