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

  // Iconos SVG
  const ICONS = {
    task: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>`,
    user: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
    flag: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>`,
    tag: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>`
  };

  // Inicializar
  function init() {
    console.log('📋 WhatsApp Task Creator: Inicializando...');
    loadTasks();
    injectStyles();
    observeMessages();
    createSidebar();
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
        <button class="wtn-close-btn" id="wtn-close">
          ${ICONS.close}
        </button>
      </header>
      
      <div class="wtn-sidebar-body">
        <div id="wtn-message-preview" class="wtn-message-preview"></div>
        
        <div id="wtn-message-container"></div>
        
        <form id="wtn-task-form">
          <div class="wtn-form-group">
            <label class="wtn-form-label required">
              ${ICONS.task}
              Título de la tarea
            </label>
            <input type="text" id="wtn-title" class="wtn-form-input" placeholder="¿Qué hay que hacer?">
          </div>
          
          <div class="wtn-form-group">
            <label class="wtn-form-label">
              📝 Descripción
            </label>
            <textarea id="wtn-description" class="wtn-form-textarea" placeholder="Detalles adicionales..." rows="3"></textarea>
          </div>
          
          <div class="wtn-form-row">
            <div class="wtn-form-group">
              <label class="wtn-form-label">
                ${ICONS.calendar}
                Fecha límite
              </label>
              <input type="date" id="wtn-due-date" class="wtn-form-input">
            </div>
            
            <div class="wtn-form-group">
              <label class="wtn-form-label">
                🕐 Hora
              </label>
              <input type="time" id="wtn-due-time" class="wtn-form-input">
            </div>
          </div>
          
          <div class="wtn-form-row">
            <div class="wtn-form-group">
              <label class="wtn-form-label">
                ${ICONS.flag}
                Prioridad
              </label>
              <select id="wtn-priority" class="wtn-form-select">
                <option value="">Sin prioridad</option>
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Media</option>
                <option value="baja">🟢 Baja</option>
              </select>
            </div>
            
            <div class="wtn-form-group">
              <label class="wtn-form-label">
                📁 Proyecto
              </label>
              <select id="wtn-project" class="wtn-form-select">
                <option value="">Sin proyecto</option>
                <option value="personal">Personal</option>
                <option value="trabajo">Trabajo</option>
                <option value="otros">Otros</option>
              </select>
            </div>
          </div>
          
          <div class="wtn-form-group">
            <label class="wtn-form-label">
              ${ICONS.user}
              Asignar a
            </label>
            <input type="text" id="wtn-assignee" class="wtn-form-input" placeholder="Nombre del responsable">
          </div>
          
          <div class="wtn-form-group">
            <label class="wtn-form-label">
              ${ICONS.tag}
              Etiquetas
            </label>
            <input type="text" id="wtn-tags" class="wtn-form-input" placeholder="trabajo, urgente, cliente">
            <span class="wtn-form-hint">Separadas por comas</span>
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
    
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebarOpen) closeSidebar();
    });
  }

  // Abrir sidebar
  function openSidebar(message) {
    if (sidebarOpen) return;
    sidebarOpen = true;

    const overlay = document.getElementById('wtn-overlay');
    const sidebar = document.getElementById('wtn-sidebar');
    
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
    overlay?.classList.add('active');
    sidebar?.classList.add('active');
    
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
    const dueDate = document.getElementById('wtn-due-date')?.value;
    const dueTime = document.getElementById('wtn-due-time')?.value;
    const priority = document.getElementById('wtn-priority')?.value;
    const project = document.getElementById('wtn-project')?.value;
    const assignee = document.getElementById('wtn-assignee')?.value?.trim();
    const tagsInput = document.getElementById('wtn-tags')?.value?.trim();
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Validar
    if (!title) {
      showMessage(messageContainer, 'error', 'El título es requerido');
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
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      priority: priority || null,
      project: project || null,
      assignee: assignee || null,
      tags,
      sourceMessage: selectedMessage ? {
        text: selectedMessage.text,
        sender: selectedMessage.sender,
        time: selectedMessage.time
      } : null,
      createdAt: new Date().toISOString(),
      completed: false
    };

    // Simular guardado
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Guardar tarea
    tasks.push(task);
    await saveTasks();
    
    console.log('✅ Tarea creada:', task);
    
    // Mostrar éxito
    showMessage(messageContainer, 'success', '¡Tarea creada exitosamente!');
    
    // Cerrar después de 1s
    setTimeout(closeSidebar, 1000);
    
    createBtn.classList.remove('wtn-btn-loading');
    createBtn.disabled = false;
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
