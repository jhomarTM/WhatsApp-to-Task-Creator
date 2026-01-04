/**
 * Notion API Wrapper
 * Utilidades para interactuar con la API de Notion
 */

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';

/**
 * Clase para manejar las peticiones a la API de Notion
 */
class NotionAPI {
  constructor(token) {
    this.token = token;
  }

  /**
   * Headers comunes para todas las peticiones
   */
  get headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Realizar petición a la API
   * Maneja errores HTTP comunes (401, 403, 404) según documentación oficial
   */
  async request(endpoint, options = {}) {
    const url = `${NOTION_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers
      }
    });

    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: `HTTP ${response.status}` };
    }

    if (!response.ok) {
      // Manejo específico de errores según documentación oficial
      if (response.status === 401) {
        throw new NotionAPIError(
          'Token inválido o expirado. Verifica tu Internal Integration Token.',
          'unauthorized',
          response.status
        );
      }
      if (response.status === 403) {
        throw new NotionAPIError(
          'Sin permisos. Asegúrate de compartir la base de datos con la integración.',
          'forbidden',
          response.status
        );
      }
      if (response.status === 404) {
        throw new NotionAPIError(
          'Recurso no encontrado. Verifica el ID proporcionado.',
          'not_found',
          response.status
        );
      }
      if (response.status === 400) {
        throw new NotionAPIError(
          errorData.message || 'Error de validación en la solicitud',
          errorData.code || 'invalid_request',
          response.status
        );
      }
      
      // Otros errores
      throw new NotionAPIError(
        errorData.message || 'Error en la API de Notion',
        errorData.code || 'api_error',
        response.status
      );
    }

    return errorData; // En caso de éxito, errorData contiene los datos
  }

  /**
   * Obtener información del usuario actual
   */
  async getCurrentUser() {
    return this.request('/users/me');
  }

  /**
   * Buscar bases de datos accesibles
   */
  async searchDatabases(query = '') {
    const body = {
      filter: {
        property: 'object',
        value: 'database'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    };

    if (query) {
      body.query = query;
    }

    const data = await this.request('/search', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return data.results.map(db => ({
      id: db.id,
      title: this.extractTitle(db.title),
      icon: this.extractIcon(db.icon),
      url: db.url,
      properties: db.properties
    }));
  }

  /**
   * Obtener detalles de una base de datos
   */
  async getDatabase(databaseId) {
    const data = await this.request(`/databases/${databaseId}`);
    
    return {
      id: data.id,
      title: this.extractTitle(data.title),
      icon: this.extractIcon(data.icon),
      properties: this.parseProperties(data.properties)
    };
  }

  /**
   * Consultar items de una base de datos
   */
  async queryDatabase(databaseId, options = {}) {
    const body = {
      page_size: options.pageSize || 100
    };

    if (options.filter) {
      body.filter = options.filter;
    }

    if (options.sorts) {
      body.sorts = options.sorts;
    }

    return this.request(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Crear una página (tarea) en una base de datos
   */
  async createPage(databaseId, properties, content = []) {
    const body = {
      parent: { database_id: databaseId },
      properties: properties
    };

    if (content.length > 0) {
      body.children = content;
    }

    return this.request('/pages', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Actualizar una página existente
   */
  async updatePage(pageId, properties) {
    return this.request(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }

  /**
   * Agregar contenido adicional a una página existente
   * PATCH /v1/blocks/{block_id}/children
   * 
   * Útil para agregar texto largo después de crear la página inicial
   * 
   * @param {string} pageId - ID de la página (block)
   * @param {Array} blocks - Array de bloques a agregar
   * @returns {Promise} Respuesta de la API con los bloques creados
   */
  async addContentToPage(pageId, blocks) {
    if (!pageId) {
      throw new Error('pageId es requerido');
    }
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      throw new Error('blocks debe ser un array no vacío');
    }

    return this.request(`/blocks/${pageId}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: blocks
      })
    });
  }

  /**
   * Obtener usuarios del workspace
   */
  async getUsers() {
    const data = await this.request('/users');
    
    return data.results
      .filter(user => user.type === 'person')
      .map(user => ({
        id: user.id,
        name: user.name,
        avatar: user.avatar_url,
        email: user.person?.email
      }));
  }

  // === Helpers ===

  /**
   * Extraer título de un array de rich text
   */
  extractTitle(titleArray) {
    if (!titleArray || titleArray.length === 0) return 'Sin título';
    return titleArray.map(t => t.plain_text).join('');
  }

  /**
   * Extraer icono
   */
  extractIcon(icon) {
    if (!icon) return '📋';
    if (icon.type === 'emoji') return icon.emoji;
    if (icon.type === 'external') return icon.external.url;
    if (icon.type === 'file') return icon.file.url;
    return '📋';
  }

  /**
   * Parsear propiedades de una base de datos
   */
  parseProperties(properties) {
    const parsed = {};
    
    for (const [name, prop] of Object.entries(properties)) {
      parsed[name] = {
        id: prop.id,
        name: name,
        type: prop.type
      };

      // Agregar opciones para select/multi_select
      if (prop.type === 'select' && prop.select?.options) {
        parsed[name].options = prop.select.options.map(opt => ({
          id: opt.id,
          name: opt.name,
          color: opt.color
        }));
      }

      if (prop.type === 'multi_select' && prop.multi_select?.options) {
        parsed[name].options = prop.multi_select.options.map(opt => ({
          id: opt.id,
          name: opt.name,
          color: opt.color
        }));
      }

      if (prop.type === 'status' && prop.status?.options) {
        parsed[name].options = prop.status.options.map(opt => ({
          id: opt.id,
          name: opt.name,
          color: opt.color
        }));
        parsed[name].groups = prop.status.groups;
      }
    }

    return parsed;
  }
}

