export const statuses = ['Received', 'Diagnosing', 'Awaiting approval', 'Waiting for parts', 'In repair', 'Ready to collect', 'Collected', 'Cancelled'] as const
export type JobStatus = typeof statuses[number]
export type Category = 'Home appliance' | 'Industrial machine'
export type Priority = 'Normal' | 'High' | 'Urgent'
export type WorkshopRole = 'admin' | 'staff'
export interface Membership { user_id: string; role: WorkshopRole; active: boolean; display_name: string; technician_name: string }
export interface TimelineEntry { id: string; at: string; text: string; actorId?: string; actorName?: string }
export interface EstimateLine { id: string; description: string; quantity: number; unitPrice: number; partId?: string }
export const photoStages = ['Intake', 'Diagnosis', 'Repair', 'Quality check', 'Inventory'] as const
export interface WorkshopPhoto { id: string; name: string; stage: typeof photoStages[number]; createdAt: string; uploadedBy: string; caption: string; storagePath?: string; dataUrl?: string }
export interface Job {
  id: string; code: string; customer: string; phone: string; address: string;
  category: Category; equipment: string; brand: string; serial: string; issue: string;
  serviceType: 'Workshop drop-off' | 'On-site visit'; priority: Priority;
  status: JobStatus; technician: string; dueDate: string; createdAt: string;
  diagnosis: string; lines: EstimateLine[]; estimateStatus: 'Draft' | 'Sent' | 'Approved' | 'Declined';
  paid: number; checks: boolean[]; history: TimelineEntry[];
  photos?: WorkshopPhoto[];
}
export interface Part { id: string; sku: string; name: string; category: string; stock: number; minimum: number; price: number; location: string; photos?: WorkshopPhoto[] }
export interface WorkshopData { version: 1; revision: number; demo: boolean; jobs: Job[]; parts: Part[]; technicians: string[] }
export interface WorkshopRepository { load(): Promise<WorkshopData>; save(data: WorkshopData, expectedRevision: number, previous?: WorkshopData, role?: WorkshopRole, restore?: boolean): Promise<WorkshopData> }
export type JobDraft = Pick<Job, 'customer' | 'phone' | 'address' | 'category' | 'equipment' | 'brand' | 'serial' | 'issue' | 'serviceType' | 'priority' | 'technician' | 'dueDate'>
export const finalStatuses: JobStatus[] = ['Collected', 'Cancelled']
