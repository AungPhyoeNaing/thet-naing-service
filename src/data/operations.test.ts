import { describe, expect, it } from 'vitest'
import { createSeed, emptyWorkshop } from './seed'
import { approveEstimate, balance, changeStatus, createJob, recordPayment, saveEstimate, sendEstimate, saveRepairCharges, startRepair, total } from './operations'
import { parseWorkshop } from './validation'
describe('workshop repair workflow', () => {
  it('validates the complete demo and an empty workshop', () => { expect(parseWorkshop(createSeed()).jobs).toHaveLength(11); expect(parseWorkshop(emptyWorkshop()).demo).toBe(false) })
  it('creates unique service requests and requires intake details', () => {
    const data = emptyWorkshop(); const draft = { customer: 'Test workshop', phone: '09000000000', address: '', category: 'Industrial machine' as const, equipment: 'Motor', brand: '', serial: '', issue: 'Will not start', serviceType: 'Workshop drop-off' as const, priority: 'Normal' as const, technician: '', dueDate: '' }
    expect(createJob(data, draft).code).toBe('TN-1001'); expect(createJob(data, draft).code).toBe('TN-1002')
    expect(() => createJob(data, { ...draft, issue: ' ' })).toThrow('Enter the customer')
  })
  it('completes estimate, inventory issue, testing, payment and collection', () => {
    const data = createSeed(); const job = data.jobs[0]; const stock = data.parts[0].stock
    changeStatus(job, 'Diagnosing')
    saveEstimate(job, [{ id: 'part', partId: 'p1', description: 'Capacitor', quantity: 2, unitPrice: 18000 }, { id: 'labour', description: 'Service', quantity: 1, unitPrice: 25000 }]); sendEstimate(job)
    approveEstimate(data, job); expect(data.parts[0].stock).toBe(stock - 2); expect(total(job)).toBe(61000)
    expect(() => approveEstimate(data, job)).toThrow(); expect(data.parts[0].stock).toBe(stock - 2)
    expect(() => changeStatus(job, 'Ready to collect')).toThrow('quality checks'); job.checks = [true,true,true]; changeStatus(job, 'Ready to collect')
    expect(() => changeStatus(job, 'Collected')).toThrow('full payment'); recordPayment(job, 10000); expect(balance(job)).toBe(51000)
    recordPayment(job, 51000); changeStatus(job, 'Collected'); expect(parseWorkshop(data).jobs[0].status).toBe('Collected')
    expect(() => changeStatus(job, 'Received')).toThrow('closed')
  })
  it('aggregates duplicate part lines and never partially issues insufficient stock', () => {
    const data = createSeed(); const job = data.jobs[0]; const before = structuredClone(data.parts)
    saveEstimate(job, [{id:'1',partId:'p1',description:'Cap',quantity:1,unitPrice:1},{id:'2',partId:'p2',description:'Bearing',quantity:2,unitPrice:1},{id:'3',partId:'p2',description:'Bearing',quantity:2,unitPrice:1}]); sendEstimate(job)
    expect(() => approveEstimate(data, job)).toThrow('Insufficient stock'); expect(data.parts).toEqual(before); expect(job.estimateStatus).toBe('Sent')
  })
  it('rejects unapproved repairs, invalid amounts and changes to approved quotes', () => {
    const data = createSeed(); const job = data.jobs[0]
    expect(() => changeStatus(job, 'In repair')).toThrow('approval'); expect(() => recordPayment(job, 10)).toThrow('approved')
    saveEstimate(job, [{id:'a',description:'Labour',quantity:1,unitPrice:100}]); sendEstimate(job); approveEstimate(data, job)
    for (const amount of [-1,0,NaN,Infinity,0.5,101]) expect(() => recordPayment(job, amount)).toThrow()
    expect(() => saveEstimate(job, [])).toThrow('locked'); expect(() => changeStatus(job,'Cancelled')).toThrow('cannot be cancelled')
  })
  it('rejects broken and inconsistent backups', () => {
    expect(() => parseWorkshop({version:1,jobs:[]})).toThrow('valid'); const data = createSeed(); data.jobs[0].paid = 300
    expect(() => parseWorkshop(data)).toThrow('valid'); const negative = createSeed(); negative.parts[0].stock = -1; expect(() => parseWorkshop(negative)).toThrow()
    const duplicate = createSeed(); duplicate.jobs.push(duplicate.jobs[0]); expect(() => parseWorkshop(duplicate)).toThrow()
  })
})


describe('direct repair workflow', () => {
  it('starts without an estimate and completes checks and collection', () => {
    const data = createSeed(); const job = data.jobs[0]
    startRepair(data, job)
    expect(job.status).toBe('In repair')
    expect(() => changeStatus(job, 'Ready to collect')).toThrow('quality checks')
    job.checks = [true, true, true]
    changeStatus(job, 'Ready to collect'); changeStatus(job, 'Collected')
    expect(parseWorkshop(data).jobs[0].status).toBe('Collected')
  })
  it('issues actual parts only once, adjusts stock and preserves payment limits', () => {
    const data = createSeed(); const job = data.jobs[0]; const stock = data.parts[0].stock
    const lines = [{id:'part',partId:'p1',description:'Capacitor',quantity:2,unitPrice:100}]
    startRepair(data, job); saveRepairCharges(data, job, lines)
    expect(data.parts[0].stock).toBe(stock - 2)
    saveRepairCharges(data, job, lines); startRepair(data, job)
    expect(data.parts[0].stock).toBe(stock - 2)
    saveRepairCharges(data, job, [{...lines[0],quantity:1}])
    expect(data.parts[0].stock).toBe(stock - 1)
    recordPayment(job, 50)
    expect(() => saveRepairCharges(data, job, [])).toThrow('less than payments')
    expect(() => recordPayment(job, 51)).toThrow('remaining balance')
    recordPayment(job, 50); job.checks = [true,true,true]
    changeStatus(job, 'Ready to collect'); changeStatus(job, 'Collected')
    expect(() => saveRepairCharges(data, job, lines)).toThrow('closed')
    expect(parseWorkshop(data).jobs[0].paid).toBe(100)
  })
  it('does not partially issue stock when actual charges exceed available stock', () => {
    const data = createSeed(); const job = data.jobs[0]; const before = structuredClone(data)
    expect(() => saveRepairCharges(data, job, [
      {id:'a',partId:'p1',description:'Cap',quantity:1,unitPrice:1},
      {id:'b',partId:'p2',description:'Bearing',quantity:9999,unitPrice:1}
    ])).toThrow('Insufficient stock')
    expect(data).toEqual(before)
  })
})
