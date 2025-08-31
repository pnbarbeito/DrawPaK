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

export interface SvgElement {
  id?: number;
  name: string;
  description?: string;
  category?: string; // Categoría del elemento (ej: 'basic', 'custom', 'flowchart', etc.)
  svg: string; // SVG markup
  handles?: string; // JSON string of handles metadata
  created_at?: string;
  updated_at?: string;
}

let db: Database | null = null;

// Inicializar la base de datos
export async function initDatabase(): Promise<Database> {
  if (db) return db;

  try {
    db = await Database.load('sqlite:/home/pbarbeito/dev/DrawPak/drawpak.db');

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

    // Tabla para elementos SVG personalizados
    await db.execute(`
      CREATE TABLE IF NOT EXISTS svg_elements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'custom',
        svg TEXT NOT NULL,
        handles TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Agregar columna category si no existe (migración)
    try {
      await db.execute(`ALTER TABLE svg_elements ADD COLUMN category TEXT DEFAULT 'custom'`);
    } catch (e) {
      // La columna ya existe, ignorar el error
    }

    // Inicializar elementos básicos
    //await initializeBasicElements();

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

// Guardar un elemento SVG personalizado
export async function saveSvgElement(elem: SvgElement): Promise<number> {
  const database = await initDatabase();
  const result = await database.execute(
    `INSERT INTO svg_elements (name, description, category, svg, handles) VALUES (?, ?, ?, ?, ?)`,
    [elem.name, elem.description || '', elem.category || 'custom', elem.svg, elem.handles || null]
  );
  return result.lastInsertId || 0;
}

// Actualizar elemento SVG
export async function updateSvgElement(id: number, elem: Partial<SvgElement>): Promise<void> {
  const database = await initDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (elem.name !== undefined) { fields.push('name = ?'); values.push(elem.name); }
  if (elem.description !== undefined) { fields.push('description = ?'); values.push(elem.description); }
  if (elem.category !== undefined) { fields.push('category = ?'); values.push(elem.category); }
  if (elem.svg !== undefined) { fields.push('svg = ?'); values.push(elem.svg); }
  if (elem.handles !== undefined) { fields.push('handles = ?'); values.push(elem.handles); }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await database.execute(
    `UPDATE svg_elements SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

// Obtener todos los elementos SVG
export async function getAllSvgElements(): Promise<SvgElement[]> {
  const database = await initDatabase();
  const result = await database.select<SvgElement[]>(
    'SELECT * FROM svg_elements ORDER BY updated_at DESC'
  );
  return result;
}

// Obtener un elemento SVG por ID
export async function getSvgElementById(id: number): Promise<SvgElement | null> {
  const database = await initDatabase();
  const result = await database.select<SvgElement[]>(
    'SELECT * FROM svg_elements WHERE id = ?',
    [id]
  );
  return result.length > 0 ? result[0] : null;
}

// Obtener elementos SVG por categoría
export async function getSvgElementsByCategory(category: string): Promise<SvgElement[]> {
  const database = await initDatabase();
  const result = await database.select<SvgElement[]>(
    'SELECT * FROM svg_elements WHERE category = ? ORDER BY name',
    [category]
  );
  return result;
}

// Obtener todas las categorías disponibles
export async function getSvgCategories(): Promise<string[]> {
  const database = await initDatabase();
  const result = await database.select<{ category: string }[]>(
    'SELECT DISTINCT category FROM svg_elements WHERE category IS NOT NULL ORDER BY category'
  );
  return result.map(r => r.category);
}

// Eliminar un elemento SVG
export async function deleteSvgElement(id: number): Promise<void> {
  const database = await initDatabase();
  await database.execute('DELETE FROM svg_elements WHERE id = ?', [id]);
}

// Limpiar todos los elementos SVG (útil para reinicializar)
export async function clearAllSvgElements(): Promise<void> {
  const database = await initDatabase();
  await database.execute('DELETE FROM svg_elements');
  console.log('Todos los elementos SVG han sido eliminados');
}

// Inicializar elementos básicos (desde symbols.tsx) si no existen
export async function initializeBasicElements(): Promise<void> {
  // Verificar si ya existen elementos básicos
  const existingElements = await getAllSvgElements();
  if (existingElements.length > 0) {
    console.log('Elementos básicos ya están inicializados');
    return; // Ya están inicializados
  }

  console.log('Inicializando elementos básicos desde symbols.tsx...');

  // Transformadores
  const transformadores = [
    {
      name: 'Transformador',
      description: 'Transformador básico',
      category: 'transformadores',
      svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="40" r="25" stroke="#000" strokeWidth="3" fill="none" />
            <circle cx="60" cy="80" r="25" stroke="#000" strokeWidth="3" fill="none" />
            <path d="M60 0 L60 15" stroke="#000" strokeWidth="3" />
            <path d="M60 120 L60 105" stroke="#000" strokeWidth="3" />
          </svg>`,
      handles: JSON.stringify([
        { id: 'top', x: 60, y: 0, type: 'source' },
        { id: 'bottom', x: 60, y: 120, type: 'target' }
      ])
    },
    {
      name: 'Transformador Doble',
      description: 'Transformador con doble salida',
      category: 'transformadores',
      svg: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="40" r="25" stroke="#000" strokeWidth="3" fill="none" />
            <circle cx="40" cy="100" r="20" stroke="#000" strokeWidth="3" fill="none" />
            <circle cx="80" cy="100" r="20" stroke="#000" strokeWidth="3" fill="none" />
            <path d="M60 0 L60 15" stroke="#000" strokeWidth="3" />
            <path d="M40 160 L40 120" stroke="#000" strokeWidth="3" />
            <path d="M80 160 L80 120" stroke="#000" strokeWidth="3" />
          </svg>`,
      handles: JSON.stringify([
        { id: 'top', x: 60, y: 0, type: 'source' },
        { id: 'left', x: 40, y: 160, type: 'target' },
        { id: 'right', x: 80, y: 160, type: 'target' }
      ])
    }
  ];

  // Protección
  const proteccion = [
    {
      name: 'Interruptor',
      description: 'Interruptor de protección',
      category: 'proteccion',
      svg: `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 40 L30 40" stroke="#000" strokeWidth="4" />
            <path d="M30 40 L90 20" stroke="#000" strokeWidth="4" />
            <path d="M90 40 L120 40" stroke="#000" strokeWidth="4" />
            <circle cx="30" cy="40" r="4" fill="#000" />
            <circle cx="90" cy="40" r="4" fill="#000" />
          </svg>`,
      handles: JSON.stringify([
        { id: 'left', x: 0, y: 40, type: 'source' },
        { id: 'right', x: 120, y: 40, type: 'target' }
      ])
    },
    {
      name: 'Seccionador',
      description: 'Seccionador de línea',
      category: 'proteccion',
      svg: `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 20 L25 20" stroke="#000" strokeWidth="4" />
            <path d="M25 20 L55 10" stroke="#000" strokeWidth="4" />
            <path d="M55 20 L80 20" stroke="#000" strokeWidth="4" />
            <circle cx="25" cy="20" r="3" fill="#000" />
            <circle cx="55" cy="20" r="3" fill="#000" />
          </svg>`,
      handles: JSON.stringify([
        { id: 'left', x: 0, y: 20, type: 'source' },
        { id: 'right', x: 80, y: 20, type: 'source' }
      ])
    }
  ];

  // Infraestructura
  const infraestructura = [
    {
      name: 'Barras',
      description: 'Conexión a tierra',
      category: 'infraestructura',
      svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <rect x="37.5" y="0" width="4" height="200" fill="#000" />
              <rect x="77.5" y="0" width="4" height="200" fill="#000" />
              <path d="M38 40 L200 40" stroke="#000" strokeWidth="2" />
              <path d="M78 160 L200 160" stroke="#000" strokeWidth="2" />
            </svg>`,
      handles: JSON.stringify([
        { id: 't_left', x: 40, y: 0, type: 'source' },
        { id: 't_right', x: 80, y: 0, type: 'source' },
        { id: 'r_top', x: 200, y: 40, type: 'target' },
        { id: 'r_bottom', x: 200, y: 160, type: 'target' },
        { id: 'b_left', x: 40, y: 200, type: 'target' },
        { id: 'b_right', x: 80, y: 200, type: 'target' }
      ])
    },
    {
      name: 'Puesta a Tierra',
      description: 'Conexión a tierra',
      category: 'infraestructura',
      svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 0 L20 25" stroke="#000" strokeWidth="3" />
              <path d="M10 25 L30 25" stroke="#000" strokeWidth="4" />
              <path d="M12 30 L28 30" stroke="#000" strokeWidth="3" />
              <path d="M14 35 L26 35" stroke="#000" strokeWidth="2" />
            </svg>`,
      handles: JSON.stringify([
        { id: 'top', x: 20, y: 0, type: 'source' }
      ])
    }
  ];

  // Seguridad
  const seguridad = [
    {
      name: 'Candado de Seguridad',
      description: 'Dispositivo de bloqueo',
      category: 'seguridad',
      svg: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 25 L15 15 A15 15 0 0 1 45 15 L45 25" stroke="#000" strokeWidth="4" fill="none" />
            <rect x="10" y="25" width="40" height="25" fill="#ffd700" stroke="#000" strokeWidth="3" />
            <circle cx="30" cy="37" r="4" fill="#000" />
            <path d="M30 40 L30 45" stroke="#000" strokeWidth="3" />
          </svg>`,
      handles: "{}"
    }
  ];

  // Guardar todos los elementos
  const allElements = [...transformadores, ...proteccion, ...infraestructura, ...seguridad];

  for (const element of allElements) {
    try {
      await saveSvgElement(element);
      console.log(`Elemento guardado: ${element.name} (${element.category})`);
    } catch (error) {
      console.error(`Error guardando elemento ${element.name}:`, error);
    }
  }

  console.log('Elementos básicos inicializados correctamente');
}

// Función para reinicializar elementos básicos (útil durante desarrollo)
export async function reinitializeBasicElements(): Promise<void> {
  await clearAllSvgElements();
  await initializeBasicElements();
}