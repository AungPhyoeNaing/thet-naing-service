import { dateOffset } from '../lib/format'
import type { Job, Part, WorkshopData } from './types'
const parts: Part[] = [
  { id: 'p1', sku: 'CAP-35', name: '35 μF run capacitor', category: 'Electrical', stock: 12, minimum: 5, price: 18000, location: 'Shelf A-01' },
  { id: 'p2', sku: 'BRG-6205', name: '6205 motor bearing', category: 'Mechanical', stock: 3, minimum: 5, price: 22000, location: 'Shelf B-03' },
  { id: 'p3', sku: 'BLT-A42', name: 'A42 drive belt', category: 'Mechanical', stock: 8, minimum: 3, price: 15000, location: 'Shelf B-01' },
  { id: 'p4', sku: 'PMP-W01', name: 'Washing machine drain pump', category: 'Appliance', stock: 2, minimum: 3, price: 45000, location: 'Shelf A-04' },
  { id: 'p5', sku: 'RLY-24', name: '24V control relay', category: 'Electrical', stock: 6, minimum: 3, price: 28000, location: 'Shelf A-02' },
  { id: 'p6', sku: 'THM-R02', name: 'Refrigerator thermostat', category: 'Appliance', stock: 4, minimum: 2, price: 35000, location: 'Shelf A-03' },
  { id: 'p7', sku: 'SEAL-32', name: '32 mm mechanical seal', category: 'Mechanical', stock: 0, minimum: 2, price: 24000, location: 'Shelf B-04' },
  { id: 'p8', sku: 'SW-16A', name: '16A safety switch', category: 'Electrical', stock: 9, minimum: 4, price: 12000, location: 'Shelf A-02' },
]
function job(index: number, values: Partial<Job>): Job {
  const createdAt = dateOffset(-index % 5) + 'T03:00:00Z'
  return {
    id: 'demo-job-' + index, code: 'TN-' + (1048 - index), customer: 'Example customer', phone: '000-000-0000', address: 'Mandalay',
    category: 'Home appliance', equipment: 'Washing machine', brand: '', serial: '', issue: '', serviceType: 'Workshop drop-off', priority: 'Normal',
    status: 'Received', technician: '', dueDate: dateOffset(2), createdAt, diagnosis: '', lines: [], estimateStatus: 'Draft', paid: 0, checks: [false, false, false],
    history: [{ id: 'h-' + index, at: createdAt, text: 'Service request received at the workshop.' }], ...values,
  }
}
export function createSeed(): WorkshopData {
  return { version: 1, revision: 0, demo: true, technicians: ['Ko Aung', 'Ko Min', 'Ko Zaw'], parts: structuredClone(parts), jobs: [
    job(0, { customer: 'Example household A', equipment: 'Washing machine', brand: 'Samsung · 8 kg', issue: 'Drum does not spin. A humming sound starts after filling.', priority: 'High', dueDate: dateOffset(1) }),
    job(1, { customer: 'Example workshop', category: 'Industrial machine', equipment: 'Air compressor', brand: 'Fusheng · 3 HP', issue: 'Pressure drops during operation; motor overheats.', serviceType: 'On-site visit', priority: 'Urgent', dueDate: dateOffset(0), technician: 'Ko Aung' }),
    job(2, { customer: 'Example household B', equipment: 'Refrigerator', brand: 'Panasonic · 2 door', issue: 'Freezer works but lower compartment is warm.', status: 'Diagnosing', technician: 'Ko Min', dueDate: dateOffset(0) }),
    job(3, { customer: 'Example bakery', category: 'Industrial machine', equipment: 'Dough mixer', brand: 'Spiral mixer · 20 L', issue: 'Grinding noise when the bowl rotates.', status: 'In repair', technician: 'Ko Aung', priority: 'High', diagnosis: 'Worn drive bearing. Replace bearing and align drive.', estimateStatus: 'Approved', lines: [{ id: 'e31', description: '6205 motor bearing', partId: 'p2', quantity: 2, unitPrice: 22000 }, { id: 'e32', description: 'Bearing replacement and alignment', quantity: 1, unitPrice: 45000 }], dueDate: dateOffset(0) }),
    job(4, { customer: 'Example household C', equipment: 'Air conditioner', brand: 'Midea · 1.5 HP', issue: 'Unit runs but does not cool the room.', status: 'In repair', technician: 'Ko Zaw', diagnosis: 'Failed run capacitor. Clean filters and replace capacitor.', estimateStatus: 'Approved', lines: [{ id: 'e41', description: '35 μF run capacitor', partId: 'p1', quantity: 1, unitPrice: 18000 }, { id: 'e42', description: 'Service and installation', quantity: 1, unitPrice: 30000 }], serviceType: 'On-site visit', dueDate: dateOffset(1) }),
    job(5, { customer: 'Example household D', equipment: 'Water pump', brand: 'Leo · 1 HP', issue: 'Water leaks at the motor shaft.', status: 'Waiting for parts', technician: 'Ko Min', diagnosis: 'Mechanical seal needs replacement. Waiting for supplier.', dueDate: dateOffset(-1), priority: 'High' }),
    job(6, { customer: 'Example rice mill', category: 'Industrial machine', equipment: 'Electric motor', brand: '3-phase · 5 HP', issue: 'Motor trips the breaker under load.', status: 'Awaiting approval', technician: 'Ko Aung', diagnosis: 'Replace control relay and test insulation.', estimateStatus: 'Sent', lines: [{ id: 'e61', description: '24V control relay', partId: 'p5', quantity: 1, unitPrice: 28000 }, { id: 'e62', description: 'Electrical diagnosis and repair', quantity: 1, unitPrice: 65000 }], dueDate: dateOffset(2) }),
    job(7, { customer: 'Example household E', equipment: 'Washing machine', brand: 'LG · 7 kg', issue: 'Water remains in the drum after the cycle.', status: 'Awaiting approval', technician: 'Ko Min', diagnosis: 'Drain pump seized. Replacement required.', estimateStatus: 'Sent', lines: [{ id: 'e71', description: 'Washing machine drain pump', partId: 'p4', quantity: 1, unitPrice: 45000 }, { id: 'e72', description: 'Pump replacement', quantity: 1, unitPrice: 25000 }] }),
    job(8, { customer: 'Example household F', equipment: 'Refrigerator', brand: 'Sharp · 180 L', issue: 'Compressor keeps running; temperature is too cold.', status: 'Ready to collect', technician: 'Ko Zaw', diagnosis: 'Thermostat replaced. Temperature stable after 6-hour test.', estimateStatus: 'Approved', checks: [true, true, true], lines: [{ id: 'e81', description: 'Refrigerator thermostat', partId: 'p6', quantity: 1, unitPrice: 35000 }, { id: 'e82', description: 'Replacement and testing', quantity: 1, unitPrice: 20000 }], dueDate: dateOffset(0), paid: 30000 }),
    job(9, { customer: 'Example metalworks', category: 'Industrial machine', equipment: 'Bench grinder', brand: 'Total · 350 W', issue: 'Machine vibrates excessively.', status: 'Ready to collect', technician: 'Ko Aung', diagnosis: 'Wheel balanced, bearing adjusted. Load test passed.', estimateStatus: 'Approved', checks: [true, true, true], lines: [{ id: 'e91', description: 'Balancing, adjustment and testing', quantity: 1, unitPrice: 40000 }], dueDate: dateOffset(0), paid: 40000 }),
    job(10, { customer: 'Example household G', equipment: 'Electric oven', brand: 'Electrolux · 40 L', issue: 'Oven does not heat.', status: 'Collected', technician: 'Ko Zaw', diagnosis: 'Safety switch replaced.', estimateStatus: 'Approved', checks: [true, true, true], lines: [{ id: 'e101', description: 'Switch replacement and service', quantity: 1, unitPrice: 42000 }], paid: 42000, dueDate: dateOffset(-1) }),
  ] }
}
export function emptyWorkshop(): WorkshopData { return { version: 1, revision: 0, demo: false, jobs: [], parts: [], technicians: ['Ko Aung', 'Ko Min', 'Ko Zaw'] } }
