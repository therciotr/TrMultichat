import { Router } from "express";
import * as Controller from "./contacts.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const router = Router();

router.get("/", authMiddleware, Controller.list);
router.get("/:id", authMiddleware, Controller.find);
router.post("/import", authMiddleware, Controller.importContacts);
router.post("/bulk-delete", authMiddleware, Controller.removeMany);
router.delete("/", authMiddleware, Controller.removeAll);
router.delete("/:id", authMiddleware, Controller.remove);

export default router;





