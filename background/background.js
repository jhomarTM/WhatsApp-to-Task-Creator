/**
 * Background Service Worker
 * Maneja OAuth con Notion y comunicación con la API
 */

// Configuración de Notion OAuth
const NOTION_CONFIG = {
  clientId: 'YOUR_NOTION_CLIENT_ID',
  clientSecret: 'YOUR_NOTION_CLIENT_SECRET',
  redirectUri: 'https://YOUR_EXTENSION_ID.chromiumapp.org/',
  authUrl: 'https://api.notion.com/v1/oauth/authorize',
  tokenUrl: 'https://api.notion.com/v1/oauth/token',
  apiBase: 'https://api.notion.com/v1'
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
    const result = await chrome.storage.local.get(['notionToken', 'notionWorkspace']);
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
    case 'NOTION_AUTH':
      return await initiateOAuth();
    
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
    
    case 'GET_USERS':
      return await getWorkspaceUsers();
    
    default:
      throw new Error(`Tipo de mensaje desconocido: ${message.type}`);
  }
}

// Iniciar OAuth con Notion
async function initiateOAuth() {
  try {
    const state = generateRandomState();
    const authUrl = `${NOTION_CONFIG.authUrl}?` + new URLSearchParams({
      client_id: NOTION_CONFIG.clientId,
      redirect_uri: chrome.identity.getRedirectURL(),
      response_type: 'code',
      owner: 'user',
      state: state
    }).toString();

    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    // Extraer código de autorización
    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');

    if (returnedState !== state) {
      throw new Error('Estado de OAuth no coincide');
    }

    if (!code) {
      throw new Error('No se recibió código de autorización');
    }

    // Intercambiar código por token
    const tokenResponse = await fetch(NOTION_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${NOTION_CONFIG.clientId}:${NOTION_CONFIG.clientSecret}`)
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: chrome.identity.getRedirectURL()
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(error.error || 'Error obteniendo token');
    }

    const tokenData = await tokenResponse.json();
    
    // Guardar token y workspace
    notionToken = tokenData.access_token;
    await chrome.storage.local.set({
      notionToken: tokenData.access_token,
      notionWorkspace: {
        id: tokenData.workspace_id,
        name: tokenData.workspace_name,
        icon: tokenData.workspace_icon
      },
      notionUser: {
        id: tokenData.owner?.user?.id,
        name: tokenData.owner?.user?.name,
        avatar: tokenData.owner?.user?.avatar_url
      }
    });

    return {
      success: true,
      workspace: tokenData.workspace_name
    };

  } catch (error) {
    console.error('Error en OAuth:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Verificar estado de autenticación
async function checkAuthStatus() {
  try {
    const result = await chrome.storage.local.get(['notionToken', 'notionWorkspace', 'notionUser']);
    
    if (!result.notionToken) {
      return { authenticated: false };
    }

    // Verificar que el token sigue siendo válido
    const response = await fetch(`${NOTION_CONFIG.apiBase}/users/me`, {
      headers: {
        'Authorization': `Bearer ${result.notionToken}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      // Token inválido, limpiar storage
      await chrome.storage.local.remove(['notionToken', 'notionWorkspace', 'notionUser']);
      return { authenticated: false };
    }

    return {
      authenticated: true,
      workspace: result.notionWorkspace,
      user: result.notionUser
    };

  } catch (error) {
    console.error('Error verificando auth:', error);
    return { authenticated: false, error: error.message };
  }
}

// Desconectar de Notion
async function disconnectNotion() {
  try {
    await chrome.storage.local.remove(['notionToken', 'notionWorkspace', 'notionUser', 'lastDatabase']);
    notionToken = null;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Obtener bases de datos del workspace
async function getDatabases() {
  const token = await getToken();
  if (!token) {
    throw new Error('No autenticado');
  }

  try {
    const response = await fetch(`${NOTION_CONFIG.apiBase}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
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
      const error = await response.json();
      throw new Error(error.message || 'Error obteniendo bases de datos');
    }

    const data = await response.json();
    
    // Formatear respuesta
    const databases = data.results.map(db => ({
      id: db.id,
      title: db.title?.[0]?.plain_text || 'Sin título',
      icon: db.icon?.emoji || db.icon?.external?.url || '📋',
      url: db.url
    }));

    return { success: true, databases };

  } catch (error) {
    console.error('Error obteniendo DBs:', error);
    throw error;
  }
}

// Obtener esquema de una base de datos
async function getDatabaseSchema(databaseId) {
  const token = await getToken();
  if (!token) {
    throw new Error('No autenticado');
  }

  try {
    const response = await fetch(`${NOTION_CONFIG.apiBase}/databases/${databaseId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error obteniendo esquema');
    }

    const data = await response.json();
    
    // Extraer propiedades relevantes
    const properties = {};
    for (const [name, prop] of Object.entries(data.properties)) {
      properties[name] = {
        id: prop.id,
        type: prop.type,
        name: name
      };

      // Agregar opciones para select/multi_select
      if (prop.type === 'select' && prop.select?.options) {
        properties[name].options = prop.select.options;
      }
      if (prop.type === 'multi_select' && prop.multi_select?.options) {
        properties[name].options = prop.multi_select.options;
      }
      if (prop.type === 'status' && prop.status?.options) {
        properties[name].options = prop.status.options;
      }
    }

    return { success: true, properties, title: data.title?.[0]?.plain_text };

  } catch (error) {
    console.error('Error obteniendo esquema:', error);
    throw error;
  }
}

// Crear tarea en Notion
async function createTask(task) {
  const token = await getToken();
  if (!token) {
    throw new Error('No autenticado');
  }

  try {
    // Construir propiedades de la página
    const properties = {};

    // Título (requerido)
    if (task.title) {
      properties[task.titleProperty || 'Name'] = {
        title: [{ text: { content: task.title } }]
      };
    }

    // Fecha límite
    if (task.dueDate) {
      properties[task.dateProperty || 'Date'] = {
        date: { start: task.dueDate }
      };
    }

    // Prioridad (select)
    if (task.priority) {
      properties[task.priorityProperty || 'Priority'] = {
        select: { name: task.priority }
      };
    }

    // Etiquetas (multi_select)
    if (task.tags && task.tags.length > 0) {
      properties[task.tagsProperty || 'Tags'] = {
        multi_select: task.tags.map(tag => ({ name: tag }))
      };
    }

    // Asignado (people)
    if (task.assignee) {
      properties[task.assigneeProperty || 'Assignee'] = {
        people: [{ id: task.assignee }]
      };
    }

    // Crear página
    const body = {
      parent: { database_id: task.databaseId },
      properties: properties
    };

    // Agregar descripción como contenido de la página
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
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error creando tarea');
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

// Obtener usuarios del workspace
async function getWorkspaceUsers() {
  const token = await getToken();
  if (!token) {
    throw new Error('No autenticado');
  }

  try {
    const response = await fetch(`${NOTION_CONFIG.apiBase}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error obteniendo usuarios');
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

// Helpers
async function getToken() {
  if (notionToken) return notionToken;
  const result = await chrome.storage.local.get(['notionToken']);
  notionToken = result.notionToken;
  return notionToken;
}

function generateRandomState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

