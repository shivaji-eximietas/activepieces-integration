const TOKEN_KEY = 'integration_hub_token'

export const token = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },
  set(value: string): void {
    localStorage.setItem(TOKEN_KEY, value)
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY)
  },
}
