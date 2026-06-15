const TOKEN_KEY = 'integration_hub_token';
export const token = {
    get() {
        return localStorage.getItem(TOKEN_KEY);
    },
    set(value) {
        localStorage.setItem(TOKEN_KEY, value);
    },
    clear() {
        localStorage.removeItem(TOKEN_KEY);
    },
};
