import { Router } from "express";
import * as Controller from "./contacts.controller";

const router = Router();

router.get("/", Controller.list);
router.get("/:id", Controller.find);

export default router;





