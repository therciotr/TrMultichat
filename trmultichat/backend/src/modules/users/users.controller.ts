import { Request, Response } from "express";
import { findAllSafe, findByPkSafe } from "../../utils/legacyModel";
import env from "../../config/env";

export async function list(req: Request, res: Response) {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const users = await findAllSafe("User", { offset, limit, order: [["updatedAt", "DESC"]] });
  return res.json({ users, hasMore: users.length === limit });
}

export async function find(req: Request, res: Response) {
  const id = Number(req.params.id);
  const user = await findByPkSafe("User", id);
  if (!user) {
    if (String(process.env.DEV_MODE || env.DEV_MODE || "false").toLowerCase() === "true") {
      return res.json({
        id,
        name: id === 1 ? "TR Admin" : `User ${id}`,
        email: id === 1 ? "thercio@trtecnologias.com.br" : `user${id}@example.com`,
        companyId: 1,
        admin: id === 1,
        profile: id === 1 ? "admin" : "user"
      });
    }
    return res.status(404).json({ error: true, message: "not found" });
  }
  return res.json(user);
}

export async function listByCompany(req: Request, res: Response) {
  const companyId = Number(req.query.companyId || 0);
  const users = await findAllSafe("User", {
    where: companyId ? { companyId } : undefined,
    attributes: ["id", "name", "email", "companyId"],
    order: [["id", "ASC"]]
  });
  return res.json(users);
}





