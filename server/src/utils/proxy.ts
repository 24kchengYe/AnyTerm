/**
 * System proxy auto-detection — checks env vars and Windows registry.
 * Returns a custom fetch function that routes through the proxy.
 */

export function detectProxy(): string | null {
  // 1. Environment variables (highest priority)
  const envProxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy;

  if (envProxy) {
    console.log(`[Proxy] Auto-detected from env: ${envProxy}`);
    return envProxy;
  }

  // 2. Windows registry (fallback)
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      const regQuery = execSync(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable',
        { encoding: 'utf8', timeout: 3000 }
      );
      if (regQuery.includes('0x1')) {
        const serverQuery = execSync(
          'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer',
          { encoding: 'utf8', timeout: 3000 }
        );
        const match = serverQuery.match(/ProxyServer\s+REG_SZ\s+(.+)/);
        if (match) {
          let proxy = match[1].trim();
          if (!proxy.startsWith('http')) proxy = `http://${proxy}`;
          console.log(`[Proxy] Auto-detected from Windows registry: ${proxy}`);
          return proxy;
        }
      }
    } catch {
      // Registry query failed — no proxy
    }
  }

  return null;
}

/**
 * Returns a proxy-aware fetch function for the Anthropic SDK, or null if no proxy.
 */
export function getProxyFetch(): typeof globalThis.fetch | null {
  const proxyUrl = detectProxy();
  if (!proxyUrl) return null;

  try {
    const { ProxyAgent } = require('undici');
    const agent = new ProxyAgent(proxyUrl);
    const customFetch: typeof globalThis.fetch = (input, init) => {
      return globalThis.fetch(input, {
        ...init,
        // @ts-ignore — undici dispatcher
        dispatcher: agent,
      });
    };
    return customFetch;
  } catch {
    // undici not available — try node built-in
    console.log('[Proxy] undici not available, proxy may not work for API calls');
    return null;
  }
}
