/**
 * Popup Script - WhatsApp Task to Notion
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elementos del DOM
  const states = {
    loading: document.getElementById('state-loading'),
    disconnected: document.getElementById('state-disconnected'),
    connected: document.getElementById('state-connected'),
    error: document.getElementById('state-error')
  };

  const elements = {
    btnConnect: document.getElementById('btn-connect'),
    btnDisconnect: document.getElementById('btn-disconnect'),
    btnRetry: document.getElementById('btn-retry'),
    tokenInput: document.getElementById('notion-token-input'),
    workspaceIcon: document.getElementById('workspace-icon'),
    workspaceName: document.getElementById('workspace-name'),
    dbCount: document.getElementById('db-count'),
    errorMessage: document.getElementById('error-message')
  };

  // Cambiar estado visible
  function showState(stateName) {
    Object.values(states).forEach(state => state.classList.remove('active'));
    states[stateName]?.classList.add('active');
  }

  // Verificar estado de autenticación
  async function checkAuth() {
    showState('loading');
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' });
      
      if (response.authenticated) {
        await showConnectedState(response);
      } else {
        showState('disconnected');
      }
    } catch (error) {
      console.error('Error verificando auth:', error);
      showError(error.message);
    }
  }

  // Mostrar estado conectado
  async function showConnectedState(authData) {
    showState('connected');
    
    // Actualizar UI con datos del bot
    if (authData.botName) {
      elements.workspaceName.textContent = authData.botName;
    }

    // Cargar bases de datos
    try {
      const dbResponse = await chrome.runtime.sendMessage({ type: 'GET_DATABASES' });
      if (dbResponse.success) {
        elements.dbCount.textContent = dbResponse.databases.length;
      }
    } catch (error) {
      console.error('Error cargando DBs:', error);
      // Si hay error, puede ser que no haya bases compartidas
      elements.dbCount.textContent = '0';
    }
  }

  // Mostrar error
  function showError(message) {
    elements.errorMessage.textContent = message || 'Ocurrió un error inesperado';
    showState('error');
  }

  // Conectar con Notion usando Internal Integration Token
  async function connectToNotion() {
    const token = elements.tokenInput?.value?.trim();
    
    if (!token) {
      showError('Por favor ingresa tu Internal Integration Token');
      elements.tokenInput?.focus();
      return;
    }

    if (!token.startsWith('secret_')) {
      showError('El token debe comenzar con "secret_"');
      elements.tokenInput?.focus();
      return;
    }

    elements.btnConnect.disabled = true;
    elements.btnConnect.classList.add('btn-loading');
    elements.tokenInput.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'SET_NOTION_TOKEN',
        token: token
      });
      
      if (response.success) {
        // Limpiar input
        elements.tokenInput.value = '';
        // Notificar al content script
        notifyContentScript(true);
        await checkAuth();
      } else {
        throw new Error(response.error || 'Error al conectar');
      }
    } catch (error) {
      console.error('Error configurando token:', error);
      showError(error.message);
    } finally {
      elements.btnConnect.disabled = false;
      elements.btnConnect.classList.remove('btn-loading');
      elements.tokenInput.disabled = false;
    }
  }

  // Desconectar de Notion
  async function disconnectFromNotion() {
    elements.btnDisconnect.disabled = true;

    try {
      await chrome.runtime.sendMessage({ type: 'DISCONNECT' });
      notifyContentScript(false);
      showState('disconnected');
    } catch (error) {
      console.error('Error desconectando:', error);
    } finally {
      elements.btnDisconnect.disabled = false;
    }
  }

  // Notificar cambio de auth al content script
  async function notifyContentScript(authenticated) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url?.includes('web.whatsapp.com')) {
        await chrome.tabs.sendMessage(tab.id, { 
          type: 'AUTH_STATUS_CHANGED', 
          authenticated 
        });
      }
    } catch (error) {
      // Tab might not have content script
      console.log('No se pudo notificar al content script');
    }
  }

  // Event listeners
  elements.btnConnect?.addEventListener('click', connectToNotion);
  elements.btnDisconnect?.addEventListener('click', disconnectFromNotion);
  elements.btnRetry?.addEventListener('click', checkAuth);

  // Iniciar
  await checkAuth();
});

