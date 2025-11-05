// Service Worker para Sanarflix - Cache Inteligente
const CACHE_VERSION = 'sanarflix-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets críticos para cache inicial
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Padrões de URL para diferentes estratégias
const CACHE_STRATEGIES = {
  // Cache-first: Assets estáticos (JS, CSS, fonts, imagens)
  cacheFirst: [
    /\.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/,
    /\/assets\//,
    /\/lovable-uploads\//,
  ],
  
  // Stale-while-revalidate: APIs do Supabase
  staleWhileRevalidate: [
    /\.supabase\.co\/rest\//,
    /\.supabase\.co\/storage\//,
  ],
  
  // Network-first: Navegação e funções edge
  networkFirst: [
    /\.supabase\.co\/functions\//,
    /\/auth\//,
  ],
};

// Instalação - cacheia assets críticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Precaching critical assets');
      return cache.addAll(CRITICAL_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Ativação - limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('sanarflix-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Determina a estratégia de cache para uma URL
function getCacheStrategy(url) {
  const urlStr = url.toString();
  
  if (CACHE_STRATEGIES.cacheFirst.some(pattern => pattern.test(urlStr))) {
    return 'cacheFirst';
  }
  
  if (CACHE_STRATEGIES.staleWhileRevalidate.some(pattern => pattern.test(urlStr))) {
    return 'staleWhileRevalidate';
  }
  
  if (CACHE_STRATEGIES.networkFirst.some(pattern => pattern.test(urlStr))) {
    return 'networkFirst';
  }
  
  // Default para navegação
  return 'networkFirst';
}

// Estratégia: Cache First
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    // Só cacheia GET requests com respostas OK
    if (response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache First failed:', error);
    throw error;
  }
}

// Estratégia: Stale While Revalidate
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    // Só cacheia GET requests com respostas OK
    if (response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  }).catch((error) => {
    console.error('[SW] Revalidation failed:', error);
    return cached;
  });
  
  return cached || fetchPromise;
}

// Estratégia: Network First
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    // Só cacheia GET requests com respostas OK
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Network First failed, trying cache:', error);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Intercepta requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignora requisições não-HTTP
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Ignora requisições de chrome-extension, etc
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  
  // Ignora requisições POST, PUT, DELETE (só cacheia GET)
  if (request.method !== 'GET') {
    return;
  }
  
  // Ignora auth-bridge e outras URLs problemáticas
  if (url.hostname === 'lovable.dev' || url.pathname.includes('auth-bridge')) {
    return;
  }
  
  const strategy = getCacheStrategy(url);
  
  event.respondWith(
    (async () => {
      try {
        switch (strategy) {
          case 'cacheFirst':
            return await cacheFirst(request, STATIC_CACHE);
          
          case 'staleWhileRevalidate':
            return await staleWhileRevalidate(request, API_CACHE);
          
          case 'networkFirst':
          default:
            return await networkFirst(request, DYNAMIC_CACHE);
        }
      } catch (error) {
        console.error('[SW] Fetch failed:', error);
        
        // Fallback para navegação: retorna página offline ou cached
        if (request.mode === 'navigate') {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) {
            return cachedIndex;
          }
        }
        
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain',
          }),
        });
      }
    })()
  );
});

// Notificações Push
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let data = {
    title: 'Sanarflix - Lembrete de Estudo',
    body: 'Você tem matérias agendadas para hoje!',
    icon: '/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png',
    badge: '/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png',
    tag: 'study-reminder',
    requireInteraction: false,
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      requireInteraction: data.requireInteraction,
      data: data.data || {},
    })
  );
});

// Click em notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já existe uma janela aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // Caso contrário, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
});
