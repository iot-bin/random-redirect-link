// Utility functions for managing multiple API targets (domains)
// Format: API_TARGETS=alias1:https://api1.com,alias2:https://api2.com

export interface ApiTarget {
  alias: string;
  baseUrl: string;
  label?: string; // Optional display label, defaults to alias
}

/**
 * Parse API_TARGETS environment variable
 * Supports formats:
 * - Simple: alias:url (e.g., "prod:https://api.prod.com")
 * - With label: alias|label:url (e.g., "prod|Production API:https://api.prod.com")
 * Multiple targets separated by comma
 */
export function parseApiTargets(envValue?: string): Map<string, ApiTarget> {
  const targets = new Map<string, ApiTarget>();
  
  if (!envValue || !envValue.trim()) {
    return targets;
  }

  const entries = envValue.split(',').map(s => s.trim()).filter(Boolean);
  
  for (const entry of entries) {
    // Match pattern: alias[:label]:url where url starts with http:// or https://
    // Use regex to extract components properly
    const match = entry.match(/^([^:]+):(https?:\/\/.+)$/);
    
    if (!match) {
      console.warn(`Invalid format in API_TARGETS: ${entry}`);
      continue;
    }
    
    const aliasAndLabel = match[1];
    const url = match[2];
    
    // Parse alias and optional label
    let alias: string;
    let label: string | undefined;
    
    if (aliasAndLabel.includes('|')) {
      const [a, l] = aliasAndLabel.split('|', 2);
      alias = a.trim();
      label = l.trim();
    } else {
      alias = aliasAndLabel.trim();
    }
    
    if (!alias) {
      console.warn(`Empty alias in API_TARGETS for URL: ${url}`);
      continue;
    }
    
    targets.set(alias, {
      alias,
      baseUrl: url,
      label: label || alias,
    });
  }
  
  return targets;
}

/**
 * Get available API targets from environment
 * Falls back to legacy single API_BASE_URL if API_TARGETS not configured
 */
export function getApiTargets(): Map<string, ApiTarget> {
  const apiTargetsEnv = process.env.API_TARGETS;
  
  if (apiTargetsEnv) {
    return parseApiTargets(apiTargetsEnv);
  }
  
  // Backward compatibility: use legacy API_BASE_URL as single target
  const legacyBaseUrl = process.env.API_BASE_URL;
  if (legacyBaseUrl) {
    const targets = new Map<string, ApiTarget>();
    targets.set('default', {
      alias: 'default',
      baseUrl: legacyBaseUrl,
      label: 'Default API',
    });
    return targets;
  }
  
  return new Map();
}

/**
 * Get API target by alias
 * Returns null if not found
 */
export function getApiTarget(alias: string): ApiTarget | null {
  const targets = getApiTargets();
  return targets.get(alias) || null;
}

/**
 * Get all available API targets as array (for client consumption)
 */
export function getApiTargetsArray(): ApiTarget[] {
  const targets = getApiTargets();
  return Array.from(targets.values());
}
