import { Router } from "express";
import * as controller from "../controllers/lichSuTraLuongController";

const router = Router();

router.get("/", controller.list);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

export default router;
