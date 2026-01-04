/**
 * Sidebar Script - WhatsApp Task to Notion
 * Lógica para el formulario de creación de tareas (iframe version)
 */

(function() {
  'use strict';

  // Estado
  let databases = [];
  let selectedDatabase = null;
  let databaseSchema = null;
  let users = [];
  let initialTitle = '';

  // Elementos del DOM
  const elements = {
    form: document.getElementById('task-form'),
    title: document.getElementById('task-title'),
    description: document.getElementById('task-description'),
    dueDate: document.getElementById('task-due-date'),
    priority: document.getElementById('task-priority'),
    database: document.getElementById('task-database'),
    assignee: document.getElementById('task-assignee'),
    assigneeGroup: document.getElementById('assignee-group'),
    tagsGroup: document.getElementById('tags-group'),
    tagsContainer: document.getElementById('tags-container'),
    messageContainer: document.getElementById('message-container'),
    btnClose: document.getElementById('btn-close'),
    btnCancel: document.getElementById('btn-cancel'),
    btnCreate: document.getElementById('btn-create')
  };

  // Inicializar
  async function init() {
    setupEventListeners();
    await loadDatabases();
    
    // Recibir mensaje inicial con el título
    window.addEventListener('message', handleMessage);
    
    // Notificar al parent que estamos listos
    window.parent.postMessage({ type: 'SIDEBAR_READY' }, '*');
  }

  // Configurar event listeners
  function setupEventListeners() {
    elements.btnClose?.addEventListener('click', closeSidebar);
    elements.btnCancel?.addEventListener('click', closeSidebar);
    elements.form?.addEventListener('submit', handleSubmit);
    elements.database?.addEventListener('change', handleDatabaseChange);
    
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });
  }

  // Manejar mensajes del parent
  function handleMessage(event) {
    const { type, data } = event.data;
    
    switch (type) {
      case 'SET_TITLE':
        initialTitle = data.title || '';
        if (elements.title) {
          elements.title.value = initialTitle;
        }
        break;
        
      case 'SET_DATABASES':
        databases = data.databases || [];
        populateDatabases();
        break;
    }
  }

  // Cargar bases de datos
  async function loadDatabases() {
    try {
      const response = await sendToBackground({ type: 'GET_DATABASES' });
      if (response.success) {
        databases = response.databases;
        populateDatabases();
        
        // Cargar última DB usada
        const stored = await chrome.storage.local.get(['lastDatabase']);
        if (stored.lastDatabase) {
          elements.database.value = stored.lastDatabase;
          handleDatabaseChange();
        }
      }
    } catch (error) {
      console.error('Error cargando bases de datos:', error);
      showMessage('error', 'Error cargando bases de datos');
    }
  }

  // Poblar select de bases de datos
  function populateDatabases() {
    if (!elements.database) return;
    
    // Limpiar opciones existentes (excepto la primera)
    while (elements.database.options.length > 1) {
      elements.database.remove(1);
    }
    
    databases.forEach(db => {
      const option = document.createElement('option');
      option.value = db.id;
      option.textContent = `${db.icon} ${db.title}`;
      elements.database.appendChild(option);
    });
  }

  // Manejar cambio de base de datos
  async function handleDatabaseChange() {
    const databaseId = elements.database.value;
    
    if (!databaseId) {
      selectedDatabase = null;
      databaseSchema = null;
      hideOptionalFields();
      return;
    }
    
    selectedDatabase = databases.find(db => db.id === databaseId);
    
    try {
      const response = await sendToBackground({
        type: 'GET_DATABASE_SCHEMA',
        databaseId
      });
      
      if (response.success) {
        databaseSchema = response.properties;
        updateFormForSchema();
      }
    } catch (error) {
      console.error('Error cargando esquema:', error);
    }
  }

  // Actualizar formulario según el esquema
  function updateFormForSchema() {
    hideOptionalFields();
    
    if (!databaseSchema) return;
    
    // Buscar campos people para asignados
    for (const [name, prop] of Object.entries(databaseSchema)) {
      if (prop.type === 'people') {
        loadUsers();
        elements.assigneeGroup.style.display = 'block';
        elements.assignee.name = name;
        break;
      }
    }
    
    // Buscar campos multi_select para etiquetas
    for (const [name, prop] of Object.entries(databaseSchema)) {
      if (prop.type === 'multi_select' && prop.options) {
        populateTags(prop.options, name);
        elements.tagsGroup.style.display = 'block';
        break;
      }
    }
  }

  // Ocultar campos opcionales
  function hideOptionalFields() {
    elements.assigneeGroup.style.display = 'none';
    elements.tagsGroup.style.display = 'none';
    elements.tagsContainer.innerHTML = '';
  }

  // Cargar usuarios del workspace
  async function loadUsers() {
    if (users.length > 0) {
      populateUsers();
      return;
    }
    
    try {
      const response = await sendToBackground({ type: 'GET_USERS' });
      if (response.success) {
        users = response.users;
        populateUsers();
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  }

  // Poblar select de usuarios
  function populateUsers() {
    if (!elements.assignee) return;
    
    // Limpiar opciones existentes (excepto la primera)
    while (elements.assignee.options.length > 1) {
      elements.assignee.remove(1);
    }
    
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.name;
      elements.assignee.appendChild(option);
    });
  }

  // Poblar etiquetas
  function populateTags(options, propertyName) {
    elements.tagsContainer.innerHTML = '';
    elements.tagsContainer.dataset.property = propertyName;
    
    options.forEach(option => {
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'tag';
      tag.textContent = option.name;
      tag.dataset.name = option.name;
      tag.addEventListener('click', () => tag.classList.toggle('selected'));
      elements.tagsContainer.appendChild(tag);
    });
  }

  // Manejar envío del formulario
  async function handleSubmit(e) {
    e.preventDefault();
    
    const title = elements.title.value.trim();
    const databaseId = elements.database.value;
    
    // Validaciones
    if (!title) {
      showMessage('error', 'El título es requerido');
      elements.title.focus();
      return;
    }
    
    if (!databaseId) {
      showMessage('error', 'Selecciona una base de datos');
      elements.database.focus();
      return;
    }
    
    // Estado de carga
    elements.btnCreate.classList.add('btn-loading');
    elements.btnCreate.disabled = true;
    
    try {
      // Construir tarea
      const task = {
        title,
        description: elements.description.value.trim() || null,
        dueDate: elements.dueDate.value || null,
        priority: elements.priority.value || null,
        databaseId
      };
      
      // Asignado
      if (elements.assignee.value && elements.assignee.name) {
        task.assignee = elements.assignee.value;
        task.assigneeProperty = elements.assignee.name;
      }
      
      // Etiquetas
      const selectedTags = Array.from(
        elements.tagsContainer.querySelectorAll('.tag.selected')
      ).map(tag => tag.dataset.name);
      
      if (selectedTags.length > 0) {
        task.tags = selectedTags;
        task.tagsProperty = elements.tagsContainer.dataset.property;
      }
      
      // Crear tarea
      const response = await sendToBackground({ type: 'CREATE_TASK', task });
      
      if (response.success) {
        showMessage('success', 'Tarea creada exitosamente', response.url);
        
        // Cerrar después de 1.5s
        setTimeout(closeSidebar, 1500);
      } else {
        throw new Error(response.error || 'Error creando tarea');
      }
      
    } catch (error) {
      console.error('Error creando tarea:', error);
      showMessage('error', error.message);
      elements.btnCreate.classList.remove('btn-loading');
      elements.btnCreate.disabled = false;
    }
  }

  // Mostrar mensaje
  function showMessage(type, text, url = null) {
    const icons = {
      success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
      error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
      warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
    };
    
    const linkHTML = url 
      ? `<a href="${url}" target="_blank" title="Abrir en Notion">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
        </a>` 
      : '';
    
    elements.messageContainer.innerHTML = `
      <div class="message message-${type}">
        ${icons[type]}
        <span>${text}</span>
        ${linkHTML}
      </div>
    `;
  }

  // Cerrar sidebar
  function closeSidebar() {
    window.parent.postMessage({ type: 'CLOSE_SIDEBAR' }, '*');
  }

  // Enviar mensaje al background
  function sendToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Iniciar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

