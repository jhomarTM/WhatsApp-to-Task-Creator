/**
 * Background Service Worker - WhatsApp Task Creator
 * Maneja el menú contextual e integración con Notion
 */

// ===== CONFIGURACIÓN =====
const NOTION_API_VERSION = '2022-06-28';

// Mapeo de campos del formulario a propiedades de Notion
const FIELD_MAPPING = {
  title: 'Nombre de tarea',
  description: 'Descripción',
  solicita: 'Solicita',
  responsable: 'Responsable',
  dueDate: 'Fecha límite',
  priority: 'Prioridad',
  estado: 'Estado',
  tipoTarea: 'Tipo de tarea'
};

// ===== INSTALACIÓN =====
chrome.runtime.onInstalled.addListener(() => {
  console.log('📋 WhatsApp Task Creator instalado');
  
  chrome.contextMenus.create({
    id: 'convertToTask',
    title: '📋 Convertir a tarea',
    contexts: ['selection'],
    documentUrlPatterns: ['https://web.whatsapp.com/*']
  });
});

// ===== MENÚ CONTEXTUAL =====
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'convertToTask') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'OPEN_TASK_SIDEBAR',
      text: info.selectionText
    });
  }
});

// ===== MENSAJES =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch(err => sendResponse({ success: false, error: err.message }));
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'CREATE_NOTION_TASK':
      return await createNotionTask(message.task);
    
    case 'GET_TASKS':
      const result = await chrome.storage.local.get(['tasks']);
      return { tasks: result.tasks || [] };
    
    case 'SAVE_CONFIG':
      const configData = { 
        notionToken: message.token,
        notionDatabaseId: message.databaseId 
      };
      if (message.openaiKey) {
        configData.openaiKey = message.openaiKey;
      }
      await chrome.storage.local.set(configData);
      return { success: true };
    
    case 'GET_CONFIG':
      const config = await chrome.storage.local.get(['notionToken', 'notionDatabaseId']);
      return { 
        success: true, 
        configured: !!(config.notionToken && config.notionDatabaseId),
        databaseId: config.notionDatabaseId
      };
    
    case 'TEST_CONNECTION':
      return await testNotionConnection();
    
    default:
      return { success: false, error: 'Tipo de mensaje desconocido' };
  }
}

// ===== OBTENER CONFIGURACIÓN =====
async function getNotionConfig() {
  const config = await chrome.storage.local.get(['notionToken', 'notionDatabaseId']);
  if (!config.notionToken || !config.notionDatabaseId) {
    throw new Error('Notion no configurado. Ve al popup de la extensión para configurar.');
  }
  return {
    token: config.notionToken,
    databaseId: config.notionDatabaseId
  };
}

// ===== NOTION API =====

async function createNotionTask(task) {
  console.log('📋 Creando tarea en Notion:', task);
  
  const config = await getNotionConfig();
  
  try {
    const properties = {};
    
    // Título
    properties[FIELD_MAPPING.title] = {
      title: [{ text: { content: task.title || 'Sin título' } }]
    };
    
    // Descripción
    if (task.description) {
      properties[FIELD_MAPPING.description] = {
        rich_text: [{ text: { content: task.description } }]
      };
    }
    
    // Fecha límite
    if (task.dueDate) {
      const dateValue = { start: task.dueDate };
      if (task.dueTime) {
        dateValue.start = `${task.dueDate}T${task.dueTime}:00`;
      }
      properties[FIELD_MAPPING.dueDate] = { date: dateValue };
    }
    
    // Solicita
    if (task.solicita) {
      properties[FIELD_MAPPING.solicita] = {
        rich_text: [{ text: { content: task.solicita } }]
      };
    }
    
    // Responsable
    if (task.responsable) {
      properties[FIELD_MAPPING.responsable] = {
        rich_text: [{ text: { content: task.responsable } }]
      };
    }
    
    // Prioridad
    if (task.priority) {
      properties[FIELD_MAPPING.priority] = {
        select: { name: task.priority }
      };
    }
    
    // Tipo de tarea
    if (task.tipoTarea) {
      properties[FIELD_MAPPING.tipoTarea] = {
        select: { name: task.tipoTarea }
      };
    }

    // Crear página
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Notion-Version': NOTION_API_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: config.databaseId },
        properties: properties,
        children: task.sourceMessage ? [
          {
            object: 'block',
            type: 'callout',
            callout: {
              icon: { type: 'emoji', emoji: '💬' },
              rich_text: [{ text: { content: 'Mensaje de WhatsApp' } }],
              color: 'gray_background'
            }
          },
          {
            object: 'block',
            type: 'quote',
            quote: {
              rich_text: [{ text: { content: task.sourceMessage.text || '' } }]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{
                text: { 
                  content: `De: ${task.sourceMessage.sender || 'Desconocido'} • ${task.sourceMessage.time || ''}`
                }
              }],
              color: 'gray'
            }
          }
        ] : []
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error de Notion:', error);
      throw new Error(error.message || `Error ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Tarea creada en Notion:', data.id);

    // Guardar localmente
    const stored = await chrome.storage.local.get(['tasks']);
    const tasks = stored.tasks || [];
    tasks.push({
      ...task,
      notionId: data.id,
      notionUrl: data.url,
      createdAt: new Date().toISOString()
    });
    await chrome.storage.local.set({ tasks });

    return { success: true, pageId: data.id, url: data.url };

  } catch (error) {
    console.error('❌ Error creando tarea:', error);
    throw error;
  }
}

async function testNotionConnection() {
  try {
    const config = await getNotionConfig();
    
    const response = await fetch(`https://api.notion.com/v1/databases/${config.databaseId}`, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Notion-Version': NOTION_API_VERSION
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message };
    }

    const data = await response.json();
    return {
      success: true,
      database: {
        title: data.title?.[0]?.plain_text || 'Sin título',
        properties: Object.keys(data.properties)
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
