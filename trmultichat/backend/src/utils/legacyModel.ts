/* Helper to load legacy (compiled) Sequelize models from the mounted legacy app.
 * We avoid hard dependencies so local DEV works even without full models.
 */

export function getLegacyModel(modelName: string): any | undefined {
  try {
    // Relative path from dist/utils to dist/models
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(`../models/${modelName}`);
    return (mod && (mod.default || mod)) || undefined;
  } catch (e) {
    try {
      // Fallback: require from root compiled path
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(`./models/${modelName}`);
      return (mod && (mod.default || mod)) || undefined;
    } catch (_e) {
      try {
        // Running from src via ts-node-dev: resolve dist/models at runtime
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const path = require("path");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(path.resolve(process.cwd(), "dist/models", modelName));
        return (mod && (mod.default || mod)) || undefined;
      } catch (_e2) {
        return undefined;
      }
    }
  }
}

export async function findAllSafe(modelName: string, options: any = {}): Promise<any[]> {
  const Model = getLegacyModel(modelName);
  if (Model && typeof Model.findAll === "function") {
    try {
      const rows = await Model.findAll(options);
      return Array.isArray(rows)
        ? rows.map((r: any) => (r?.toJSON ? r.toJSON() : r))
        : [];
    } catch (_e) {
      return [];
    }
  }
  return [];
}

export async function findByPkSafe(modelName: string, id: number): Promise<any | null> {
  const Model = getLegacyModel(modelName);
  if (Model && typeof Model.findByPk === "function") {
    try {
      const instance = await Model.findByPk(id);
      if (!instance) return null;
      return instance?.toJSON ? instance.toJSON() : instance;
    } catch (_e) {
      return null;
    }
  }
  return null;
}





