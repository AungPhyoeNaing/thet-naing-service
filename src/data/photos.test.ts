import { describe, expect, it } from 'vitest'
import { createSeed } from './seed'
import { parseWorkshop } from './validation'
import { createLocalRepository } from './local'
import { staffAction } from './permissions'
import { note } from './operations'
import type { WorkshopPhoto } from './types'
const photo: WorkshopPhoto = {id:'image-1',name:'motor.jpg',stage:'Intake',caption:'Before repair',createdAt:'2026-10-23T01:00:00Z',uploadedBy:'local',dataUrl:'data:image/jpeg;base64,/9j/2Q=='}
describe('optional photo persistence and safe backup validation', () => {
  it('keeps existing backups valid and round-trips local photos', async () => {
    const old=createSeed();expect(parseWorkshop(old)).toEqual(old)
    const values=new Map<string,string>(); const repo=createLocalRepository({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value)}})
    const data=await repo.load();data.jobs[0].photos=[photo];data.parts[0].photos=[{...photo,stage:'Inventory'}]
    const saved=await repo.save(data,0)
    expect(parseWorkshop(JSON.parse(JSON.stringify(saved))).jobs[0].photos).toEqual([photo])
    expect((await repo.load()).parts[0].photos?.[0].dataUrl).toBe(photo.dataUrl)
  })
  it('rejects executable image sources, forged storage paths, duplicates and photo floods', () => {
    const data=createSeed()
    for (const altered of [{...photo,dataUrl:'data:image/svg+xml;base64,abcd'}, {...photo,dataUrl:'https://elsewhere.test/image.jpg'}, {...photo,storagePath:'jobs/another/local/image-1.jpg',dataUrl:undefined}]) {
      data.jobs[0].photos=[altered];expect(()=>parseWorkshop(data)).toThrow('not a valid')
    }
    data.jobs[0].photos=[photo,photo];expect(()=>parseWorkshop(data)).toThrow()
    data.jobs[0].photos=Array.from({length:9},(_,i)=>({...photo,id:'p-'+i}));expect(()=>parseWorkshop(data)).toThrow()
  })
  it('turns a repair-photo mutation into an attachment command, never a full snapshot', () => {
    const before=createSeed();const after=structuredClone(before)
    after.jobs[0].photos=[photo];note(after.jobs[0],'Repair photo added.')
    expect(staffAction(before,after)).toEqual({action:'attach_photo',payload:{job_id:after.jobs[0].id,photo}})
    after.parts[0].stock--
    expect(()=>staffAction(before,after)).toThrow('Admin access required')
  })
})
