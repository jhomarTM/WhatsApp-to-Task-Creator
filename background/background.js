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
    
    case 'AI_AUTOCOMPLETE':
      return await aiAutocomplete(message.messageText, message.sender);
    
    default:
      return { success: false, error: 'Tipo de mensaje desconocido' };
  }
}

// ===== OPENAI AUTOCOMPLETE =====
async function aiAutocomplete(messageText, sender) {
  const config = await chrome.storage.local.get(['openaiKey']);
  
  console.log('🤖 OpenAI Key encontrada:', config.openaiKey ? `${config.openaiKey.substring(0, 20)}...` : 'NO');
  
  if (!config.openaiKey) {
    throw new Error('OpenAI no configurado. Ve al popup de la extensión para agregar tu API Key.');
  }
  
  // Limpiar la key por si tiene espacios
  const apiKey = config.openaiKey.trim();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const prompt = `Analiza este mensaje de WhatsApp y extrae información para crear una tarea.

MENSAJE: "${messageText}"
REMITENTE: ${sender || 'Desconocido'}
FECHA ACTUAL: ${todayStr}

Responde SOLO con un JSON válido (sin markdown, sin explicaciones) con estos campos:
{
  "title": "título corto y claro de la tarea (máx 80 caracteres)",
  "description": "descripción detallada si hay más contexto, o vacío",
  "solicita": "nombre de quien solicita (usar el remitente si aplica)",
  "responsable": "nombre del responsable si se menciona, o vacío",
  "dueDate": "fecha en formato YYYY-MM-DD si se menciona (ej: 'para el viernes' = próximo viernes), o null",
  "priority": "Alta, Media o Baja según urgencia del mensaje",
  "tipoTarea": "uno de: Solicitud de información, Solicitud de cambio, Bug/Error, Mejora, Otro"
}

Reglas:
- Si dice "urgente", "ASAP", "para hoy" → prioridad Alta
- Si menciona fechas relativas como "mañana", "próximo lunes", calcula la fecha real
- El título debe ser accionable (empezar con verbo si es posible)
- Si no hay información clara para un campo, usa null o string vacío`;

  try {
    console.log('🤖 Llamando a OpenAI con key:', apiKey.substring(0, 25) + '...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un asistente que extrae información de mensajes para crear tareas. Responde SOLO con JSON válido, sin markdown ni explicaciones.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ OpenAI Error Response:', error);
      
      if (response.status === 401) {
        throw new Error('API Key de OpenAI inválida o expirada. Verifica tu key en platform.openai.com');
      }
      throw new Error(error.error?.message || `Error ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    // Parsear JSON (limpiar si viene con markdown)
    let jsonContent = content;
    if (content.startsWith('```')) {
      jsonContent = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    
    const suggestions = JSON.parse(jsonContent);
    console.log('🤖 Sugerencias de IA:', suggestions);
    
    return { success: true, suggestions };
    
  } catch (error) {
    console.error('❌ Error de OpenAI:', error);
    throw error;
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
