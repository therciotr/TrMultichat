import { Router } from "express";
import { findAllSafe, findByPkSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const records = await findAllSafe("ContactList", { offset, limit });
  return res.json({ records, hasMore: records.length === limit });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const record = await findByPkSafe("ContactList", id);
  if (!record) return res.status(404).json({ error: true, message: "not found" });
  return res.json(record);
});

// Items listing used in FE as separate endpoint
router.get("/items/list", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const contactListId = Number(req.query.contactListId || 0);
  const contacts = await findAllSafe("ContactListItem", { offset, limit, where: contactListId ? { contactListId } : undefined });
  return res.json({ contacts, hasMore: contacts.length === limit });
});

export default router;





