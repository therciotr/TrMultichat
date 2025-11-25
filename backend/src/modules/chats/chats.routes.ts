import { Router } from "express";
import { findAllSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const records = await findAllSafe("Chat", { offset, limit });
  return res.json({ records, hasMore: records.length === limit });
});

router.get("/:id/messages", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const chatId = Number(req.params.id);
  const messages = await findAllSafe("ChatMessage", { offset, limit, where: { chatId }, order: [["id", "DESC"]] });
  return res.json({ messages, hasMore: messages.length === limit });
});

export default router;





