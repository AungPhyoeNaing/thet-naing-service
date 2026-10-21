import { AirVent, Cog, Fan, Microwave, Refrigerator, WashingMachine, Zap } from 'lucide-react'
export default function EquipmentIcon({ name, size = 23 }: { name: string; size?: number }) {
  const Icon = /wash/i.test(name) ? WashingMachine : /refrig/i.test(name) ? Refrigerator : /air condition/i.test(name) ? AirVent : /oven/i.test(name) ? Microwave : /motor|compress/i.test(name) ? Zap : /pump/i.test(name) ? Fan : Cog
  return <Icon size={size} strokeWidth={1.6} />
}
