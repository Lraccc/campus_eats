/**
 * Account type cache utility
 * Manages cached account type to prevent UI flickering while ensuring fresh data
 */

let cachedAccountType: string | null = null;

export const getCachedAccountType = (): string | null => {
    return cachedAccountType;
};

export const setCachedAccountType = (value: string | null): void => {
    cachedAccountType = value;
};

export const clearCachedAccountType = (): void => {
    cachedAccountType = null;
};

export const hasCachedAccountType = (): boolean => {
    return cachedAccountType !== null;
};