/**
 * Error personalizado para la API de Notion
 */
class NotionAPIError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'NotionAPIError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Helpers para construir propiedades de Notion
 */
const NotionProperties = {
  /**
   * Crear propiedad de título
   */
  title(text) {
    return {
      title: [{ text: { content: text } }]
    };
  },

  /**
   * Crear propiedad de texto enriquecido
   */
  richText(text) {
    return {
      rich_text: [{ text: { content: text } }]
    };
  },

  /**
   * Crear propiedad de fecha
   */
  date(start, end = null) {
    const dateObj = { start };
    if (end) dateObj.end = end;
    return { date: dateObj };
  },

  /**
   * Crear propiedad select
   */
  select(name) {
    return {
      select: { name }
    };
  },

  /**
   * Crear propiedad multi-select
   */
  multiSelect(names) {
    return {
      multi_select: names.map(name => ({ name }))
    };
  },

  /**
   * Crear propiedad de personas
   */
  people(userIds) {
    return {
      people: userIds.map(id => ({ id }))
    };
  },

  /**
   * Crear propiedad checkbox
   */
  checkbox(checked) {
    return { checkbox: checked };
  },

  /**
   * Crear propiedad número
   */
  number(value) {
    return { number: value };
  },

  /**
   * Crear propiedad URL
   */
  url(url) {
    return { url };
  },

  /**
   * Crear propiedad email
   */
  email(email) {
    return { email };
  }
};

/**
 * Helpers para construir bloques de contenido
 */
const NotionBlocks = {
  /**
   * Bloque de párrafo
   */
  paragraph(text) {
    return {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ text: { content: text } }]
      }
    };
  },

  /**
   * Bloque de encabezado 1
   */
  heading1(text) {
    return {
      object: 'block',
      type: 'heading_1',
      heading_1: {
        rich_text: [{ text: { content: text } }]
      }
    };
  },

  /**
   * Bloque de encabezado 2
   */
  heading2(text) {
    return {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ text: { content: text } }]
      }
    };
  },

  /**
   * Bloque de lista con viñetas
   */
  bulletedListItem(text) {
    return {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ text: { content: text } }]
      }
    };
  },

  /**
   * Bloque de lista numerada
   */
  numberedListItem(text) {
    return {
      object: 'block',
      type: 'numbered_list_item',
      numbered_list_item: {
        rich_text: [{ text: { content: text } }]
      }
    };
  },

  /**
   * Bloque de to-do
   */
  toDo(text, checked = false) {
    return {
      object: 'block',
      type: 'to_do',
      to_do: {
        rich_text: [{ text: { content: text } }],
        checked
      }
    };
  },

  /**
   * Bloque de código
   */
  code(text, language = 'plain text') {
    return {
      object: 'block',
      type: 'code',
      code: {
        rich_text: [{ text: { content: text } }],
        language
      }
    };
  },

  /**
   * Bloque de cita
   */
  quote(text) {
    return {
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: [{ text: { content: text } }]
      }
    };
  },

  /**
   * Divisor
   */
  divider() {
    return {
      object: 'block',
      type: 'divider',
      divider: {}
    };
  },

  /**
   * Callout
   */
  callout(text, emoji = '💡') {
    return {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [{ text: { content: text } }],
        icon: { type: 'emoji', emoji }
      }
    };
  }
};

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NotionAPI, NotionAPIError, NotionProperties, NotionBlocks };
}

