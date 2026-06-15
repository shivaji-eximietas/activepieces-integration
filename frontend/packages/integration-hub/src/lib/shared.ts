export type SeekPage<T> = {
  data: T[]
  next: string | null
  previous: string | null
}
