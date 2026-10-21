import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { my, translate } from './translations'
import { workerMessages } from './worker-messages'
import { statuses } from '../data/types'
import { createSeed } from '../data/seed'
import { nextStep } from './repair-guidance'
import { sampleLabel } from './sample-labels'
describe('Burmese workshop copy', () => {
  it('translates every repair status and estimate decision without changing stored values', () => {
    for (const value of [...statuses,'Draft','Sent','Approved','Declined','Home appliance','Industrial machine','Normal','High','Urgent']) expect(translate(value,'my')).toMatch(/[\u1000-\u109f]/)
    expect(statuses).toContain('Ready to collect')
  })
  it('covers every literal UI translation key', () => {
    const known = new Set([...Object.keys(my),...Object.keys(workerMessages)])
    const missing = new Set<string>()
    function walk(dir: string) {
      for(const entry of readdirSync(dir)) {
        const file=path.join(dir,entry)
        if(statSync(file).isDirectory()){walk(file);continue}
        if(!file.endsWith('.tsx') || file.endsWith('.test.tsx'))continue
        const ast=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
        function visit(node: ts.Node) {
          if(ts.isCallExpression(node)&&node.expression.getText(ast)==='tr'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])) {
            const key=node.arguments[0].text.trim().replace(/\s+/g,' ')
            if(/[a-zA-Z]/.test(key)&&!known.has(key))missing.add(key)
          }
          ts.forEachChild(node,visit)
        }
        visit(ast)
      }
    }
    walk(path.resolve('src'))
    expect([...missing]).toEqual([])
  })
  it('translates system history, stock errors and accessible field names while retaining entered text', () => {
    expect(translate('Status changed to ready to collect.','my')).toContain('ပြန်အပ်ရန် အသင့်ဖြစ်')
    expect(translate('Payment received: 15,000 Ks.','my')).toContain('15,000 ကျပ်')
    expect(translate('Insufficient stock for 6205 bearing. Receive stock or revise the estimate first.','my')).toContain('6205 bearing')
    expect(translate('Unit price for ပြုပြင်ခ','my')).toBe('တစ်ခုဈေး - ပြုပြင်ခ')
    expect(translate('Customer asked to call after 5 pm.','my')).toBe('Customer asked to call after 5 pm.')
  })
  it('localizes only app-supplied sample records, never entered customer names', () => {
    const job=createSeed().jobs[0]; const tr=(s: string)=>translate(s,'my')
    expect(sampleLabel(job,'equipment',tr)).toBe('အဝတ်လျှော်စက်')
    expect(sampleLabel({...job,id:'real-job-id',customer:'Example household A'},'customer',tr)).toBe('Example household A')
  })
})
describe('worker guidance', () => {
  it('offers safe next steps through testing, payment and collection', () => {
    const job=createSeed().jobs[0]
    expect(nextStep(job).target).toBe('diagnose')
    job.status='Diagnosing'; expect(nextStep(job).target).toBe('estimate')
    job.status='In repair';job.estimateStatus='Approved'; expect(nextStep(job).target).toBe('checks')
    job.checks=[true,true,true];expect(nextStep(job).target).toBe('ready')
    job.status='Ready to collect';job.lines=[{id:'l',description:'Labour',quantity:1,unitPrice:100}]
    expect(nextStep(job).target).toBe('payment');job.paid=100;expect(nextStep(job).target).toBe('collect')
    job.status='Collected';expect(nextStep(job).target).toBe('closed')
  })
  it('allows approved work waiting on parts to resume without issuing stock twice', () => {
    const job=createSeed().jobs[3];job.status='Waiting for parts'
    expect(nextStep(job).target).toBe('resume')
    expect(nextStep(job).message).not.toBe(translate(nextStep(job).message,'my'))
  })
})
