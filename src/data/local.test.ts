import { describe, expect, it } from 'vitest'
import { createLocalRepository, STORAGE_KEY } from './local'
describe('isolated local repository', () => {
  function setup() { const values = new Map<string,string>(); const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string,v: string) => { values.set(k,v) } }; return { values, repo: createLocalRepository(storage) } }
  it('persists demo once and rejects stale saves without losing the newer state', async () => {
    const {repo,values} = setup(); const a = await repo.load(); const b = await repo.load(); a.demo = false; const saved = await repo.save(a, a.revision)
    expect(saved.revision).toBe(1); expect((await repo.load()).demo).toBe(false); await expect(repo.save(b,b.revision)).rejects.toThrow('Another tab')
    expect([...values.keys()]).toEqual([STORAGE_KEY]); expect((await repo.load()).revision).toBe(1)
  })
  it('retains damaged storage for recovery instead of replacing it', async () => { const {repo,values} = setup(); values.set(STORAGE_KEY,'broken-json'); await expect(repo.load()).rejects.toThrow('not been overwritten'); expect(values.get(STORAGE_KEY)).toBe('broken-json') })
})
