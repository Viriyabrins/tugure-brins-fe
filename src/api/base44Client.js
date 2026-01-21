import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion } = appParams;
const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

const createEntityStub = () => {
  const handler = {
    get(target, prop) {
      if (!target[prop]) {
        const noop = async (...args) => {
          if (['create', 'update', 'delete'].includes(prop)) {
            return args[0] ?? {};
          }
          return [];
        };
        target[prop] = noop;
      }
      return target[prop];
    }
  };
  return new Proxy({}, handler);
};

const createEntitiesStub = () => new Proxy({}, {
  get(_, __) {
    return createEntityStub();
  }
});

const stubbedClient = {
  auth: {
    me: async () => ({
      id: 'bypass-user',
      full_name: 'Bypass User',
      email: 'bypass@example.com',
      role: 'ADMIN',
      app_id: appId
    }),
    logout: () => {},
    redirectToLogin: () => {}
  },
  entities: createEntitiesStub(),
  integrations: {
    Core: {
      SendEmail: async () => ({}),
      UploadFile: async () => ({ file_url: '' })
    }
  },
  appLogs: {
    logUserInApp: async () => {}
  }
};

export const base44 = bypassAuth
  ? stubbedClient
  : createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: '',
      requiresAuth: false
    });
