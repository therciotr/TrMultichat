import { Request, Response } from "express";
import { findAllSafe, findByPkSafe } from "../../utils/legacyModel";

export async function list(req: Request, res: Response) {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const contacts = await findAllSafe("Contact", { offset, limit, order: [["updatedAt", "DESC"]] });
  return res.json({ contacts, hasMore: contacts.length === limit });
}

export async function find(req: Request, res: Response) {
  const id = Number(req.params.id);
  const contact = await findByPkSafe("Contact", id);
  if (!contact) return res.status(404).json({ error: true, message: "not found" });
  return res.json(contact);
}





