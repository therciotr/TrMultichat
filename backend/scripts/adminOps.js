/* Admin ops: promote user to super admin and disconnect WhatsApp sessions */
const { Client } = require('pg');

async function run() {
  const c = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: +(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });
  await c.connect();

  // Promote admin user
  const email = (process.env.ADMIN_EMAIL || 'thercio@trtecnologias.com.br').toLowerCase();
  try { await c.query('alter table "Users" add column if not exists admin boolean'); } catch {}
  try { await c.query('alter table "Users" add column if not exists profile varchar(50)'); } catch {}
  try { await c.query('alter table "Users" add column if not exists super boolean'); } catch {}
  await c.query('update "Users" set admin=true, super=true, profile=\'admin\' where lower(email)=lower($1)', [email]);
  const u = await c.query('select id,email,admin,profile,super from "Users" where lower(email)=lower($1)', [email]);
  console.log('[user]', u.rows);

  // Disconnect WhatsApp sessions (best effort)
  const tables = await c.query("select table_name from information_schema.tables where table_schema='public'");
  const wt = tables.rows.map(r=>r.table_name).find(n=>n.toLowerCase().includes('whatsapp'));
  if (wt) {
    const cols = await c.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [wt.toLowerCase()]);
    const colset = cols.rows.map(r=>r.column_name);
    const parts = [];
    if (colset.includes('status')) parts.push('"status"=\'DISCONNECTED\'');
    if (colset.includes('session')) parts.push('"session"=NULL');
    if (colset.includes('qrcode')) parts.push('"qrcode"=NULL');
    if (colset.includes('token')) parts.push('"token"=NULL');
    if (colset.includes('isDefault')) parts.push('"isDefault"=false');
    if (parts.length) {
      const sql = `update "${wt}" set ${parts.join(', ')}`;
      await c.query(sql);
      console.log('[whatsapps] disconnected via', wt);
    } else {
      console.log('[whatsapps] no updatable columns found on', wt);
    }
  } else {
    console.log('[whatsapps] table not found');
  }

  await c.end();
  console.log('DONE');
}

run().catch(e=>{ console.error(e); process.exit(1); });


