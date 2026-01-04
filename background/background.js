/**
 * Background Service Worker
 * Maneja Internal Integration Token con Notion y comunicación con la API
 * 
 * Arquitectura:
 * - Usa Internal Integration Token (NO OAuth)
 * - Token se almacena localmente en chrome.storage
 * - Todas las requests incluyen header Notion-Version: 2022-06-28
 * - El bot solo ve páginas/databases compartidas explícitamente
 */

// Configuración de Notion API
const NOTION_CONFIG = {
  apiBase: 'https://api.notion.com/v1',
  apiVersion: '2022-06-28'
};

// Estado de la extensión
let notionToken = null;

// Inicializar al arrancar
chrome.runtime.onInstalled.addListener(async () => {
  console.log('WhatsApp Task to Notion instalado');
  await loadStoredToken();
});

// Cargar token almacenado
async function loadStoredToken() {
  try {
    const result = await chrome.storage.local.get(['notionToken']);
    if (result.notionToken) {
      notionToken = result.notionToken;
      console.log('Token de Notion cargado');
    }
  } catch (error) {
    console.error('Error cargando token:', error);
  }
}

// Escuchar mensajes de otros componentes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true; // Mantener el canal abierto para respuestas async
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'SET_NOTION_TOKEN':
      return await setNotionToken(message.token);
    
    case 'CHECK_AUTH':
      return await checkAuthStatus();
    
    case 'DISCONNECT':
      return await disconnectNotion();
    
    case 'GET_DATABASES':
      return await getDatabases();
    
    case 'GET_DATABASE_SCHEMA':
      return await getDatabaseSchema(message.databaseId);
    
    case 'CREATE_TASK':
      return await createTask(message.task);
    
    case 'ADD_CONTENT_TO_PAGE':
      return await addContentToPage(message.pageId, message.blocks);
    
    case 'GET_USERS':
      return await getWorkspaceUsers();
    
    default:
      throw new Error(`Tipo de mensaje desconocido: ${message.type}`);
  }
}

/**
 * Establecer Internal Integration Token
 * El token debe obtenerse de: https://www.notion.so/my-integrations
 * Formato: secret_xxx...
 */
async function setNotionToken(token) {
  try {
    if (!token || typeof token !== 'string' || !token.startsWith('secret_')) {
      throw new Error('Token inválido. Debe comenzar con "secret_"');
    }

    // Verificar que el token es válido haciendo una request mínima
    const testResponse = await fetch(`${NOTION_CONFIG.apiBase}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_CONFIG.apiVersion
      }
    });

    if (!testResponse.ok) {
      const errorData = await testResponse.json().catch(() => ({}));
      if (testResponse.status === 401) {
        throw new Error('Token inválido o expirado');
      }
      if (testResponse.status === 403) {
        throw new Error('Token sin permisos suficientes');
      }
      throw new Error(errorData.message || `Error verificando token: ${testResponse.status}`);
    }

    // Token válido, guardarlo
    notionToken = token;
    await chrome.storage.local.set({ notionToken: token });

    return {
      success: true,
      message: 'Token configurado correctamente'
    };

  } catch (error) {
    console.error('Error configurando token:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verificar estado de autenticación
 * Hace una request mínima a /users/me para validar el token
 */
async function checkAuthStatus() {
  try {
    const result = await chrome.storage.local.get(['notionToken']);
    
    if (!result.notionToken) {
      return { authenticated: false };
    }

    // Verificar que el token sigue siendo válido
    const response = await fetch(`${NOTION_CONFIG.apiBase}/users/me`, {
      headers: {
        'Authorization': `Bearer ${result.notionToken}`,
        'Notion-Version': NOTION_CONFIG.apiVersion
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Token inválido o sin permisos, limpiar storage
      if (response.status === 401 || response.status === 403) {
        await chrome.storage.local.remove(['notionToken', 'lastDatabase']);
        notionToken = null;
        return { 
          authenticated: false, 
          error: response.status === 401 ? 'Token inválido' : 'Token sin permisos'
        };
      }
      
      throw new Error(errorData.message || `Error verificando token: ${response.status}`);
    }

    const userData = await response.json();

    return {
      authenticated: true,
      botId: userData.id,
      botName: userData.name || 'Notion Bot'
    };

  } catch (error) {
    console.error('Error verificando auth:', error);
    return { authenticated: false, error: error.message };
  }
}

/**
 * Desconectar de Notion
 * Elimina el token almacenado
 */
async function disconnectNotion() {
  try {
    await chrome.storage.local.remove(['notionToken', 'lastDatabase']);
    notionToken = null;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Buscar bases de datos accesibles
 * Usa POST /v1/search con filter para obtener solo databases
 * IMPORTANTE: Solo retorna databases que fueron compartidas con la integración
 */
async function getDatabases() {
  const token = await getToken();
  if (!token) {
    throw new Error('No autenticado. Configura tu Internal Integration Token.');
  }

  try {
    const response = await fetch(`${NOTION_CONFIG.apiBase}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_CONFIG.apiVersion,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'object',
          value: 'database'
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time'
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        throw new Error('Token inválido. Verifica tu Internal Integration Token.');
      }
      if (response.status === 403) {
        throw new Error('Token sin permisos. Asegúrate de compartir las bases de datos con la integración.');
      }
      if (response.status === 404) {
        throw new Error('Endpoint no encontrado. Verifica la versión de la API.');
      }
      
      throw new Error(errorData.message || `Error obteniendo bases de datos: ${response.status}`);
    }

    const data = await response.json();
    
    // Formatear respuesta
    const databases = data.results.map(db => ({
      id: db.id,
      title: extractTitle(db.title) || 'Sin título',
      icon: extractIcon(db.icon) || '📋',
      url: db.url
    }));

    return { success: true, databases };

  } catch (error) {
    console.error('Error obteniendo DBs:', error);
    throw error;
  }
}

