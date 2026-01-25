// API Target Configuration Types and Utilities

export interface ApiTarget {
    id: string;
    name: string;
    apiBaseUrl: string;
    adminToken: string;
    redirectBaseUrl: string;
}

export interface PublicApiTarget {
    id: string;
    name: string;
    redirectBaseUrl: string;
}

/**
 * Parse and validate API targets from environment variable
 * Returns empty array if parsing fails or no targets configured
 */
export function parseApiTargets(): ApiTarget[] {
    const targetsJson = process.env.API_TARGETS;
    
    if (!targetsJson) {
        return [];
    }

    try {
        const parsed = JSON.parse(targetsJson);
        
        if (!Array.isArray(parsed)) {
            console.error('API_TARGETS must be a JSON array');
            return [];
        }

        // Validate each target has required fields
        const validated = parsed.filter((target: unknown) => {
            if (typeof target !== 'object' || target === null) return false;
            
            const t = target as Record<string, unknown>;
            const hasRequiredFields = 
                typeof t.id === 'string' && t.id.length > 0 &&
                typeof t.name === 'string' && t.name.length > 0 &&
                typeof t.apiBaseUrl === 'string' && t.apiBaseUrl.startsWith('http') &&
                typeof t.adminToken === 'string' && t.adminToken.length > 0 &&
                typeof t.redirectBaseUrl === 'string' && t.redirectBaseUrl.startsWith('http');
            
            if (!hasRequiredFields) {
                console.warn(`Invalid API target configuration:`, target);
            }
            
            return hasRequiredFields;
        });

        return validated as ApiTarget[];
    } catch (error) {
        console.error('Failed to parse API_TARGETS:', error);
        return [];
    }
}

/**
 * Get public API target info (without sensitive tokens)
 */
export function getPublicApiTargets(): PublicApiTarget[] {
    const targets = parseApiTargets();
    return targets.map(t => ({
        id: t.id,
        name: t.name,
        redirectBaseUrl: t.redirectBaseUrl,
    }));
}

/**
 * Get a specific API target by ID
 */
export function getApiTargetById(id: string): ApiTarget | null {
    const targets = parseApiTargets();
    return targets.find(t => t.id === id) || null;
}

/**
 * Get the default target ID from environment or first target
 */
export function getDefaultTargetId(): string | null {
    const defaultId = process.env.DEFAULT_TARGET_ID;
    
    if (defaultId) {
        // Verify the default ID exists in targets
        const target = getApiTargetById(defaultId);
        if (target) {
            return defaultId;
        }
    }
    
    // Fall back to first target
    const targets = parseApiTargets();
    return targets.length > 0 ? targets[0].id : null;
}
