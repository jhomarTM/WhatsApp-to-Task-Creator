/**
 * Content Script - WhatsApp Task to Notion
 * Inyecta el botón de captura y maneja la UI en WhatsApp Web
 */

(function() {
  'use strict';

  // Estado del sidebar
  let sidebarOpen = false;
  let currentMessage = '';
  let databases = [];
  let selectedDatabase = null;
  let databaseSchema = null;
  let isAuthenticated = false;
  
  // Modo demo (sin Notion)
  const DEMO_MODE = true;

  // Selectores de WhatsApp Web (pueden cambiar con actualizaciones)
  const SELECTORS = {
    footer: 'footer',
    footerContainer: 'footer > div',
    inputContainer: '[data-testid="conversation-compose-box-input"]',
    messageInput: 'div[contenteditable="true"][data-tab="10"]',
    sendButton: '[data-testid="send"]',
    attachmentMenu: '[data-testid="attach-menu-icon"]'
  };

  // Iconos SVG
  const ICONS = {
    task: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    notion: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 2.16c-.42-.326-.98-.7-2.055-.607L3.01 2.7c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.886c-.56.047-.747.327-.747.934zm14.337.745c.093.42 0 .84-.42.886l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.494-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.187 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.513.28-.886.746-.933zM2.332 1.68l13.582-.933c1.68-.14 2.101-.046 3.148.7l4.344 3.054c.7.513.933.653.933 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.046-1.448-.094-1.962-.747l-3.127-4.06c-.56-.747-.793-1.306-.793-1.96V2.986c0-.84.374-1.447 1.213-1.307z"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    link: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>`
  };

  // Inicializar
  function init() {
    console.log('WhatsApp Task to Notion: Inicializando...');
    checkAuth();
    observeDOM();
  }

  // Verificar autenticación
  async function checkAuth() {
    if (DEMO_MODE) {
      isAuthenticated = true;
      databases = [
        { id: 'demo-1', title: 'Tareas Personales', icon: '📋' },
        { id: 'demo-2', title: 'Trabajo', icon: '💼' },
        { id: 'demo-3', title: 'Proyectos', icon: '🚀' }
      ];
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' });
      isAuthenticated = response.authenticated;
      if (isAuthenticated) {
        loadDatabases();
      }
    } catch (error) {
      console.error('Error verificando auth:', error);
    }
  }

  // Cargar bases de datos
  async function loadDatabases() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_DATABASES' });
      if (response.success) {
        databases = response.databases;
        // Cargar última DB usada
        const stored = await chrome.storage.local.get(['lastDatabase']);
        if (stored.lastDatabase) {
          selectedDatabase = databases.find(db => db.id === stored.lastDatabase);
          if (selectedDatabase) {
            loadDatabaseSchema(selectedDatabase.id);
          }
        }
      }
    } catch (error) {
      console.error('Error cargando DBs:', error);
    }
  }

  // Cargar esquema de la DB
  async function loadDatabaseSchema(databaseId) {
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'GET_DATABASE_SCHEMA',
        databaseId 
      });
      if (response.success) {
        databaseSchema = response.properties;
      }
    } catch (error) {
      console.error('Error cargando esquema:', error);
    }
  }

  // Observar cambios en el DOM
  function observeDOM() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          tryInjectButton();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Intentar inyectar inmediatamente
    setTimeout(tryInjectButton, 1000);
    setTimeout(tryInjectButton, 3000);
  }

  // Intentar inyectar el botón
  function tryInjectButton() {
    if (document.querySelector('.wtn-capture-btn')) return;

    const footer = document.querySelector(SELECTORS.footer);
    if (!footer) return;

    // Buscar el contenedor de acciones
    const actionsContainer = footer.querySelector('[data-testid="conversation-compose-box-input"]')?.parentElement?.parentElement;
    
    if (!actionsContainer) {
      // Alternativa: buscar junto al botón de adjuntar
      const attachBtn = footer.querySelector(SELECTORS.attachmentMenu);
      if (attachBtn && attachBtn.parentElement) {
        injectButton(attachBtn.parentElement, 'before');
      }
      return;
    }

    // Buscar el contenedor de iconos a la izquierda
    const leftIcons = actionsContainer.querySelector('span')?.parentElement;
    if (leftIcons) {
      injectButton(leftIcons, 'append');
    }
  }

  // Inyectar el botón
  function injectButton(container, position = 'append') {
    const button = document.createElement('button');
    button.className = 'wtn-capture-btn';
    button.setAttribute('data-tooltip', 'Crear tarea en Notion');
    button.innerHTML = ICONS.task;
    button.addEventListener('click', handleCaptureClick);

    if (position === 'before') {
      container.parentElement.insertBefore(button, container);
    } else {
      container.appendChild(button);
    }

    console.log('WhatsApp Task to Notion: Botón inyectado');
  }

  // Manejar click en botón de captura
  function handleCaptureClick(e) {
    e.preventDefault();
    e.stopPropagation();

    // Obtener texto del input
    const messageInput = document.querySelector(SELECTORS.messageInput);
    currentMessage = messageInput?.textContent?.trim() || '';

    openSidebar();
  }

  // Abrir sidebar
  function openSidebar() {
    if (sidebarOpen) return;
    sidebarOpen = true;

    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'wtn-overlay';
    overlay.addEventListener('click', closeSidebar);
    document.body.appendChild(overlay);

    // Crear sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'wtn-sidebar';
    sidebar.innerHTML = getSidebarHTML();
    document.body.appendChild(sidebar);

    // Animar entrada
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      sidebar.classList.add('active');
    });

    // Configurar eventos
    setupSidebarEvents(sidebar);

    // Auto-poblar título
    if (currentMessage) {
      const titleInput = sidebar.querySelector('#wtn-title');
      if (titleInput) titleInput.value = currentMessage;
    }

    // Cargar datos si autenticado
    if (isAuthenticated) {
      populateDatabases(sidebar);
    }
  }

  // HTML del sidebar
  function getSidebarHTML() {
    if (!isAuthenticated) {
      return `
        <header class="wtn-sidebar-header">
          <h2 class="wtn-sidebar-title">
            ${ICONS.notion}
            <span>Nueva tarea</span>
          </h2>
          <button class="wtn-close-btn" data-action="close">
            ${ICONS.close}
          </button>
        </header>
        <div class="wtn-sidebar-body">
          <div class="wtn-not-connected">
            ${ICONS.notion}
            <p>Conecta tu cuenta de Notion para crear tareas.<br>Haz clic en el ícono de la extensión para configurar.</p>
          </div>
        </div>
      `;
    }

    return `
      <header class="wtn-sidebar-header">
        <h2 class="wtn-sidebar-title">
          ${ICONS.notion}
          <span>Nueva tarea</span>
        </h2>
        <button class="wtn-close-btn" data-action="close">
          ${ICONS.close}
        </button>
      </header>
      
      <div class="wtn-sidebar-body">
        <div id="wtn-message-container"></div>
        
        <div class="wtn-form-group">
          <label class="wtn-form-label required">Título</label>
          <input type="text" id="wtn-title" class="wtn-form-input" placeholder="Título de la tarea">
        </div>
        
        <div class="wtn-form-group">
          <label class="wtn-form-label">Descripción</label>
          <textarea id="wtn-description" class="wtn-form-textarea" placeholder="Agrega contexto adicional..."></textarea>
        </div>
        
        <div class="wtn-form-row">
          <div class="wtn-form-group">
            <label class="wtn-form-label">📅 Fecha límite</label>
            <input type="date" id="wtn-due-date" class="wtn-form-input">
          </div>
          
          <div class="wtn-form-group">
            <label class="wtn-form-label">🏷️ Prioridad</label>
            <select id="wtn-priority" class="wtn-form-select">
              <option value="">Sin prioridad</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </div>
        </div>
        
        <div class="wtn-form-group">
          <label class="wtn-form-label required">📁 Base de datos</label>
          <select id="wtn-database" class="wtn-form-select">
            <option value="">Selecciona una base de datos...</option>
          </select>
        </div>
      </div>
      
      <footer class="wtn-sidebar-footer">
        <button class="wtn-btn wtn-btn-secondary" data-action="cancel">
          Cancelar
        </button>
        <button class="wtn-btn wtn-btn-primary" data-action="create" id="wtn-create-btn">
          ${ICONS.check}
          <span>Crear tarea</span>
        </button>
      </footer>
    `;
  }

  // Configurar eventos del sidebar
  function setupSidebarEvents(sidebar) {
    // Botón cerrar
    sidebar.querySelector('[data-action="close"]')?.addEventListener('click', closeSidebar);
    sidebar.querySelector('[data-action="cancel"]')?.addEventListener('click', closeSidebar);
    
    // Botón crear
    sidebar.querySelector('[data-action="create"]')?.addEventListener('click', handleCreateTask);
    
    // Selector de DB
    sidebar.querySelector('#wtn-database')?.addEventListener('change', (e) => {
      const dbId = e.target.value;
      if (dbId) {
        selectedDatabase = databases.find(db => db.id === dbId);
        loadDatabaseSchema(dbId);
      } else {
        selectedDatabase = null;
        databaseSchema = null;
      }
    });

    // Cerrar con Escape
    document.addEventListener('keydown', handleKeyDown);
  }

  // Poblar selector de bases de datos
  function populateDatabases(sidebar) {
    const select = sidebar.querySelector('#wtn-database');
    if (!select) return;

    databases.forEach(db => {
      const option = document.createElement('option');
      option.value = db.id;
      option.textContent = `${db.icon} ${db.title}`;
      if (selectedDatabase && selectedDatabase.id === db.id) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  // Manejar creación de tarea
  async function handleCreateTask() {
    const sidebar = document.querySelector('.wtn-sidebar');
    const createBtn = sidebar.querySelector('#wtn-create-btn');
    const messageContainer = sidebar.querySelector('#wtn-message-container');
    
    // Obtener valores
    const title = sidebar.querySelector('#wtn-title')?.value?.trim();
    const description = sidebar.querySelector('#wtn-description')?.value?.trim();
    const dueDate = sidebar.querySelector('#wtn-due-date')?.value;
    const priority = sidebar.querySelector('#wtn-priority')?.value;
    const databaseId = sidebar.querySelector('#wtn-database')?.value;

    // Validar
    if (!title) {
      showMessage(messageContainer, 'error', 'El título es requerido');
      return;
    }

    if (!databaseId) {
      showMessage(messageContainer, 'error', 'Selecciona una base de datos');
      return;
    }

    // Estado de carga
    createBtn.classList.add('wtn-btn-loading');
    createBtn.disabled = true;

    // MODO DEMO
    if (DEMO_MODE) {
      // Simular delay de red
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const db = databases.find(d => d.id === databaseId);
      console.log('📋 DEMO - Tarea creada:', {
        título: title,
        descripción: description,
        fecha: dueDate,
        prioridad: priority,
        baseDeDatos: db?.title
      });
      
      showMessage(messageContainer, 'success', `✅ Tarea creada en "${db?.title}"`);
      setTimeout(closeSidebar, 1500);
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_TASK',
        task: {
          title,
          description,
          dueDate: dueDate || null,
          priority: priority || null,
          databaseId
        }
      });

      if (response.success) {
        showMessage(messageContainer, 'success', 'Tarea creada exitosamente', response.url);
        
        // Cerrar después de 1.5s
        setTimeout(closeSidebar, 1500);
      } else {
        throw new Error(response.error || 'Error creando tarea');
      }

    } catch (error) {
      console.error('Error creando tarea:', error);
      showMessage(messageContainer, 'error', error.message);
      createBtn.classList.remove('wtn-btn-loading');
      createBtn.disabled = false;
    }
  }

  // Mostrar mensaje
  function showMessage(container, type, text, url = null) {
    const icon = type === 'success' ? ICONS.check : ICONS.error;
    const linkHTML = url ? `<a href="${url}" target="_blank" style="margin-left: auto; display: flex;">${ICONS.link}</a>` : '';
    
    container.innerHTML = `
      <div class="wtn-message wtn-message-${type}">
        ${icon}
        <span>${text}</span>
        ${linkHTML}
      </div>
    `;
  }

  // Cerrar sidebar
  function closeSidebar() {
    if (!sidebarOpen) return;
    
    const overlay = document.querySelector('.wtn-overlay');
    const sidebar = document.querySelector('.wtn-sidebar');
    
    if (overlay) {
      overlay.classList.remove('active');
    }
    if (sidebar) {
      sidebar.classList.remove('active');
    }

    // Remover después de la animación
    setTimeout(() => {
      overlay?.remove();
      sidebar?.remove();
      sidebarOpen = false;
    }, 250);

    document.removeEventListener('keydown', handleKeyDown);
  }

  // Manejar tecla Escape
  function handleKeyDown(e) {
    if (e.key === 'Escape' && sidebarOpen) {
      closeSidebar();
    }
  }

  // Escuchar mensajes del popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUTH_STATUS_CHANGED') {
      isAuthenticated = message.authenticated;
      if (isAuthenticated) {
        loadDatabases();
      }
    }
    sendResponse({ received: true });
    return true;
  });

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

