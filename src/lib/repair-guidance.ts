import { balance } from '../data/operations'
import type { Job } from '../data/types'
export function nextStep(job: Job): { message: string; action: string; target: 'diagnose' | 'estimate' | 'checks' | 'ready' | 'payment' | 'collect' | 'resume' | 'closed' } {
  if (job.status === 'Collected') return { message: 'This repair is finished. Its records are kept here.', action: '', target: 'closed' }
  if (job.status === 'Cancelled') return { message: 'This repair was cancelled.', action: '', target: 'closed' }
  if (job.status === 'Ready to collect') return balance(job) > 0 ? { message: 'Record the remaining money before returning the item.', action: 'Record payment', target: 'payment' } : { message: 'Payment is complete. Record when the customer takes the item.', action: 'Mark collected', target: 'collect' }
  if (job.status === 'Received') return { message: 'Check the item and write what needs fixing.', action: 'Start diagnosis', target: 'diagnose' }
  if (job.status === 'Waiting for parts') return job.estimateStatus === 'Approved' ? { message:'Continue the approved repair when the parts are ready.', action:'Parts arrived, continue repair', target:'resume' } : { message: 'Add the missing parts when they arrive, then review the price.', action: 'Review repair cost', target: 'estimate' }
  if (job.estimateStatus === 'Sent') return { message: 'Ask the customer if they agree to the price.', action: 'Review repair cost', target: 'estimate' }
  if (job.estimateStatus !== 'Approved') return { message: 'Add parts and labour, then tell the customer the total.', action: 'Prepare estimate', target: 'estimate' }
  return job.checks.every(Boolean) ? { message: 'All checks are complete. Mark this item ready to return.', action: 'Mark ready', target: 'ready' } : { message: 'Finish the repair, then tick the three checks.', action: 'Check repaired item', target: 'checks' }
}
