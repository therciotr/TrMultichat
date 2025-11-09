import { Router } from "express";
import * as Controller from "./users.controller";

const router = Router();

router.get("/", Controller.list);
router.get("/list", Controller.listByCompany);
router.get("/:id", Controller.find);

export default router;





