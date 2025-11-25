import { Router } from "express";
import { findAllSafe } from "../../utils/legacyModel";

const router = Router();

// GET /invoices/all?searchParam=&pageNumber=1
router.get("/all", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  try {
    // Nome do model legado: Invoices (conforme dist/models/Invoices.js)
    const invoices = await findAllSafe("Invoices", { offset, limit, order: [["id", "DESC"]] });
    return res.json(invoices);
  } catch {
    return res.json([]);
  }
});

export default router;


