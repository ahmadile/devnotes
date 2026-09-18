import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resilient API fetcher that tries relative path first,
 * then falls back to direct backend port 3001 if Vite proxy fails.
 */
export async function fetchApiWithFallback(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const candidateUrls = [
    endpoint,
    `http://127.0.0.1:3001${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`,
    `http://localhost:3001${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`,
  ];

  let lastError: any = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, options);
      // If successful or client error (4xx like 400, 401, 403), return directly
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Le serveur backend n'a pas répondu. Assurez-vous d'avoir lancé l'application avec 'npm run dev'.");
}

