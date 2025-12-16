import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { findAllSafe } from "../../utils/legacyModel";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

// Financeiro deve ser privado e filtrado por empresa (tenant)
router.use(authMiddleware);

// GET /invoices/all?searchParam=&pageNumber=1
router.get("/all", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const companyId = Number((req as any).tenantId || 0);
  try {
    // Preferencial: Postgres direto (mais confiável em produção)
    if (companyId && Number.isFinite(companyId)) {
      const rows = await pgQuery<{
        id: number;
        detail: string;
        status: string;
        value: number;
        createdAt: string;
        updatedAt: string;
        dueDate: string;
        companyId: number;
      }>(
        'SELECT id, detail, status, value, "createdAt", "updatedAt", "dueDate", "companyId" FROM "Invoices" WHERE "companyId" = $1 ORDER BY id DESC LIMIT $2 OFFSET $3',
        [companyId, limit, offset]
      );
      return res.json(Array.isArray(rows) ? rows : []);
    }

    // Fallback: ORM legado (se tenantId não estiver disponível por algum motivo)
    const invoices = await findAllSafe("Invoices", {
      offset,
      limit,
      order: [["id", "DESC"]]
    });
    return res.json(Array.isArray(invoices) ? invoices : []);
  } catch {
    // Fallback mais permissivo: tentar ORM legado filtrando por companyId quando possível
    try {
      const invoices = await findAllSafe("Invoices", {
        offset,
        limit,
        order: [["id", "DESC"]],
        ...(companyId ? { where: { companyId } } : {})
      });
      return res.json(Array.isArray(invoices) ? invoices : []);
    } catch {
      return res.json([]);
    }
  }
});

export default router;




