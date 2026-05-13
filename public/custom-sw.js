const broadcastToWindowClients = function(message) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
    clientList.forEach(function(client) {
      client.postMessage(message);
    });
  });
};

self.addEventListener('sync', function(event) {
  if (event.tag === 'arkaiv-background-flush') {
    event.waitUntil(broadcastToWindowClients({ type: 'ARKAIV_BACKGROUND_SYNC' }));
  }
});

self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'arkaiv-background-runtime') {
    event.waitUntil(broadcastToWindowClients({ type: 'ARKAIV_PERIODIC_SYNC' }));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const isPersistent = event.notification.tag === 'braindump-persistent';
  
  if (event.action === 'reply' && event.reply) {
    const replyText = event.reply;
    
    const handleReply = self.clients.matchAll({ type: 'window' }).then(function(clientList) {
      let clientFound = false;
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_REPLY', text: replyText });
          clientFound = true;
          if (!isPersistent) {
            client.focus();
          }
          break;
        }
      }
      if (!clientFound && self.clients.openWindow) {
        return self.clients.openWindow('/?reply=' + encodeURIComponent(replyText));
      }
    }).then(function() {
      if (isPersistent) {
        return self.registration.showNotification('Arkaiv Quick Input', {
          body: 'Type your thoughts here...',
          icon: '/icon.svg',
          badge: '/mask-icon.svg',
          tag: 'braindump-persistent',
          renotify: false,
          requireInteraction: true,
          silent: true,
          actions: [
            {
              action: 'reply',
              type: 'text',
              title: 'Quick Input'
            }
          ]
        });
      }
    });

    event.waitUntil(handleReply);
  } else {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(function(clientList) {
        for (let i = 0; i < clientList.length; i++) {
          let client = clientList[i];
          if (client.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
    );
  }
});
