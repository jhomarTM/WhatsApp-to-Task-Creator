/**
 * Content Script - WhatsApp Task Creator
 * Captura mensajes de WhatsApp y los convierte en tareas
 */

(function() {
  'use strict';

  // Estado
  let sidebarOpen = false;
  let selectedMessage = null;
  let tasks = []; // Almacenamiento local de tareas
  let notionUsers = []; // Usuarios de Notion

  // Iconos SVG
  const ICONS = {
    task: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>`,
    user: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
    flag: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>`,
    tag: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>`,
    ai: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21 10.5h-1.5V9h1c.28 0 .5-.22.5-.5v-1c0-.28-.22-.5-.5-.5h-1V5.5c0-.28-.22-.5-.5-.5h-1.5V3.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5V5h-1V3.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5V5h-1V3.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5V5H9V3.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5V5H6.5c-.28 0-.5.22-.5.5V7h-1c-.28 0-.5.22-.5.5v1c0 .28.22.5.5.5h1v1.5H4.5c-.28 0-.5.22-.5.5v1c0 .28.22.5.5.5H6v1.5H5c-.28 0-.5.22-.5.5v1c0 .28.22.5.5.5h1v1.5c0 .28.22.5.5.5H8v1.5c0 .28.22.5.5.5s.5-.22.5-.5V19h1v1.5c0 .28.22.5.5.5s.5-.22.5-.5V19h1v1.5c0 .28.22.5.5.5s.5-.22.5-.5V19h1v1.5c0 .28.22.5.5.5s.5-.22.5-.5V19h1.5c.28 0 .5-.22.5-.5V17h1c.28 0 .5-.22.5-.5v-1c0-.28-.22-.5-.5-.5h-1v-1.5h1.5c.28 0 .5-.22.5-.5v-1c0-.28-.22-.5-.5-.5zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>`,
    sparkle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>`
  };

  // Inicializar
  function init() {
    console.log('📋 WhatsApp Task Creator: Inicializando...');
    loadTasks();
    injectStyles();
    observeMessages();
    createSidebar();
    listenForContextMenu();
  }
  
  // Escuchar mensajes del background (menú contextual)
  function listenForContextMenu() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📋 Mensaje recibido:', message);
      
      if (message.type === 'OPEN_TASK_SIDEBAR') {
        console.log('📋 Abriendo sidebar desde menú contextual con texto:', message.text);
        
        // Verificar que el sidebar existe
        let sidebar = document.getElementById('wtn-sidebar');
        let overlay = document.getElementById('wtn-overlay');
        
        if (!sidebar || !overlay) {
          console.log('📋 Sidebar no existe, creándolo...');
          createSidebar();
          sidebar = document.getElementById('wtn-sidebar');
          overlay = document.getElementById('wtn-overlay');
        }
        
        // Obtener info adicional del mensaje seleccionado
        const selection = window.getSelection();
        let messageInfo = { sender: '', time: '' };
        
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          const messageEl = container.nodeType === 1 
            ? container.closest('[data-id]') 
            : container.parentElement?.closest('[data-id]');
          
          if (messageEl) {
            messageInfo = extractMessageInfo(messageEl);
            messageEl.classList.add('wtn-selected');
          }
        }
        
        selectedMessage = {
          text: message.text,
          sender: messageInfo.sender || 'WhatsApp',
          time: messageInfo.time || new Date().toLocaleTimeString(),
          element: null
        };
        
        // Forzar apertura del sidebar
        sidebarOpen = false; // Reset estado
        openSidebar(selectedMessage);
        
        sendResponse({ received: true, sidebarOpened: true });
      }
      return true;
    });
  }

  // Cargar tareas del storage
  async function loadTasks() {
    try {
      const result = await chrome.storage.local.get(['tasks']);
      tasks = result.tasks || [];
    } catch (e) {
      tasks = [];
    }
  }

  // Cargar usuarios de Notion
  async function loadNotionUsers() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_NOTION_USERS' });
      if (response.success && response.users) {
        notionUsers = response.users;
        updateUserSelects();
        console.log('👥 Usuarios cargados:', notionUsers.length);
      }
    } catch (e) {
      console.error('Error cargando usuarios:', e);
    }
  }

  // Actualizar los selects de usuarios
  function updateUserSelects() {
    const solicitaSelect = document.getElementById('wtn-solicita');
    const responsableSelect = document.getElementById('wtn-responsable');
    
    if (!solicitaSelect || !responsableSelect) return;
    
    // Generar opciones
    const optionsHTML = notionUsers.map(user => 
      `<option value="${user.id}">${user.name}</option>`
    ).join('');
    
    // Actualizar ambos selects
    solicitaSelect.innerHTML = `<option value="">Seleccionar persona...</option>${optionsHTML}`;
    responsableSelect.innerHTML = `<option value="">Seleccionar persona...</option>${optionsHTML}`;
  }

  // Buscar usuario por nombre (match parcial)
  function findUserByName(name) {
    if (!name || !notionUsers.length) return null;
    
    const normalizedSearch = name.toLowerCase().trim();
    
    // Buscar coincidencia exacta primero
    let found = notionUsers.find(u => u.name.toLowerCase() === normalizedSearch);
    if (found) return found;
    
    // Buscar coincidencia parcial
    found = notionUsers.find(u => 
      u.name.toLowerCase().includes(normalizedSearch) ||
      normalizedSearch.includes(u.name.toLowerCase().split(' ')[0]) // Match por primer nombre
    );
    
    return found || null;
  }

  // Guardar tareas
  async function saveTasks() {
    try {
      await chrome.storage.local.set({ tasks });
    } catch (e) {
      console.error('Error guardando tareas:', e);
    }
  }

  // Inyectar estilos adicionales para el botón en mensajes
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .wtn-msg-btn {
        position: absolute;
        top: 4px;
        right: -32px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--wtn-primary, #00a884);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        opacity: 0;
        transform: scale(0.8);
        transition: all 150ms ease;
        z-index: 100;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      }
      
      .wtn-msg-btn svg {
        width: 16px;
        height: 16px;
        fill: white;
      }
      
      .wtn-msg-btn:hover {
        background: var(--wtn-primary-hover, #06cf9c);
        transform: scale(1);
      }
      
      /* Mostrar botón al hover del mensaje */
      [data-id] .copyable-text {
        position: relative;
      }
      
      [data-id]:hover .wtn-msg-btn,
      .message-in:hover .wtn-msg-btn,
      .message-out:hover .wtn-msg-btn {
        opacity: 1;
        transform: scale(1);
      }
      
      /* Mensaje seleccionado */
      .wtn-selected {
        background: rgba(0, 168, 132, 0.1) !important;
        border-left: 3px solid var(--wtn-primary, #00a884) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Observar mensajes y agregar botones
  function observeMessages() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            addTaskButtonsToMessages(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Procesar mensajes existentes después de un delay
    setTimeout(() => addTaskButtonsToMessages(document.body), 2000);
    setTimeout(() => addTaskButtonsToMessages(document.body), 5000);
  }

  // Agregar botones de tarea a los mensajes
  function addTaskButtonsToMessages(container) {
    // Selectores para mensajes de WhatsApp
    const messageSelectors = [
      '[data-id] .copyable-text',
      '.message-in .copyable-text',
      '.message-out .copyable-text',
      '[data-pre-plain-text]'
    ];

    messageSelectors.forEach(selector => {
      const messages = container.querySelectorAll(selector);
      messages.forEach(msg => {
        // Evitar duplicados
        if (msg.querySelector('.wtn-msg-btn')) return;
        
        // Buscar el contenedor del mensaje
        const messageContainer = msg.closest('[data-id]') || msg.closest('.message-in, .message-out');
        if (!messageContainer) return;
        
        // Verificar que no tenga ya el botón
        if (messageContainer.querySelector('.wtn-msg-btn')) return;

        // Crear botón
        const btn = document.createElement('button');
        btn.className = 'wtn-msg-btn';
        btn.innerHTML = ICONS.task;
        btn.title = 'Crear tarea desde este mensaje';
        
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleMessageClick(messageContainer, msg);
        });

        // Agregar botón al mensaje
        const textContainer = msg.querySelector('span') || msg;
        if (textContainer.parentElement) {
          textContainer.parentElement.style.position = 'relative';
          textContainer.parentElement.appendChild(btn);
        }
      });
    });
  }

  // Manejar click en mensaje
  function handleMessageClick(container, msgElement) {
    // Remover selección anterior
    document.querySelectorAll('.wtn-selected').forEach(el => el.classList.remove('wtn-selected'));
    
    // Marcar como seleccionado
    container.classList.add('wtn-selected');
    
    // Extraer información del mensaje
    const messageText = extractMessageText(msgElement);
    const messageInfo = extractMessageInfo(container);
    
    selectedMessage = {
      text: messageText,
      sender: messageInfo.sender,
      time: messageInfo.time,
      element: container
    };
    
    console.log('📋 Mensaje seleccionado:', selectedMessage);
    
    // Abrir sidebar
    openSidebar(selectedMessage);
  }

  // Extraer texto del mensaje
  function extractMessageText(element) {
    // Buscar el span con el texto
    const spans = element.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent?.trim();
      if (text && text.length > 0 && !text.includes(':')) {
        return text;
      }
    }
    return element.textContent?.trim() || '';
  }

  // Extraer info del mensaje (remitente, hora)
  function extractMessageInfo(container) {
    let sender = 'Desconocido';
    let time = '';
    
    // Buscar info del remitente
    const prePlainText = container.querySelector('[data-pre-plain-text]');
    if (prePlainText) {
      const attr = prePlainText.getAttribute('data-pre-plain-text');
      // Formato: "[HH:MM, DD/MM/YYYY] Nombre: "
      const match = attr?.match(/\[([^\]]+)\]\s*([^:]+):/);
      if (match) {
        time = match[1];
        sender = match[2].trim();
      }
    }
    
    // Alternativa: buscar en otros elementos
    if (sender === 'Desconocido') {
      const senderEl = container.querySelector('[data-testid="msg-meta"] span');
      if (senderEl) sender = senderEl.textContent;
    }
    
    return { sender, time };
  }

  // Crear el sidebar (izquierda)
  function createSidebar() {
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'wtn-overlay';
    overlay.id = 'wtn-overlay';
    overlay.addEventListener('click', closeSidebar);
    document.body.appendChild(overlay);

    // Crear sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'wtn-sidebar wtn-sidebar-left';
    sidebar.id = 'wtn-sidebar';
    sidebar.innerHTML = getSidebarHTML();
    document.body.appendChild(sidebar);

    // Event listeners
    setupSidebarEvents();
  }

  // HTML del sidebar
  function getSidebarHTML() {
    return `
      <header class="wtn-sidebar-header">
        <h2 class="wtn-sidebar-title">
          ${ICONS.task}
          <span>Nueva Tarea</span>
        </h2>
        <button class="wtn-close-btn" id="wtn-close" title="Cerrar">
          ${ICONS.close}
        </button>
      </header>
      
      <div class="wtn-sidebar-body">
        <div id="wtn-message-preview" class="wtn-message-preview"></div>
        
        <button type="button" id="wtn-ai-autocomplete" class="wtn-ai-btn">
          ${ICONS.sparkle}
          <span>Autocompletar con IA</span>
        </button>
        
        <div id="wtn-message-container"></div>
        
        <form id="wtn-task-form">
          <div class="wtn-form-group">
            <label class="wtn-form-label required">
              ${ICONS.task}
              <span>Nombre de tarea</span>
            </label>
            <input type="text" id="wtn-title" class="wtn-form-input" placeholder="¿Qué hay que hacer?">
          </div>
          
          <div class="wtn-form-group">
            <label class="wtn-form-label">
              <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-3-7H9v2h6v-2zm0-4H9v2h6V9z"/></svg>
              <span>Descripción</span>
            </label>
            <textarea id="wtn-description" class="wtn-form-textarea" placeholder="Detalles adicionales..."></textarea>
          </div>
          
          <div class="wtn-form-row">
            <div class="wtn-form-group">
              <label class="wtn-form-label">
                <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/></svg>
                <span>Solicita</span>
              </label>
              <select id="wtn-solicita" class="wtn-form-select">
                <option value="">Seleccionar persona...</option>
              </select>
            </div>
            
            <div class="wtn-form-group">
              <label class="wtn-form-label">
                ${ICONS.user}
                <span>Responsable</span>
              </label>
              <select id="wtn-responsable" class="wtn-form-select">
                <option value="">Seleccionar persona...</option>
              </select>
            </div>
          </div>
          
          <div class="wtn-form-group">
            <label class="wtn-form-label">
              ${ICONS.calendar}
              <span>Fecha límite</span>
            </label>
            <input type="date" id="wtn-due-date" class="wtn-form-input">
          </div>
          
          <div class="wtn-form-row">
            <div class="wtn-form-group">
              <label class="wtn-form-label">
                ${ICONS.flag}
                <span>Prioridad</span>
              </label>
              <select id="wtn-priority" class="wtn-form-select">
                <option value="">Sin prioridad</option>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
            
            <div class="wtn-form-group">
              <label class="wtn-form-label">
                ${ICONS.tag}
                <span>Tipo de tarea</span>
              </label>
              <select id="wtn-tipo-tarea" class="wtn-form-select">
                <option value="">Sin tipo</option>
                <option value="Solicitud de información">Solicitud de información</option>
                <option value="Solicitud de cambio">Solicitud de cambio</option>
                <option value="Bug/Error">Bug / Error</option>
                <option value="Mejora">Mejora</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>
        </form>
      </div>
      
      <footer class="wtn-sidebar-footer">
        <button type="button" class="wtn-btn wtn-btn-secondary" id="wtn-cancel">
          Cancelar
        </button>
        <button type="submit" form="wtn-task-form" class="wtn-btn wtn-btn-primary" id="wtn-create">
          ${ICONS.check}
          <span>Crear Tarea</span>
        </button>
      </footer>
    `;
  }

  // Configurar eventos del sidebar
  function setupSidebarEvents() {
    document.getElementById('wtn-close')?.addEventListener('click', closeSidebar);
    document.getElementById('wtn-cancel')?.addEventListener('click', closeSidebar);
    document.getElementById('wtn-task-form')?.addEventListener('submit', handleCreateTask);
    document.getElementById('wtn-ai-autocomplete')?.addEventListener('click', handleAIAutocomplete);
    
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebarOpen) closeSidebar();
    });
  }

  // Autocompletar con IA
  async function handleAIAutocomplete() {
    const aiBtn = document.getElementById('wtn-ai-autocomplete');
    const messageContainer = document.getElementById('wtn-message-container');
    
    if (!selectedMessage?.text) {
      showMessage(messageContainer, 'error', 'No hay mensaje seleccionado');
      return;
    }
    
    // Estado de carga
    aiBtn.classList.add('wtn-ai-btn-loading');
    aiBtn.disabled = true;
    aiBtn.innerHTML = `
      <svg class="wtn-spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>
      <span>Analizando...</span>
    `;
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AI_AUTOCOMPLETE',
        messageText: selectedMessage.text,
        sender: selectedMessage.sender
      });
      
      if (response.success && response.suggestions) {
        const s = response.suggestions;
        
        // Rellenar campos con sugerencias
        if (s.title) {
          document.getElementById('wtn-title').value = s.title;
        }
        if (s.description) {
          document.getElementById('wtn-description').value = s.description;
        }
        
        // Para Solicita, intentar hacer match con usuarios de Notion
        if (s.solicita && notionUsers.length > 0) {
          const matchedUser = findUserByName(s.solicita);
          if (matchedUser) {
            document.getElementById('wtn-solicita').value = matchedUser.id;
          }
        }
        
        // Para Responsable, intentar hacer match
        if (s.responsable && notionUsers.length > 0) {
          const matchedUser = findUserByName(s.responsable);
          if (matchedUser) {
            document.getElementById('wtn-responsable').value = matchedUser.id;
          }
        }
        
        if (s.dueDate) {
          document.getElementById('wtn-due-date').value = s.dueDate;
        }
        if (s.priority) {
          document.getElementById('wtn-priority').value = s.priority;
        }
        if (s.tipoTarea) {
          document.getElementById('wtn-tipo-tarea').value = s.tipoTarea;
        }
        
        showMessage(messageContainer, 'success', 'Campos completados con IA');
        
        // Limpiar mensaje después de 2s
        setTimeout(() => {
          messageContainer.innerHTML = '';
        }, 2000);
        
      } else {
        throw new Error(response.error || 'Error al procesar con IA');
      }
      
    } catch (error) {
      console.error('❌ Error IA:', error);
      showMessage(messageContainer, 'error', error.message);
    } finally {
      // Restaurar botón
      aiBtn.classList.remove('wtn-ai-btn-loading');
      aiBtn.disabled = false;
      aiBtn.innerHTML = `${ICONS.sparkle}<span>Autocompletar con IA</span>`;
    }
  }

  // Abrir sidebar
  function openSidebar(message) {
    console.log('📋 openSidebar llamado con:', message);
    
    if (sidebarOpen) {
      console.log('📋 Sidebar ya está abierto');
      return;
    }
    sidebarOpen = true;

    const overlay = document.getElementById('wtn-overlay');
    const sidebar = document.getElementById('wtn-sidebar');
    
    console.log('📋 Elementos encontrados - overlay:', !!overlay, 'sidebar:', !!sidebar);
    
    if (!sidebar || !overlay) {
      console.error('📋 ERROR: No se encontró el sidebar o overlay');
      sidebarOpen = false;
      return;
    }
    
    // Mostrar preview del mensaje
    const preview = document.getElementById('wtn-message-preview');
    if (preview && message) {
      preview.innerHTML = `
        <div class="wtn-preview-header">Mensaje seleccionado</div>
        <div class="wtn-preview-content">
          <div class="wtn-preview-sender">${message.sender} · ${message.time}</div>
          <div class="wtn-preview-text">"${message.text}"</div>
        </div>
      `;
    }

    // Auto-rellenar título
    const titleInput = document.getElementById('wtn-title');
    if (titleInput && message?.text) {
      // Truncar si es muy largo
      titleInput.value = message.text.length > 100 
        ? message.text.substring(0, 100) + '...' 
        : message.text;
    }

    // Mostrar
    overlay.classList.add('active');
    sidebar.classList.add('active');
    
    console.log('📋 Sidebar abierto correctamente');
    
    // Cargar usuarios de Notion
    loadNotionUsers();
    
    // Focus en título
    setTimeout(() => titleInput?.focus(), 300);
  }

  // Cerrar sidebar
  function closeSidebar() {
    if (!sidebarOpen) return;
    
    const overlay = document.getElementById('wtn-overlay');
    const sidebar = document.getElementById('wtn-sidebar');
    
    overlay?.classList.remove('active');
    sidebar?.classList.remove('active');
    
    // Remover selección
    document.querySelectorAll('.wtn-selected').forEach(el => el.classList.remove('wtn-selected'));
    
    // Limpiar formulario
    document.getElementById('wtn-task-form')?.reset();
    document.getElementById('wtn-message-container').innerHTML = '';
    
    sidebarOpen = false;
    selectedMessage = null;
  }

  // Crear tarea
  async function handleCreateTask(e) {
    e.preventDefault();
    
    const createBtn = document.getElementById('wtn-create');
    const messageContainer = document.getElementById('wtn-message-container');
    
    // Obtener valores
    const title = document.getElementById('wtn-title')?.value?.trim();
    const description = document.getElementById('wtn-description')?.value?.trim();
    const solicitaId = document.getElementById('wtn-solicita')?.value; // ID de usuario
    const responsableId = document.getElementById('wtn-responsable')?.value; // ID de usuario
    const dueDate = document.getElementById('wtn-due-date')?.value;
    const priority = document.getElementById('wtn-priority')?.value;
    const tipoTarea = document.getElementById('wtn-tipo-tarea')?.value;

    // Validar
    if (!title) {
      showMessage(messageContainer, 'error', 'El nombre de la tarea es requerido');
      document.getElementById('wtn-title')?.focus();
      return;
    }

    // Estado de carga
    createBtn.classList.add('wtn-btn-loading');
    createBtn.disabled = true;

    // Crear objeto de tarea
    const task = {
      id: Date.now().toString(),
      title,
      description,
      solicitaId: solicitaId || null, // ID de usuario de Notion
      responsableId: responsableId || null, // ID de usuario de Notion
      dueDate: dueDate || null,
      priority: priority || null,
      tipoTarea: tipoTarea || null,
      sourceMessage: selectedMessage ? {
        text: selectedMessage.text,
        sender: selectedMessage.sender,
        time: selectedMessage.time
      } : null
    };

    try {
      // Enviar a Notion
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_NOTION_TASK',
        task: task
      });

      if (response.success) {
        console.log('✅ Tarea creada en Notion:', response.url);
        showMessage(messageContainer, 'success', '¡Tarea creada en Notion!');
        
        // Cerrar después de 1.5s
        setTimeout(closeSidebar, 1500);
      } else {
        throw new Error(response.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      showMessage(messageContainer, 'error', `Error: ${error.message}`);
    } finally {
      createBtn.classList.remove('wtn-btn-loading');
      createBtn.disabled = false;
    }
  }

  // Mostrar mensaje
  function showMessage(container, type, text) {
    if (!container) return;
    
    const icon = type === 'success' 
      ? ICONS.check 
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
    
    container.innerHTML = `
      <div class="wtn-message wtn-message-${type}">
        ${icon}
        <span>${text}</span>
      </div>
    `;
  }

  // Iniciar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
