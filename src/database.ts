import Database from '@tauri-apps/plugin-sql';

export interface Schema {
  id?: number;
  name: string;
  description?: string;
  nodes: string; // JSON string de los nodos
  edges: string; // JSON string de las conexiones
  created_at?: string;
  updated_at?: string;
}

let db: Database | null = null;

// Inicializar la base de datos
export async function initDatabase(): Promise<Database> {
  if (db) return db;

  try {
    db = await Database.load('sqlite:drawpak.db');

    // Crear las tablas si no existen
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schemas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        nodes TEXT NOT NULL,
        edges TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Base de datos inicializada correctamente');
    return db;
  } catch (error) {
    console.error('Error inicializando la base de datos:', error);
    throw error;
  }
}

// Guardar un esquema
export async function saveSchema(schema: Schema): Promise<number> {
  const database = await initDatabase();

  const result = await database.execute(
    `INSERT INTO schemas (name, description, nodes, edges) 
     VALUES (?, ?, ?, ?)`,
    [
      schema.name,
      schema.description || '',
      schema.nodes,
      schema.edges
    ]
  );

  return result.lastInsertId || 0;
}

// Actualizar un esquema existente
export async function updateSchema(id: number, schema: Partial<Schema>): Promise<void> {
  const database = await initDatabase();

  const fields = [];
  const values = [];

  if (schema.name !== undefined) {
    fields.push('name = ?');
    values.push(schema.name);
  }

  if (schema.description !== undefined) {
    fields.push('description = ?');
    values.push(schema.description);
  }

  if (schema.nodes !== undefined) {
    fields.push('nodes = ?');
    values.push(schema.nodes);
  }

  if (schema.edges !== undefined) {
    fields.push('edges = ?');
    values.push(schema.edges);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await database.execute(
    `UPDATE schemas SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

// Obtener todos los esquemas
export async function getAllSchemas(): Promise<Schema[]> {
  const database = await initDatabase();

  const result = await database.select<Schema[]>(
    'SELECT * FROM schemas ORDER BY updated_at DESC'
  );

  return result;
}

// Obtener un esquema por ID
export async function getSchemaById(id: number): Promise<Schema | null> {
  const database = await initDatabase();

  const result = await database.select<Schema[]>(
    'SELECT * FROM schemas WHERE id = ?',
    [id]
  );

  return result.length > 0 ? result[0] : null;
}

// Eliminar un esquema
export async function deleteSchema(id: number): Promise<void> {
  const database = await initDatabase();

  await database.execute('DELETE FROM schemas WHERE id = ?', [id]);
}

// Duplicar un esquema (útil para crear desde una base existente)
export async function duplicateSchema(id: number, newName: string): Promise<number> {
  const original = await getSchemaById(id);
  if (!original) {
    throw new Error('Esquema no encontrado');
  }

  return await saveSchema({
    name: newName,
    description: original.description,
    nodes: original.nodes,
    edges: original.edges
  });
}