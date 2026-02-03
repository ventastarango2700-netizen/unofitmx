import { neon } from "@netlify/neon";

const ROLES = {
  ADM: { canManageUsers: true, canViewIncome: true, canChangeStatus: true, canManageControl: true },
  GT: { canManageUsers: false, canViewIncome: true, canChangeStatus: true, canManageControl: true },
  EV: { canManageUsers: false, canViewIncome: false, canChangeStatus: false, canManageControl: false }
};

async function initDb(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS system_state (
      id SERIAL PRIMARY KEY,
      key VARCHAR(255) UNIQUE NOT NULL,
      value TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(10) NOT NULL CHECK (role IN ('ADM', 'GT', 'EV')),
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS income_records (
      id SERIAL PRIMARY KEY,
      amount DECIMAL(10,2) NOT NULL,
      description VARCHAR(255),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      action VARCHAR(255) NOT NULL,
      user_role VARCHAR(10),
      details TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  const existingStatus = await sql`SELECT * FROM system_state WHERE key = 'status'`;
  if (existingStatus.length === 0) {
    await sql`INSERT INTO system_state (key, value) VALUES ('status', 'Sistema estable')`;
  }

  const existingUsers = await sql`SELECT * FROM users LIMIT 1`;
  if (existingUsers.length === 0) {
    await sql`INSERT INTO users (name, role) VALUES ('Admin', 'ADM'), ('Gerente', 'GT'), ('Evaluador', 'EV')`;
  }
}

function checkPermission(role, action) {
  const permissions = ROLES[role];
  if (!permissions) return false;
  return permissions[action] === true;
}

export default async (req) => {
  const sql = neon();
  const url = new URL(req.url);
  const path = url.pathname.replace('/api', '');

  try {
    await initDb(sql);

    if (req.method === 'GET' && path === '/status') {
      const result = await sql`SELECT value FROM system_state WHERE key = 'status'`;
      return Response.json({ status: result[0]?.value || 'Sistema estable' });
    }

    if (req.method === 'POST' && path === '/status') {
      const body = await req.json();
      const { role, newStatus } = body;

      if (!checkPermission(role, 'canChangeStatus')) {
        await sql`INSERT INTO activity_log (action, user_role, details) VALUES ('status_change_denied', ${role}, ${newStatus})`;
        return Response.json({ error: 'No tienes permiso para cambiar el estado', code: 'UNAUTHORIZED' }, { status: 403 });
      }

      await sql`UPDATE system_state SET value = ${newStatus}, updated_at = NOW() WHERE key = 'status'`;
      await sql`INSERT INTO activity_log (action, user_role, details) VALUES ('status_changed', ${role}, ${newStatus})`;

      return Response.json({ success: true, status: newStatus });
    }

    if (req.method === 'GET' && path === '/users') {
      const users = await sql`SELECT id, name, role, active FROM users ORDER BY id`;
      return Response.json({ users });
    }

    if (req.method === 'POST' && path === '/control/activate') {
      const body = await req.json();
      const { role } = body;

      if (!checkPermission(role, 'canManageControl')) {
        await sql`INSERT INTO activity_log (action, user_role, details) VALUES ('control_activation_denied', ${role}, 'attempted')`;
        return Response.json({ error: 'No tienes permiso para activar el control', code: 'UNAUTHORIZED' }, { status: 403 });
      }

      await sql`INSERT INTO activity_log (action, user_role, details) VALUES ('control_activated', ${role}, 'success')`;
      return Response.json({ success: true, message: 'Control activo' });
    }

    if (req.method === 'GET' && path === '/messages') {
      const logs = await sql`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20`;
      return Response.json({ messages: logs });
    }

    if (req.method === 'POST' && path === '/messages/send') {
      const body = await req.json();
      const { role, message } = body;

      await sql`INSERT INTO activity_log (action, user_role, details) VALUES ('message_sent', ${role}, ${message})`;
      return Response.json({ success: true, message: 'Mensajes listos' });
    }

    if (req.method === 'GET' && path === '/income') {
      const role = url.searchParams.get('role');

      if (!checkPermission(role, 'canViewIncome')) {
        return Response.json({ error: 'No tienes permiso para ver ingresos', code: 'UNAUTHORIZED' }, { status: 403 });
      }

      const income = await sql`SELECT SUM(amount) as total FROM income_records`;
      const recent = await sql`SELECT * FROM income_records ORDER BY created_at DESC LIMIT 10`;

      return Response.json({
        total: income[0]?.total || 0,
        recent,
        message: 'Ingresos monitoreados'
      });
    }

    if (req.method === 'POST' && path === '/reset') {
      await sql`DELETE FROM activity_log`;
      await sql`DELETE FROM income_records`;
      await sql`UPDATE system_state SET value = 'Sistema estable', updated_at = NOW() WHERE key = 'status'`;
      await sql`INSERT INTO activity_log (action, user_role, details) VALUES ('system_reset', 'SYSTEM', 'full reset')`;

      return Response.json({ success: true, message: 'Estado reiniciado' });
    }

    if (req.method === 'POST' && path === '/users/check') {
      const body = await req.json();
      const { role } = body;

      if (!checkPermission(role, 'canManageUsers')) {
        const users = await sql`SELECT id, name, role, active FROM users`;
        return Response.json({
          success: true,
          canManage: false,
          users,
          message: 'Usuarios OK (solo lectura)'
        });
      }

      const users = await sql`SELECT id, name, role, active FROM users`;
      await sql`INSERT INTO activity_log (action, user_role, details) VALUES ('users_reviewed', ${role}, 'full access')`;

      return Response.json({
        success: true,
        canManage: true,
        users,
        message: 'Usuarios OK'
      });
    }

    return Response.json({ error: 'Ruta no encontrada', code: 'NOT_FOUND' }, { status: 404 });

  } catch (error) {
    console.error('API Error:', error);
    return Response.json({
      error: 'Error del sistema. Por favor intenta de nuevo.',
      code: 'SYSTEM_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};

export const config = {
  path: "/api/*"
};
