import { Router } from "express";
import { findAllSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/:ticketId", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const ticketId = Number(req.params.ticketId);
  const messages = await findAllSafe("Message", { offset, limit, where: { ticketId }, order: [["id", "DESC"]] });
  return res.json({ messages, hasMore: messages.length === limit });
});

export default router;





