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
    db = await Database.load('sqlite:/home/pbarbeito/Dev/DrawPaK/drawpak.db');

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
    `INSERT INTO schemas (name, description, nodes, edges) VALUES (?, ?, ?, ?)`,
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
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" style="background: rgba(255, 255, 255, 0);">
        <defs xmlns="http://www.w3.org/2000/svg"/>
        <g xmlns="http://www.w3.org/2000/svg">
            <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 60, 40)">
                <circle xmlns="http://www.w3.org/2000/svg" cx="60" fill-opacity="0" fill="#fff" stroke="#000" r="25" stroke-width="2" cy="40"/>
            </g>
        </g>
        <g xmlns="http://www.w3.org/2000/svg">
            <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 60, 80)">
                <circle xmlns="http://www.w3.org/2000/svg" cx="60" fill-opacity="0" fill="#fff" stroke="#000" r="25" stroke-width="2" cy="80"/>
            </g>
        </g>
        <g xmlns="http://www.w3.org/2000/svg">
            <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 60, 7.5)">
                <line xmlns="http://www.w3.org/2000/svg" y2="15" y1="0" stroke="#000" x2="60" stroke-width="2" x1="60"/>
            </g>
        </g>
        <g xmlns="http://www.w3.org/2000/svg">
            <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 60, 112.5)">
                <line xmlns="http://www.w3.org/2000/svg" y2="105" y1="120" stroke="#000" x2="60" stroke-width="2" x1="60"/>
                <g xmlns="http://www.w3.org/2000/svg"/>
            </g>
        </g>
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
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160" style="background: rgba(255, 255, 255, 0);">
          <defs xmlns="http://www.w3.org/2000/svg"/>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 60, 60)">
                  <circle xmlns="http://www.w3.org/2000/svg" cx="60" fill-opacity="1" fill="#fff" stroke="#000" r="30" stroke-width="2" cy="60"/>
                  <g xmlns="http://www.w3.org/2000/svg"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 40, 100)">
                  <circle xmlns="http://www.w3.org/2000/svg" cx="40" fill-opacity="1" fill="#fff" stroke="#000" r="30" stroke-width="2" cy="100"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 80, 100)">
                  <circle xmlns="http://www.w3.org/2000/svg" cx="80" fill-opacity="1" fill="none" stroke="#000" r="30" stroke-width="2" cy="100"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 60, 15)">
                  <line xmlns="http://www.w3.org/2000/svg" y2="0" y1="30" stroke="#000" x2="60" stroke-width="2" x1="60"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 40, 145)">
                  <line xmlns="http://www.w3.org/2000/svg" y2="130" y1="160" stroke="#000" x2="40" stroke-width="2" x1="40"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 80, 145)">
                  <line xmlns="http://www.w3.org/2000/svg" y2="130" y1="160" stroke="#000" x2="80" stroke-width="2" x1="80"/>
              </g>
          </g>
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
      description: 'Interruptor',
      category: 'proteccion',
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" style="background: rgba(255, 255, 255, 0);">
          <defs xmlns="http://www.w3.org/2000/svg"/>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 30, 40)">
                  <circle xmlns="http://www.w3.org/2000/svg" stroke="#000" stroke-width="1" r="4" fill="#000" cx="30" cy="40"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 90, 40)">
                  <circle xmlns="http://www.w3.org/2000/svg" stroke="#000" stroke-width="1" r="4" fill="#000" cx="90" cy="40"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 15, 40)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="40" stroke="#000" y2="40" stroke-width="2" x1="0" x2="30"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 60, 30)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="40" stroke="#000" y2="20" stroke-width="2" x1="30" x2="90"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 105, 40)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="40" stroke="#000" y2="40" stroke-width="2" x1="90" x2="120"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 60, 35)">
                  <rect xmlns="http://www.w3.org/2000/svg" x="20" y="10" stroke="#000" stroke-width="2" fill="rgba(255, 255, 255, 0)" width="80" fill-opacity="0" height="50"/>
                  <g xmlns="http://www.w3.org/2000/svg"/>
              </g>
          </g>
      </svg>`,
      handles: JSON.stringify([
        {
          "id": "left",
          "type": "source",
          "x": 0,
          "y": 40
        },
        {
          "id": "right",
          "type": "target",
          "x": 120,
          "y": 40
        }
      ])
    },
    {
      name: 'Interruptor Extraido',
      description: 'Interruptor',
      category: 'proteccion',
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" style="background: rgba(255, 255, 255, 0);">
          <defs xmlns="http://www.w3.org/2000/svg"/>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 100, 46)">
                  <rect xmlns="http://www.w3.org/2000/svg" x="60" y="21" stroke="#000" stroke-width="2" fill="rgba(255, 255, 255, 0)" width="80" height="50"/>
                  <g xmlns="http://www.w3.org/2000/svg"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 70, 50)">
                  <circle xmlns="http://www.w3.org/2000/svg" stroke="#000" stroke-width="1" r="4" fill="#000" cx="70" cy="50"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 130, 50)">
                  <circle xmlns="http://www.w3.org/2000/svg" stroke="#000" stroke-width="1" r="4" fill="#000" cx="130" cy="50"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 15, 100)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="100" stroke="#000" y2="100" stroke-width="2" x1="0" x2="30"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 100, 40)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="50" stroke="#000" y2="30" stroke-width="2" x1="70" x2="130"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 187, 100)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="100" stroke="#000" y2="100" stroke-width="2" x1="172" x2="202"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 50, 100)">
                  <circle xmlns="http://www.w3.org/2000/svg" stroke="#000" stroke-width="2" r="20" fill="rgba(255, 255, 255, 0)" cx="50" fill-opacity="0" cy="100"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 152, 100)">
                  <circle xmlns="http://www.w3.org/2000/svg" stroke="#000" stroke-width="2" r="20" fill="rgba(255, 255, 255, 0)" cx="152" fill-opacity="0" cy="100"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 100, 97.5)">
                  <rect xmlns="http://www.w3.org/2000/svg" x="40" y="75" stroke="#ffffff" stroke-width="2" fill="#ffffff" width="120" fill-opacity="1" height="45"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 55, 50)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="50" stroke="#000" y2="50" stroke-width="2" x1="40" x2="70"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 145, 50)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="50" stroke="#000" y2="50" stroke-width="2" x1="130" x2="160"/>
              </g>
          </g>
      </svg>`,
      handles: JSON.stringify([
        {
          "id": "left",
          "type": "source",
          "x": 0,
          "y": 100
        },
        {
          "id": "right",
          "type": "target",
          "x": 200,
          "y": 100
        }
      ])
    },
    {
      name: 'Seccionador',
      description: 'Seccionador de línea',
      category: 'proteccion',
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" style="background: rgba(255, 255, 255, 0);">
          <defs xmlns="http://www.w3.org/2000/svg"/>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 30, 40)">
                  <circle xmlns="http://www.w3.org/2000/svg" stroke="#000" stroke-width="1" r="4" fill="#000" cx="30" cy="40"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 90, 40)">
                  <circle xmlns="http://www.w3.org/2000/svg" stroke="#000" stroke-width="1" r="4" fill="#000" cx="90" cy="40"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 15, 40)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="40" stroke="#000" y2="40" stroke-width="2" x1="0" x2="30"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 60, 30)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="40" stroke="#000" y2="20" stroke-width="2" x1="30" x2="90"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 105, 40)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="40" stroke="#000" y2="40" stroke-width="2" x1="90" x2="120"/>
              </g>
          </g>
      </svg>`,
      handles: JSON.stringify([
        {
          "id": "left",
          "type": "source",
          "x": 0,
          "y": 40
        },
        {
          "id": "right",
          "type": "target",
          "x": 120,
          "y": 40
        }
      ])
    }
  ];

  // Infraestructura
  const infraestructura = [
    {
      name: 'Barra Simple',
      description: 'Barras de conexión',
      category: 'infraestructura',
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" style="background: rgba(255, 255, 255, 0);" viewBox="0 0 200 200">
          <defs xmlns="http://www.w3.org/2000/svg"/>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 39.5, 100)">
                  <rect xmlns="http://www.w3.org/2000/svg" x="37.5" height="200" fill="#000" stroke-width="1" y="0" width="4" stroke="#000"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 120, 100)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="100" x2="200" stroke-width="2" x1="40" y2="100" stroke="#000"/>.
                  <g xmlns="http://www.w3.org/2000/svg"/>
              </g>
          </g>
      </svg>`,
      handles: JSON.stringify([
        {
          "id": "h_1756826687664",
          "type": "target",
          "x": 40,
          "y": 200
        },
        {
          "id": "h_1756829757274",
          "type": "source",
          "x": 40,
          "y": 0
        },
        {
          "id": "h_1756829764787",
          "type": "target",
          "x": 200,
          "y": 100
        }
      ])
    },
    {
      name: 'Barra Doble',
      description: 'Barras de conexión',
      category: 'infraestructura',
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" style="background: rgba(255, 255, 255, 0);">
          <defs xmlns="http://www.w3.org/2000/svg"/>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 39.5, 100)">
                  <rect xmlns="http://www.w3.org/2000/svg" x="37.5" y="0" width="4" height="200" fill="#000" stroke="#000" stroke-width="1"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 79.5, 100)">
                  <rect xmlns="http://www.w3.org/2000/svg" x="77.5" y="0" width="4" height="200" fill="#000" stroke="#000" stroke-width="1"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 120, 40)">
                  <line xmlns="http://www.w3.org/2000/svg" y2="40" y1="40" stroke="#000" x2="200" stroke-width="2" x1="40"/>
                  <g xmlns="http://www.w3.org/2000/svg"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 139, 160)">
                  <line xmlns="http://www.w3.org/2000/svg" y2="160" y1="160" stroke="#000" x2="200" stroke-width="2" x1="78"/>
              </g>
          </g>
      </svg>`,
      handles: JSON.stringify([
        {
          "id": "h_1756826687664",
          "type": "target",
          "x": 40,
          "y": 200
        },
        {
          "id": "h_1756826687995",
          "type": "source",
          "x": 40,
          "y": 0
        },
        {
          "id": "h_1756826670572",
          "type": "target",
          "x": 80,
          "y": 200
        },
        {
          "id": "h_1756826671210",
          "type": "source",
          "x": 80,
          "y": 0
        },
        {
          "id": "r_top",
          "type": "target",
          "x": 200,
          "y": 40
        },
        {
          "id": "b_right",
          "type": "target",
          "x": 200,
          "y": 160
        }
      ])
    },
    {
      name: 'Barra Triple',
      description: 'Barras de conexión',
      category: 'infraestructura',
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" style="background: rgba(255, 255, 255, 0);" viewBox="0 0 200 200">
          <defs xmlns="http://www.w3.org/2000/svg"/>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 20.5, 100)">
                  <rect xmlns="http://www.w3.org/2000/svg" x="18.5" height="200" fill="#000" stroke-width="1" y="0" width="4" stroke="#000"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 60.5, 100)">
                  <rect xmlns="http://www.w3.org/2000/svg" x="58.5" height="200" fill="#000" stroke-width="1" y="0" width="4" stroke="#000"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 100, 100)">
                  <rect xmlns="http://www.w3.org/2000/svg" x="98" height="200" fill="#000" stroke-width="1" y="0" width="4" stroke="#000"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 150, 160)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="160" x2="200" stroke-width="2" x1="100" y2="160" stroke="#000"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 110, 40)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="40" x2="200" stroke-width="2" x1="20" y2="40" stroke="#000"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 130, 100)">
                  <line xmlns="http://www.w3.org/2000/svg" y1="100" x2="200" stroke-width="2" x1="60" y2="100" stroke="#000"/>
                  <g xmlns="http://www.w3.org/2000/svg"/>
              </g>
          </g>
      </svg>`,
      handles: JSON.stringify([
        {
          "id": "h_1756826687664",
          "type": "target",
          "x": 20,
          "y": 200
        },
        {
          "id": "h_1756830053495",
          "type": "source",
          "x": 20,
          "y": 0
        },
        {
          "id": "h_1756830129231",
          "type": "target",
          "x": 60,
          "y": 200
        },
        {
          "id": "h_1756826687995",
          "type": "source",
          "x": 60,
          "y": 0
        },
        {
          "id": "h_1756826671210",
          "type": "source",
          "x": 100,
          "y": 0
        },
        {
          "id": "r_top",
          "type": "target",
          "x": 200,
          "y": 40
        },
        {
          "id": "h_1756826670572",
          "type": "target",
          "x": 100,
          "y": 200
        },
        {
          "id": "b_right",
          "type": "target",
          "x": 200,
          "y": 160
        },
        {
          "id": "h_1756830118484",
          "type": "target",
          "x": 200,
          "y": 100
        }
      ])
    }
  ];

  // Seguridad
  const seguridad = [
    {
      name: 'Candado',
      description: 'Dispositivo de bloqueo',
      category: 'seguridad',
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" style="background: rgba(255, 255, 255, 0);">
          <defs xmlns="http://www.w3.org/2000/svg"/>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 30, 20)">
                  <circle xmlns="http://www.w3.org/2000/svg" stroke="#000" r="14" cy="20" cx="30" fill="rgba(255, 255, 255, 0)" stroke-width="2"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 30, 43.5)">
                  <rect xmlns="http://www.w3.org/2000/svg" height="25" stroke="#000" fill="#62a0ea" stroke-width="2" y="31" width="40" x="10"/>
                  <g xmlns="http://www.w3.org/2000/svg"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 30, 24)">
                  <rect xmlns="http://www.w3.org/2000/svg" height="10" stroke="#ffffff" fill="#ffffff" stroke-width="2" y="19" width="40" x="10" fill-opacity="1"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 16, 24.5)">
                  <line xmlns="http://www.w3.org/2000/svg" stroke="#000" y1="32" stroke-width="2" y2="17" x1="16" x2="16"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 44, 24)">
                  <line xmlns="http://www.w3.org/2000/svg" stroke="#000" y1="30" stroke-width="2" y2="18" x1="44" x2="44"/>
              </g>
          </g>
      </svg>`,
      handles: "[]"
    },
    {
      name: 'Bloqueo',
      description: 'Zona de bloqueo',
      category: 'seguridad',
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" style="background: rgba(255, 255, 255, 0);" viewBox="0 0 80 80">
          <defs xmlns="http://www.w3.org/2000/svg"/>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 40, 40)">
                  <circle xmlns="http://www.w3.org/2000/svg" cx="40" stroke="#3584e4" stroke-width="2" cy="40" fill="rgba(255, 255, 255, 0)" r="38"/>
              </g>
          </g>
      </svg>`,
      handles: "[]"
    },
    {
      name: 'Puesta a Tierra',
      description: 'Conexión a tierra',
      category: 'seguridad',
      svg: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" style="background: rgba(255, 255, 255, 0);">
          <defs xmlns="http://www.w3.org/2000/svg"/>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 20, 10)">
                  <line xmlns="http://www.w3.org/2000/svg" y2="20" y1="0" stroke="#000" x2="20" stroke-width="2" x1="20"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 20, 20)">
                  <line xmlns="http://www.w3.org/2000/svg" y2="20" y1="20" stroke="#000" x2="40" stroke-width="2" x1="0"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 20, 30)">
                  <line xmlns="http://www.w3.org/2000/svg" y2="30" y1="30" stroke="#000" x2="28" stroke-width="2" x1="12"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 20, 35)">
                  <line xmlns="http://www.w3.org/2000/svg" y2="35" y1="35" stroke="#000" x2="24" stroke-width="2" x1="16"/>
                  <g xmlns="http://www.w3.org/2000/svg"/>
              </g>
          </g>
          <g xmlns="http://www.w3.org/2000/svg">
              <g xmlns="http://www.w3.org/2000/svg" transform="rotate(0, 20, 25)">
                  <line xmlns="http://www.w3.org/2000/svg" y2="25" y1="25" stroke="#000" x2="36" stroke-width="2" x1="4"/>
              </g>
          </g>
      </svg>`,
      handles: JSON.stringify([
        { id: 'top', x: 20, y: 0, type: 'source' }
      ])
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