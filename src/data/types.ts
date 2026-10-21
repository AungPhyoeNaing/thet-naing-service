export const statuses = ['Received', 'Diagnosing', 'Awaiting approval', 'Waiting for parts', 'In repair', 'Ready to collect', 'Collected', 'Cancelled'] as const
export type JobStatus = typeof statuses[number]
export type Category = 'Home appliance' | 'Industrial machine'
export type Priority = 'Normal' | 'High' | 'Urgent'
export interface TimelineEntry { id: string; at: string; text: string }
export interface EstimateLine { id: string; description: string; quantity: number; unitPrice: number; partId?: string }
export interface Job {
  id: string; code: string; customer: string; phone: string; address: string;
  category: Category; equipment: string; brand: string; serial: string; issue: string;
  serviceType: 'Workshop drop-off' | 'On-site visit'; priority: Priority;
  status: JobStatus; technician: string; dueDate: string; createdAt: string;
  diagnosis: string; lines: EstimateLine[]; estimateStatus: 'Draft' | 'Sent' | 'Approved' | 'Declined';
  paid: number; checks: boolean[]; history: TimelineEntry[];
}
export interface Part { id: string; sku: string; name: string; category: string; stock: number; minimum: number; price: number; location: string }
export interface WorkshopData { version: 1; revision: number; demo: boolean; jobs: Job[]; parts: Part[]; technicians: string[] }
export interface WorkshopRepository { load(): Promise<WorkshopData>; save(data: WorkshopData, expectedRevision: number): Promise<WorkshopData> }
export type JobDraft = Pick<Job, 'customer' | 'phone' | 'address' | 'category' | 'equipment' | 'brand' | 'serial' | 'issue' | 'serviceType' | 'priority' | 'technician' | 'dueDate'>
export const finalStatuses: JobStatus[] = ['Collected', 'Cancelled']
