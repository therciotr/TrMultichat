import { Router } from "express";
import * as Controller from "./users.controller";

const router = Router();

router.get("/", Controller.list);
router.get("/list", Controller.listByCompany);
router.post("/", Controller.create);
router.get("/:id", Controller.find);
router.put("/:id", Controller.update);
router.delete("/:id", Controller.remove);
router.put("/:id/password", Controller.updatePassword);
router.put("/:id/password/raw", Controller.updatePasswordRaw);
router.put("/:id/password/reset", Controller.updatePasswordAdmin);

export default router;





