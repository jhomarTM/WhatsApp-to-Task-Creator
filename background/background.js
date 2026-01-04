/**
 * Background Service Worker - WhatsApp Task Creator
 * Maneja el menú contextual y almacenamiento
 */

// Crear menú contextual al instalar
chrome.runtime.onInstalled.addListener(() => {
  console.log('📋 WhatsApp Task Creator instalado');
  
  // Crear opción en menú contextual
  chrome.contextMenus.create({
    id: 'convertToTask',
    title: '📋 Convertir a tarea',
    contexts: ['selection'], // Solo cuando hay texto seleccionado
    documentUrlPatterns: ['https://web.whatsapp.com/*']
  });
});

// Manejar click en menú contextual
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'convertToTask') {
    const selectedText = info.selectionText;
    
    console.log('📋 Texto seleccionado:', selectedText);
    
    // Enviar mensaje al content script
    chrome.tabs.sendMessage(tab.id, {
      type: 'OPEN_TASK_SIDEBAR',
      text: selectedText
    });
  }
});

// Escuchar mensajes del content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TASKS') {
    chrome.storage.local.get(['tasks'], (result) => {
      sendResponse({ tasks: result.tasks || [] });
    });
    return true;
  }
  
  if (message.type === 'SAVE_TASK') {
    chrome.storage.local.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      tasks.push(message.task);
      chrome.storage.local.set({ tasks }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});
