import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

export type Product = {
  product_number: string
  is_active: boolean
}

export type Order = {
  id: number
  order_number: number
  customer_name: string
  phone_number: string
  product_number: string
  shirt_size: (typeof SHIRT_SIZES)[number]
  print_text: string
  prepaid: boolean
  delivered: boolean
  ready_for_pickup: boolean
  ready_for_pickup_at: string | null
  created_at: string
  delivered_at: string | null
  updated_at: string
}

export function formatDate(value: string | null) {
  if (!value) return '–'
  return new Intl.DateTimeFormat('da-DK', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function csvEscape(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}