/**
 * Obtener esquema de una base de datos
 * GET /v1/databases/{database_id}
 * Retorna todas las propiedades y sus tipos para construir formularios dinámicos
 */
async function getDatabaseSchema(databaseId) {
  const token = await getToken();
  if (!token) {
    throw new Error('No autenticado. Configura tu Internal Integration Token.');
  }

  if (!databaseId) {
    throw new Error('databaseId es requerido');
  }

  try {
    const response = await fetch(`${NOTION_CONFIG.apiBase}/databases/${databaseId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_CONFIG.apiVersion
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        throw new Error('Token inválido');
      }
      if (response.status === 403) {
        throw new Error('Sin acceso a esta base de datos. Compártela con la integración.');
      }
      if (response.status === 404) {
        throw new Error('Base de datos no encontrada');
      }
      
      throw new Error(errorData.message || `Error obteniendo esquema: ${response.status}`);
    }

    const data = await response.json();
    
    // Extraer propiedades relevantes dinámicamente
    const properties = {};
    for (const [name, prop] of Object.entries(data.properties)) {
      properties[name] = {
        id: prop.id,
        type: prop.type,
        name: name
      };

      // Agregar opciones para select/multi_select/status
      if (prop.type === 'select' && prop.select?.options) {
        properties[name].options = prop.select.options.map(opt => ({
          id: opt.id,
          name: opt.name,
          color: opt.color
        }));
      }
      if (prop.type === 'multi_select' && prop.multi_select?.options) {
        properties[name].options = prop.multi_select.options.map(opt => ({
          id: opt.id,
          name: opt.name,
          color: opt.color
        }));
      }
      if (prop.type === 'status' && prop.status?.options) {
        properties[name].options = prop.status.options.map(opt => ({
          id: opt.id,
          name: opt.name,
          color: opt.color
        }));
        properties[name].groups = prop.status.groups;
      }
    }

    return { 
      success: true, 
      properties, 
      title: extractTitle(data.title),
      id: data.id
    };

  } catch (error) {
    console.error('Error obteniendo esquema:', error);
    throw error;
  }
}

/**
 * Crear una página dentro de una base de datos
 * POST /v1/pages
 * 
 * Construye propiedades dinámicamente basándose en el schema de la DB
 * Soporta: title, date, select, multi_select, rich_text, checkbox, etc.
 */
async function createTask(task) {
  const token = await getToken();
  if (!token) {
    throw new Error('No autenticado. Configura tu Internal Integration Token.');
  }

  if (!task.databaseId) {
    throw new Error('databaseId es requerido');
  }

  if (!task.title) {
    throw new Error('El título es requerido');
  }

  try {
    // Obtener schema de la DB para construir propiedades correctamente
    const schemaResponse = await getDatabaseSchema(task.databaseId);
    if (!schemaResponse.success) {
      throw new Error('No se pudo obtener el esquema de la base de datos');
    }

    const schema = schemaResponse.properties;
    
    // Construir propiedades dinámicamente
    const properties = {};

    // Buscar propiedad de título (title type)
    const titleProperty = Object.keys(schema).find(name => schema[name].type === 'title');
    if (!titleProperty) {
      throw new Error('La base de datos no tiene una propiedad de tipo "title"');
    }
    
    // Título (requerido)
    properties[titleProperty] = {
      title: [{ text: { content: task.title } }]
    };

    // Fecha límite (buscar propiedad date)
    if (task.dueDate) {
      const dateProperty = task.dateProperty || Object.keys(schema).find(name => 
        schema[name].type === 'date'
      );
      if (dateProperty && schema[dateProperty]) {
        properties[dateProperty] = {
          date: { start: task.dueDate }
        };
      }
    }

    // Prioridad (select)
    if (task.priority) {
      const priorityProperty = task.priorityProperty || Object.keys(schema).find(name => 
        schema[name].type === 'select' || schema[name].type === 'status'
      );
      if (priorityProperty && schema[priorityProperty]) {
        const propType = schema[priorityProperty].type;
        if (propType === 'select') {
          properties[priorityProperty] = {
            select: { name: task.priority }
          };
        } else if (propType === 'status') {
          properties[priorityProperty] = {
            status: { name: task.priority }
          };
        }
      }
    }

    // Etiquetas (multi_select)
    if (task.tags && task.tags.length > 0) {
      const tagsProperty = task.tagsProperty || Object.keys(schema).find(name => 
        schema[name].type === 'multi_select'
      );
      if (tagsProperty && schema[tagsProperty]) {
        properties[tagsProperty] = {
          multi_select: task.tags.map(tag => ({ name: tag }))
        };
      }
    }

    // Crear página con propiedades
    const body = {
      parent: { database_id: task.databaseId },
      properties: properties
    };

    // Agregar descripción como contenido de la página usando blocks
    if (task.description) {
      body.children = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: task.description } }]
          }
        }
      ];
    }

    const response = await fetch(`${NOTION_CONFIG.apiBase}/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_CONFIG.apiVersion,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        throw new Error('Token inválido');
      }
      if (response.status === 403) {
        throw new Error('Sin permisos para crear páginas en esta base de datos');
      }
      if (response.status === 404) {
        throw new Error('Base de datos no encontrada');
      }
      
      // Errores de validación de propiedades
      if (response.status === 400) {
        const errorMsg = errorData.message || 'Error de validación';
        throw new Error(`Error de validación: ${errorMsg}`);
      }
      
      throw new Error(errorData.message || `Error creando tarea: ${response.status}`);
    }

    const data = await response.json();

    // Guardar última base de datos usada
    await chrome.storage.local.set({ lastDatabase: task.databaseId });

    return {
      success: true,
      pageId: data.id,
      url: data.url
    };

  } catch (error) {
    console.error('Error creando tarea:', error);
    throw error;
  }
}

