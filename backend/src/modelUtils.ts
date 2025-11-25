export function hasCompanyId(Model: any): boolean {
  try {
    const raw = Model?.rawAttributes || Model?.attributes || {};
    return !!raw.companyId || !!raw.companyID || !!raw.company_id;
  } catch {
    return false;
  }
}


