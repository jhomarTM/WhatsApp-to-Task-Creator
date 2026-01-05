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
    
    case 'GET_NOTION_USERS':
      return await getNotionUsers();
    
    default:
      return { success: false, error: 'Tipo de mensaje desconocido' };
  }
}

// ===== OBTENER USUARIOS DE NOTION =====
async function getNotionUsers() {
  try {
    const config = await getNotionConfig();
    
    const response = await fetch('https://api.notion.com/v1/users', {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Notion-Version': NOTION_API_VERSION
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Error ${response.status}`);
    }

    const data = await response.json();
    
    // Filtrar solo personas (no bots)
    const users = data.results
      .filter(user => user.type === 'person')
      .map(user => ({
        id: user.id,
        name: user.name,
        email: user.person?.email || '',
        avatar: user.avatar_url
      }));
    
    console.log('👥 Usuarios de Notion:', users);
    return { success: true, users };
    
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    return { success: false, error: error.message };
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
  
  // Calcular fechas relativas
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  // Obtener el próximo día de la semana
  const daysOfWeek = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const currentDay = today.getDay();
  
  const prompt = `Eres un asistente experto en gestión de tareas. Analiza este mensaje de WhatsApp y extrae TODA la información relevante para crear una tarea completa y bien estructurada.

MENSAJE ORIGINAL:
"${messageText}"

CONTEXTO:
- Remitente: ${sender || 'Desconocido'}
- Fecha actual: ${todayStr} (${daysOfWeek[currentDay]})
- Mañana sería: ${tomorrow.toISOString().split('T')[0]}

INSTRUCCIONES DETALLADAS:

1. **TÍTULO** (obligatorio): 
   - Debe ser claro, específico y accionable
   - Empezar con un verbo en infinitivo cuando sea posible
   - Incluir el QUÉ se debe hacer
   - Máximo 100 caracteres pero ser descriptivo

2. **DESCRIPCIÓN** (importante):
   - Incluir TODOS los detalles del mensaje original
   - Agregar contexto adicional si es útil
   - Mencionar requisitos específicos mencionados
   - Si hay números, fechas u horas específicas, incluirlos
   - Mínimo 2-3 oraciones si hay información suficiente

3. **SOLICITA**: 
   - Usar el nombre del remitente: "${sender || 'Desconocido'}"

4. **RESPONSABLE**:
   - Si se menciona a alguien que debe hacer la tarea, incluirlo
   - Si no se menciona, dejar vacío

5. **FECHA LÍMITE**:
   - Calcular la fecha exacta en formato YYYY-MM-DD
   - "hoy" = ${todayStr}
   - "mañana" = ${tomorrow.toISOString().split('T')[0]}
   - "esta semana" = ${nextWeek.toISOString().split('T')[0]}
   - Para días específicos (lunes, martes, etc.), calcular el próximo
   - Si no hay fecha clara, usar null

6. **PRIORIDAD** (Alta/Media/Baja):
   - ALTA: palabras como "urgente", "ASAP", "inmediato", "crítico", "hoy", "ahora"
   - MEDIA: tareas normales con fecha específica
   - BAJA: sugerencias, ideas, "cuando puedas"

7. **TIPO DE TAREA**:
   - "Solicitud de información": piden datos, reportes, información
   - "Solicitud de cambio": modificaciones, actualizaciones, configuraciones
   - "Bug/Error": problemas, errores, fallas, no funciona
   - "Mejora": optimizar, mejorar, nueva funcionalidad
   - "Otro": si no encaja en las anteriores

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto adicional):
{
  "title": "título descriptivo y accionable",
  "description": "descripción completa con todos los detalles relevantes",
  "solicita": "nombre del solicitante",
  "responsable": "nombre o vacío",
  "dueDate": "YYYY-MM-DD o null",
  "priority": "Alta/Media/Baja",
  "tipoTarea": "tipo de la lista anterior"
}`;

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
            content: 'Eres un asistente experto en gestión de proyectos y tareas. Tu trabajo es analizar mensajes de chat y extraer información estructurada para crear tareas en un sistema de gestión. Siempre respondes ÚNICAMENTE con JSON válido, sin markdown, sin explicaciones adicionales. Eres detallado y preciso en las descripciones.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 800
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
    
    // Título (title)
    properties[FIELD_MAPPING.title] = {
      title: [{ text: { content: task.title || 'Sin título' } }]
    };
    
    // Descripción (rich_text)
    if (task.description) {
      properties[FIELD_MAPPING.description] = {
        rich_text: [{ text: { content: task.description } }]
      };
    }
    
    // Fecha límite (date)
    if (task.dueDate) {
      const dateValue = { start: task.dueDate };
      if (task.dueTime) {
        dateValue.start = `${task.dueDate}T${task.dueTime}:00`;
      }
      properties[FIELD_MAPPING.dueDate] = { date: dateValue };
    }
    
    // Solicita (people) - Usar ID de usuario de Notion
    if (task.solicitaId) {
      properties[FIELD_MAPPING.solicita] = {
        people: [{ id: task.solicitaId }]
      };
    }
    
    // Responsable (people) - Usar ID de usuario de Notion
    if (task.responsableId) {
      properties[FIELD_MAPPING.responsable] = {
        people: [{ id: task.responsableId }]
      };
    }
    
    // Prioridad (select)
    if (task.priority) {
      properties[FIELD_MAPPING.priority] = {
        select: { name: task.priority }
      };
    }
    
    // Tipo de tarea (multi_select)
    if (task.tipoTarea) {
      properties[FIELD_MAPPING.tipoTarea] = {
        multi_select: [{ name: task.tipoTarea }]
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