/**
 * Agregar contenido adicional a una página existente
 * PATCH /v1/blocks/{block_id}/children
 * 
 * Útil para agregar texto largo después de crear la página inicial
 */
async function addContentToPage(pageId, blocks) {
  const token = await getToken();
  if (!token) {
    throw new Error('No autenticado. Configura tu Internal Integration Token.');
  }

  if (!pageId) {
    throw new Error('pageId es requerido');
  }

  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    throw new Error('blocks debe ser un array no vacío');
  }

  try {
    const response = await fetch(`${NOTION_CONFIG.apiBase}/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_CONFIG.apiVersion,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        children: blocks
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        throw new Error('Token inválido');
      }
      if (response.status === 403) {
        throw new Error('Sin permisos para modificar esta página');
      }
      if (response.status === 404) {
        throw new Error('Página no encontrada');
      }
      
      throw new Error(errorData.message || `Error agregando contenido: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      blocks: data.results
    };

  } catch (error) {
    console.error('Error agregando contenido:', error);
    throw error;
  }
}

/**
 * Obtener usuarios del workspace
 * GET /v1/users
 * 
 * Nota: Con Internal Integration, esto solo retorna el bot mismo
 * Para obtener usuarios reales se necesita OAuth
 */
async function getWorkspaceUsers() {
  const token = await getToken();
  if (!token) {
    throw new Error('No autenticado. Configura tu Internal Integration Token.');
  }

  try {
    const response = await fetch(`${NOTION_CONFIG.apiBase}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_CONFIG.apiVersion
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        throw new Error('Token inválido');
      }
      if (response.status === 403) {
        throw new Error('Sin permisos para obtener usuarios');
      }
      
      throw new Error(errorData.message || `Error obteniendo usuarios: ${response.status}`);
    }

    const data = await response.json();
    
    const users = data.results
      .filter(user => user.type === 'person')
      .map(user => ({
        id: user.id,
        name: user.name,
        avatar: user.avatar_url,
        email: user.person?.email
      }));

    return { success: true, users };

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    throw error;
  }
}

// === Helpers ===

/**
 * Obtener token almacenado
 */
async function getToken() {
  if (notionToken) return notionToken;
  const result = await chrome.storage.local.get(['notionToken']);
  notionToken = result.notionToken;
  return notionToken;
}

/**
 * Extraer título de un array de rich text
 */
function extractTitle(titleArray) {
  if (!titleArray || !Array.isArray(titleArray) || titleArray.length === 0) {
    return null;
  }
  return titleArray.map(t => t.plain_text || '').join('');
}

/**
 * Extraer icono de una base de datos
 */
function extractIcon(icon) {
  if (!icon) return null;
  if (icon.type === 'emoji') return icon.emoji;
  if (icon.type === 'external') return icon.external?.url;
  if (icon.type === 'file') return icon.file?.url;
  return null;
}

