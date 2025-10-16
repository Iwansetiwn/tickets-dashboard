'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import { atom, useAtom } from 'jotai'
import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Sun,
  Moon,
  Home,
  Ticket,
  BarChart3,
  Settings,
  AlertCircle,
  CheckCircle2,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react'
import { motion } from 'framer-motion'

type TicketItem = {
  ticket_id: string
  ticket_url?: string
  subject?: string
  brand?: string
  status?: string
  created_at?: string
  updated_at?: string
  first_reply_at?: string
  first_reply_minutes?: number
  messages?: Array<{ created_at?: string }>
}

const darkModeAtom = atom(true)
const sidebarCollapsedAtom = atom(true)

// robust parser + normalized date-key helper (startOfDay/sameDay removed)
const parseDate = (ts?: string): Date | null => {
  if (!ts) return null
  const raw = String(ts).trim()

  // cleanup common noise
  const cleaned = raw
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
    .replace(/from IP.*$/i, '')
    .replace(/Updated|Created/gi, '')
    .replace(/\s+GMT[+\-]\d{2,4}$/i, '')
    .trim()

  const nowYear = new Date().getFullYear()
  const saneYear = (y: number) => y >= 2000 && y <= nowYear + 2

  // month name -> index map to avoid Date parsing inconsistencies
  const monthMap: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  }

  // 1) ISO / native parse if already well-formed
  let d = new Date(cleaned)
  if (!isNaN(d.getTime()) && saneYear(d.getFullYear())) return d

  // 2) Full month name with time and optional AM/PM, e.g. "Oct 14, 2025, 03:14 AM"
  const monthTime = cleaned.match(
    /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})?[,\s]*?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i
  )
  if (monthTime) {
    const monthName = monthTime[1].toLowerCase()
    const day = Number(monthTime[2])
    const year = monthTime[3] ? Number(monthTime[3]) : nowYear
    let hour = Number(monthTime[4])
    const minute = Number(monthTime[5])
    const second = monthTime[6] ? Number(monthTime[6]) : 0
    const ampm = monthTime[7]

    if (ampm) {
      if (/pm/i.test(ampm) && hour < 12) hour += 12
      if (/am/i.test(ampm) && hour === 12) hour = 0
    }

    const mi = monthMap[monthName]
    if (mi !== undefined) {
      d = new Date(year, mi, day, hour, minute, second)
      if (!isNaN(d.getTime()) && saneYear(d.getFullYear())) return d
    }
  }

  // 3) Month name without time, e.g. "Oct 14, 2025"
  const monthOnly = cleaned.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})?/i)
  if (monthOnly) {
    const mi = monthMap[monthOnly[1].toLowerCase()]
    const day = Number(monthOnly[2])
    const year = monthOnly[3] ? Number(monthOnly[3]) : nowYear
    if (mi !== undefined) {
      d = new Date(year, mi, day)
      if (!isNaN(d.getTime()) && saneYear(d.getFullYear())) return d
    }
  }

  // 4) YYYY-MM-DD or YYYY/MM/DD
  const ymd = cleaned.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/)
  if (ymd) {
    d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    if (!isNaN(d.getTime()) && saneYear(d.getFullYear())) return d
  }

  // 5) MM/DD/YYYY (US)
  const mdy = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (mdy) {
    d = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]))
    if (!isNaN(d.getTime()) && saneYear(d.getFullYear())) return d
  }

  // intentionally avoid very loose fallbacks to prevent accidental matches
  return null
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// (startOfDay / sameDay were removed — use parseDate + dateKey throughout)
// UTC helpers for ISO `Z` timestamps
const isIsoUTC = (s?: string) =>
  typeof s === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(s.trim())
const dateKeyUTC = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

export default function Dashboard() {
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [darkMode, setDarkMode] = useAtom(darkModeAtom)
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom)

  useEffect(() => {
    fetch('/api/tickets')
      .then((res) => res.json())
      .then((data) => setTickets((data as TicketItem[]) || []))
      .catch(() => setTickets([]))
  }, [])

  const formatDate = (dateString?: string, fallback?: string) => {
    const raw = dateString ?? fallback
    const d = parseDate(raw)
    if (!d) return (raw || 'Unknown') as string
    const base: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }
    // If ISO-UTC, display in UTC to avoid local-time shifting the day
    return d.toLocaleString('en-US', isIsoUTC(raw) ? { ...base, timeZone: 'UTC' } : base)
  }

  const normalizeBrand = (name?: string) => {
    if (!name) return 'Unknown'
    let brand = name.trim().replace(/^_+/, '')
    brand = brand
      .split(/[\s.]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('.')
    brand = brand.replace(/\.Com\b/i, '.com').replace(/\.Au\b/i, '.au')
    return brand
  }

  const primaryBlue = '#2563eb'
  const cyan = '#06b6d4'

  const totalTickets = tickets.length
  // stable anchors for "today" / "yesterday" so hooks' deps don't change every render
  const todayDate = useMemo(() => new Date(), [])
  const yesterdayDate = useMemo(
    () => new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 1),
    [todayDate]
  )

  const ticketsToday = useMemo(
    () =>
      tickets.filter((t) => {
        const raw = t.updated_at ?? t.created_at
        const d = parseDate(raw)
        if (!d) return false
        const isUTC = isIsoUTC(raw)
        const itemKey = isUTC ? dateKeyUTC(d) : dateKey(d)
        const todayKey = isUTC ? dateKeyUTC(new Date()) : dateKey(todayDate)
        return itemKey === todayKey
      }).length,
    [tickets, todayDate]
  )
  const ticketsYesterday = useMemo(
    () =>
      tickets.filter((t) => {
        const raw = t.updated_at ?? t.created_at
        const d = parseDate(raw)
        if (!d) return false
        const isUTC = isIsoUTC(raw)
        const itemKey = isUTC ? dateKeyUTC(d) : dateKey(d)
        const yRef = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const yesterdayKey = isUTC ? dateKeyUTC(yRef) : dateKey(yesterdayDate)
        return itemKey === yesterdayKey
      }).length,
    [tickets, yesterdayDate]
  )

  // Perf metrics (today vs yesterday) used by the donut + metric card
  const diff = ticketsToday - ticketsYesterday
  const perfPct =
    ticketsYesterday === 0 ? (ticketsToday > 0 ? 100 : 0) : Math.round((diff / ticketsYesterday) * 100)
  const perfPositive = diff >= 0
  const perfPieData = useMemo(
    () => [
      { name: 'Today', value: ticketsToday, color: primaryBlue },
      { name: 'Yesterday', value: ticketsYesterday, color: cyan },
    ],
    [ticketsToday, ticketsYesterday]
  )
  const [hoveredPerfIndex, setHoveredPerfIndex] = useState<number | null>(null)

  const unsolvedCount = useMemo(
    () =>
      tickets.filter((t) =>
        String(t.status || '').toLowerCase().match(/open|pending|in[-\s]?progress|waiting|todo/)
      ).length,
    [tickets]
  )
  const resolvedCount = useMemo(
    () =>
      tickets.filter((t) =>
        String(t.status || '').toLowerCase().match(/resolved|closed|done|completed/)
      ).length,
    [tickets]
  )

  const avgFirstReplyMins = useMemo(() => {
    const mins: number[] = []
    tickets.forEach((t) => {
      if (typeof t.first_reply_minutes === 'number') mins.push(t.first_reply_minutes)
      else if (t.first_reply_at && t.created_at) {
        const a = new Date(t.first_reply_at).getTime()
        const b = new Date(t.created_at).getTime()
        if (!Number.isNaN(a) && !Number.isNaN(b) && a >= b) mins.push((a - b) / 60000)
      } else if (t.updated_at && t.created_at) {
        const a = new Date(t.updated_at).getTime()
        const b = new Date(t.created_at).getTime()
        if (!Number.isNaN(a) && !Number.isNaN(b) && a >= b) mins.push((a - b) / 60000)
      }
    })
    if (!mins.length) return 0
    return Math.round(mins.reduce((s, v) => s + v, 0) / mins.length)
  }, [tickets])

  const ticketsPerDay = useMemo(() => {
    const counts: Record<string, number> = {}
    tickets.forEach((t) => {
      const d = parseDate(t.updated_at ?? t.created_at)
      if (!d) return
      const key = dateKey(d)
      counts[key] = (counts[key] || 0) + 1
    })

    return Object.keys(counts)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => {
        const [yy, mm, dd] = k.split('-').map((s) => Number(s))
        const label = new Date(yy, mm - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return { key: k, label, count: counts[k] }
      })
  }, [tickets])

  // Averages for donut (created vs resolved per day)
  const avgCreated = useMemo(() => {
    const days = Math.max(ticketsPerDay.length || 1, 1)
    return Math.round((ticketsPerDay.reduce((s, x) => s + x.count, 0) / days) || 0)
  }, [ticketsPerDay])
  const avgResolved = useMemo(() => {
    const days = Math.max(ticketsPerDay.length || 1, 1)
    return Math.round(resolvedCount / days)
  }, [resolvedCount, ticketsPerDay])
  const avgPieData = useMemo(
    () => [
      { name: 'Avg. Created', value: avgCreated, color: cyan },
      { name: 'Avg. Resolved', value: avgResolved, color: primaryBlue },
    ],
    [avgCreated, avgResolved]
  )
  const [hoveredAvgIndex, setHoveredAvgIndex] = useState<number | null>(null)

  type ApiResponse = { success?: boolean; error?: string; message?: string }
  const handleDelete = async (ticketId: string) => {
    if (!confirm(`Delete ticket ${ticketId}?`)) return
    try {
      const res = await fetch(`/api/tickets?id=${encodeURIComponent(ticketId)}`, { method: 'DELETE' })
      const data = (await res.json()) as ApiResponse
      if (data.success) {
        setTickets((prev) => prev.filter((t) => t.ticket_id !== ticketId))
      } else {
        alert(data.error || data.message || 'Failed to delete ticket.')
      }
    } catch {
      alert('Error deleting ticket.')
    }
  }

  // tickets by brand for the new chart
  const ticketsByBrand = useMemo(() => {
    const counts: Record<string, number> = {}
    tickets.forEach((t) => {
      const b = normalizeBrand(t.brand)
      counts[b] = (counts[b] || 0) + 1
    })
    return Object.entries(counts)
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
  }, [tickets])

  const brandChartData = useMemo(
    () => ticketsByBrand.slice(0, 8).map((b) => ({ label: b.brand, value: b.count })),
    [ticketsByBrand]
  )

  // index of hovered brand segment for tooltip/centered title (null = none)
  const [hoveredBrandIndex, setHoveredBrandIndex] = useState<number | null>(null)

  // tooltip for the half-donut (follows theme)
  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const p = payload[0]
    const name = p?.payload?.name ?? p?.name
    const value = p?.payload?.value ?? p?.value
    const color = p?.payload?.color ?? p?.fill
    return (
      <div
        className="rounded-md border px-3 py-2 text-xs shadow-md"
        style={{
          background: darkMode ? 'rgba(20,22,40,0.95)' : '#fff',
          borderColor: darkMode ? '#3a3d5c' : '#e5e7eb',
          color: darkMode ? '#e6e8ff' : '#111',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
          <span className="font-medium">{name}</span>
        </div>
        <div className="mt-1 opacity-80">{Number(value).toLocaleString()} tickets</div>
      </div>
    )
  }

  // tooltip for the daily bars (same look as PieTooltip)
  const DailyBarTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const p = payload[0]
    const label = p?.payload?.label ?? p?.name
    const value = p?.payload?.count ?? p?.value
    return (
      <div
        className="rounded-md border px-3 py-2 text-xs shadow-md"
        style={{
          background: darkMode ? 'rgba(20,22,40,0.95)' : '#fff',
          borderColor: darkMode ? '#3a3d5c' : '#e5e7eb',
          color: darkMode ? '#e6e8ff' : '#111',
        }}
      >
        <div className="font-medium">{label}</div>
        <div className="mt-1 opacity-80">{Number(value).toLocaleString()} tickets</div>
      </div>
    )
  }

  // dynamic bar sizing so charts fill space better across breakpoints
  const ticketsBarSize = Math.max(18, Math.min(48, Math.floor(320 / Math.max(1, ticketsPerDay.length))))
  const brandBarSize = Math.max(18, Math.min(40, Math.floor(320 / Math.max(1, brandChartData.length))))

  // date filter used by the All Tickets list
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const selectedDateLabel = useMemo(() => {
    if (!selectedDateKey) return null
    const found = ticketsPerDay.find((d) => d.key === selectedDateKey)
    if (found?.label) return found.label
    const [y, m, d] = selectedDateKey.split('-').map((x) => Number(x))
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }, [selectedDateKey, ticketsPerDay])

  const filteredTickets = useMemo(() => {
    if (!selectedDateKey) return tickets
    return tickets.filter((t) => {
      const raw = t.updated_at ?? t.created_at
      const d = parseDate(raw)
      if (!d) return false
      const key = isIsoUTC(raw) ? dateKeyUTC(d) : dateKey(d)
      return key === selectedDateKey
    })
  }, [tickets, selectedDateKey])

  return (
    <div className={`flex min-h-screen ${darkMode ? 'dark' : ''}`}>
      {/* sidebar: light/dark mode color variants, hamburger-style collapse */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 256 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="relative shadow-sm overflow-hidden"
        style={{ minWidth: 64 }}
      >
        {/* background layer for light/dark mode + subtle border (z-0) */}
        <div
          className={`absolute inset-0 transition-colors duration-200 z-0 ${
            darkMode
              ? 'bg-[#0b1220] border-r border-[#0f1724]' // dark screenshot color
              : 'bg-[#f4f7f9] border-r border-[#eef3f7]' // light screenshot color
          }`}
        />
        {/* content above background (z-10) */}
        <div className="relative h-full flex flex-col z-10">
         <div className="h-full flex flex-col relative">
          {/* header/logo row
              - hide logo when collapsed so the rail icons sit perfectly centered
              - hamburger centered when collapsed and placed at top with spacing
          */}
           <div className="relative px-3 md:px-6 py-3">
             <div className="flex items-center gap-3">
               {/* show logo + title only when expanded */}
               {!collapsed && (
                 <>
                   <div className="h-9 w-9 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
                     <Home className="h-5 w-5 text-white/90" stroke="#000" />
                   </div>
                   <motion.span
                     className={`ml-2 text-sm font-medium hidden md:inline-block overflow-hidden ${darkMode ? 'text-white/95' : 'text-[#0b1220]'}`}
                     animate={{ opacity: 1 }}
                     transition={{ duration: 0.22 }}
                   >
                    Wes Piro Club
                   </motion.span>
                 </>
               )}
             </div>
  
             {/* hamburger toggle: centered when collapsed; top/right when expanded */}
             <button
               onClick={() => setCollapsed(!collapsed)}
               aria-label="Toggle sidebar"
               title={collapsed ? 'Expand menu' : 'Collapse menu'}
               className={`z-20 inline-flex items-center justify-center h-9 w-9 rounded-md transition-transform ${darkMode ? 'bg-transparent' : 'bg-transparent'}`}
               style={
                 collapsed
                   ? { position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 12 }
                   : { position: 'absolute', right: 12, top: 12 }
               }
             >
               <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.28 }}>
                 <Menu className={`h-5 w-5 ${darkMode ? 'text-white' : 'text-[#0b1220]'}`} />
               </motion.div>
             </button>
           </div>
 
           {/* nav: add top padding when collapsed so hamburger doesn't overlap first item */}
           <nav className={`mt-2 mb-4 flex-1 flex flex-col gap-2 px-1 md:px-2 ${collapsed ? 'items-center pt-16' : 'items-start pt-2'}`}>
             <SidebarItem icon={<Home className="h-5 w-5" />} label="Dashboard" active collapsed={collapsed} />
             <SidebarItem icon={<Ticket className="h-5 w-5" />} label="Tickets" collapsed={collapsed} />
             <SidebarItem icon={<BarChart3 className="h-5 w-5" />} label="Reports" collapsed={collapsed} />
             <SidebarItem icon={<Settings className="h-5 w-5" />} label="Settings" collapsed={collapsed} />
           </nav>
 
          <div className="mt-auto mb-4 px-3 md:px-6 text-xs transition-opacity duration-200" style={{ color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}>
            <motion.div className="hidden md:block" animate={{ opacity: collapsed ? 0 : 1 }} transition={{ duration: 0.2 }}>
              Powered by VisActor
            </motion.div>
          </div>
         </div>
        </div>
      </motion.aside>

      <main className="flex-1 bg-white dark:bg-[#0f111a] text-gray-900 dark:text-white">
        <div className="sticky top-0 z-10 backdrop-blur bg-white/70 dark:bg-[#0f111a]/70 border-b border-[#eef1f4] dark:border-[#1c2133]">
          <div className="px-5 md:px-8 py-4 flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-semibold">Dashboard</h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-[#e5e7eb] dark:border-[#2a2d45] bg-white/70 dark:bg-[#15192a] transition-colors"
              aria-label="Toggle theme"
            >
              <motion.div
                key={darkMode ? 'moon' : 'sun'}
                initial={{ rotate: 180, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                {darkMode ? (
                  <Sun className="h-5 w-5 text-cyan-300" />
                ) : (
                  <Moon className="h-5 w-5 text-blue-600" />
                )}
              </motion.div>
            </button>
          </div>
        </div>

        <div className="px-5 md:px-8 py-8 space-y-8">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          >
            <MetricCard
              icon={<Ticket className="h-5 w-5 text-blue-600" />}
              title="Created Tickets"
              value={totalTickets}
              comparePct={perfPct}
              positive={perfPositive}
            />
            <MetricCard
              icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
              title="Unsolved Tickets"
              value={unsolvedCount}
              comparePct={0}
              positive={true}
            />
            <MetricCard
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              title="Resolved Tickets"
              value={resolvedCount}
              comparePct={0}
              positive={true}
            />
            <MetricCard
              icon={<Clock className="h-5 w-5 text-cyan-600" />}
              title="Average First Reply"
              value={`${avgFirstReplyMins} min`}
              comparePct={0}
              positive={true}
            />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Average Tickets Created — daily comparison bars */}
            <ChartShell
              title="Average Tickets Created"
              icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
              className="min-h-[320px]"
            >
              <div className="flex flex-col gap-4">
                <div className="w-full h-[320px] md:h-[360px] min-h-[260px]">
                  <div className="w-full h-full transform -translate-x-4 md:-translate-x-8">
                    <ResponsiveContainer width="100%" height="100%">
                     <RBarChart
                       data={ticketsPerDay}
                       margin={{ top: 12, right: 12, left: 32, bottom: 24 }}
                     >
                       <defs>
                         <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="0%" stopColor={cyan} stopOpacity={0.95} />
                           <stop offset="100%" stopColor={primaryBlue} stopOpacity={0.95} />
                         </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#2b2f45' : '#eef2f7'} />
                       <XAxis
                         dataKey="label"
                         tick={{ fill: darkMode ? '#cfd2ff' : '#6b7280', fontSize: 12 }}
                         interval={0}
                         angle={0}
                       />
                       <YAxis tick={{ fill: darkMode ? '#cfd2ff' : '#6b7280', fontSize: 12 }} />
                       {/* remove white hover rectangle and match tooltip styling */}
                       <RTooltip content={<DailyBarTooltip />} cursor={{ fill: 'transparent' }} />
                       <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={ticketsBarSize}>
                         {ticketsPerDay.map((d) => (
                           <Cell
                             key={d.key}
                             fill={selectedDateKey === d.key ? cyan : 'url(#dailyFill)'}
                             cursor="pointer"
                             onClick={() =>
                               setSelectedDateKey((prev) => (prev === d.key ? null : d.key))
                             }
                           />
                         ))}
                       </Bar>
                     </RBarChart>
                    </ResponsiveContainer>
                  </div>
                 </div>

                {/* Daily counts scroller with selectable dates (kept for quick access) */}
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Daily counts</div>
                    {selectedDateKey && (
                      <button
                        onClick={() => setSelectedDateKey(null)}
                        className="text-xs text-blue-600 dark:text-cyan-300 hover:underline"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                  <DailyScroll
                    data={ticketsPerDay}
                    selectedKey={selectedDateKey}
                    onSelect={(k) => setSelectedDateKey((prev) => (prev === k ? null : k))}
                    darkMode={darkMode}
                  />
                </div>
              </div>
            </ChartShell>

            {/* Ticket Performance (Today vs Yesterday) — semicircle donut */}
            <ChartShell
              title="Ticket Performance (Today vs Yesterday)"
              icon={<Activity className="h-5 w-5 text-blue-600" />}
              className="min-h-[320px]"
            >
              <div className="flex flex-col gap-4">
                <div className="w-full h-[320px] md:h-[360px] min-h-[260px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <RTooltip content={<PieTooltip />} />
                      <Pie
                        data={perfPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="62%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="60%"
                        outerRadius="92%"
                        paddingAngle={8}
                        cornerRadius={12}
                        stroke="transparent"
                        onMouseEnter={(_, i) => setHoveredPerfIndex(i)}
                        onMouseLeave={() => setHoveredPerfIndex(null)}
                      >
                        {perfPieData.map((entry, idx) => (
                          <Cell key={`perf-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* top centered label (hovered segment or title) */}
                  <div className="absolute left-1/2 top-6 -translate-x-1/2 text-center pointer-events-none">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {hoveredPerfIndex !== null ? perfPieData[hoveredPerfIndex].name : 'Today vs Yesterday'}
                    </div>
                  </div>

                  {/* bottom centered result */}
                  <div
                    className="absolute left-1/2 w-full -translate-x-1/2 text-center pointer-events-none"
                    style={{ top: '68%' }}
                  >
                    <div className="text-sm text-gray-600 dark:text-gray-400">Difference vs yesterday</div>
                    <div className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white tabular-nums">
                      {diff >= 0 ? '+' : ''}
                      {diff}
                    </div>
                    <div
                      className={`mt-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${
                        perfPositive
                          ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'text-rose-700 border-rose-200 bg-rose-50 dark:bg-rose-900/20'
                      }`}
                    >
                      {perfPositive ? '▲' : '▼'} {Math.abs(perfPct)}%
                      <span className="opacity-70 ml-1">({perfPieData[0].value.toLocaleString()} vs {perfPieData[1].value.toLocaleString()})</span>
                    </div>
                  </div>
                </div>
              </div>
            </ChartShell>

            {/* Tickets by Brand (semicircle donut with center total + legend) */}
            <ChartShell
              title="Tickets by Brand"
              icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
              className="min-h-[320px]"
            >
              <div className="flex flex-col gap-4">
                <div className="w-full h-[320px] md:h-[360px] min-h-[260px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                     <RTooltip content={<PieTooltip />} />
                      {(() => {
                        const palette = ['#2563eb', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6', '#f97316', '#ef4444', '#06b6d4']
                        const pieData = brandChartData.map((b, i) => ({
                          name: b.label,
                          value: b.value,
                          color: palette[i % palette.length],
                        }))

                        return (
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="62%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius="60%"
                            outerRadius="92%"
                            paddingAngle={6}
                            cornerRadius={12}
                            stroke="transparent"
                            onMouseEnter={(_, index) => setHoveredBrandIndex(index)}
                            onMouseLeave={() => setHoveredBrandIndex(null)}
                          >
                            {pieData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.color} />
                            ))}
                          </Pie>
                        )
                      })()}
                    </PieChart>
                  </ResponsiveContainer>

                  {/* centered top brand (hovered), fallback to title */}
                  <div className="absolute left-1/2 top-6 transform -translate-x-1/2 text-center pointer-events-none">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {hoveredBrandIndex !== null && brandChartData[hoveredBrandIndex]
                        ? brandChartData[hoveredBrandIndex].label
                        : 'Top brands'}
                    </div>
                  </div>

                  {/* center total overlay */}
                  <div
                    className="absolute left-1/2 transform -translate-x-1/2 text-center pointer-events-none w-full"
                    style={{ top: '68%' }} // place just below the half-donut, centered
                  >
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Replied Tickets</div>
                    <div className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white">
                    <br />
                      {brandChartData.reduce((s, b) => s + b.value, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </ChartShell>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <Card className="border border-[#eef1f4] dark:border-[#2a2d45]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-blue-600 dark:text-cyan-300 text-lg">All Tickets</CardTitle>
                  {selectedDateLabel && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600 dark:text-gray-300">Filtered by</span>
                      <span className="px-2 py-0.5 rounded-md border border-[#e5e7eb] dark:border-[#2a2d45]">
                        {selectedDateLabel}
                      </span>
                      <button
                        onClick={() => setSelectedDateKey(null)}
                        className="text-blue-600 dark:text-cyan-300 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-gray-600 dark:text-cyan-200 border-b border-[#eef1f4] dark:border-[#2a2d45]">
                        <th className="py-2 px-4 text-left">Ticket ID</th>
                        <th className="py-2 px-4 text-left">Subject</th>
                        <th className="py-2 px-4 text-left">Brand</th>
                        <th className="py-2 px-4 text-left">Status</th>
                        <th className="py-2 px-4 text-left">Updated</th>
                        <th className="py-2 px-4 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.map((t, i) => (
                        <tr
                          key={i}
                          className="border-b border-[#eef1f4] dark:border-[#2a2d45] hover:bg-[#f5f7fb] dark:hover:bg-[#202341]/80 transition-colors"
                        >
                          <td className="py-2 px-4">
                            <a
                              href={t.ticket_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-cyan-300 hover:underline"
                            >
                              {t.ticket_id}
                            </a>
                          </td>
                          <td className="py-2 px-4 text-gray-700 dark:text-gray-300">{t.subject}</td>
                          <td className="py-2 px-4 text-gray-700 dark:text-[#a0aaff]">
                            {normalizeBrand(t.brand)}
                          </td>
                          <td className="py-2 px-4 text-gray-600 dark:text-gray-400">{t.status}</td>
                          <td className="py-2 px-4 text-gray-500 dark:text-gray-500">
                            {formatDate(t.updated_at, t.created_at)}
                          </td>
                          <td className="py-2 px-4">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(t.ticket_id)}
                              className="bg-gradient-to-r from-red-500 to-pink-600 text-white"
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  )
}

function SidebarItem({
  icon,
  label,
  active,
  collapsed,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  collapsed: boolean
}) {
  const [darkMode] = useAtom(darkModeAtom)

  // styles depend on theme
  const textColor = darkMode ? 'text-white/95' : 'text-[#0b1220]'
  const iconBg = darkMode ? 'bg-transparent' : 'bg-transparent'
  const iconWrapBase = `${collapsed ? 'h-10 w-10' : 'h-9 w-9'} inline-flex items-center justify-center rounded-md`

  // active visuals: left bar in expanded, ring in collapsed
  const activeLeftBar = !collapsed && active ? (darkMode ? 'bg-[#2b7fa0]' : 'bg-[#dde8ef]') : undefined
  const collapsedRing = collapsed && active ? (darkMode ? 'ring-2 ring-[#2b7fa0]/50' : 'ring-2 ring-[#2563eb]/12') : ''

  const anchor = collapsed
    ? `relative w-full flex items-center justify-center p-2 ${darkMode ? 'hover:bg-white/03' : 'hover:bg-black/02'}`
    : `relative w-full flex items-center gap-3 pl-6 pr-4 py-2 ${darkMode ? 'hover:bg-white/03' : 'hover:bg-black/02'}`

  return (
    <div className="group w-full relative">
      <a className={anchor} title={label} role="button" tabIndex={0}>
        {/* left indicator for expanded active item */}
        {!collapsed && active && <span className={`absolute left-3 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full ${activeLeftBar}`} />}

        <span className={`${iconWrapBase} ${iconBg} ${collapsedRing}`}>
          {React.isValidElement(icon)
            ? React.cloneElement(icon, {
                className: `${(icon.props?.className || '')} ${darkMode ? 'text-white' : 'text-[#0b1220]'}`.trim(),
                stroke: 'currentColor', // ensure SVG stroke follows the text color
                fill: 'none',
              })
            : icon}
        </span>

        {!collapsed && <span className={`text-sm font-medium ml-2 ${textColor}`}>{label}</span>}
      </a>

      {/* tooltip for collapsed state (keyboard & hover) */}
      {collapsed && (
        <div
          className={`pointer-events-none absolute left-16 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${darkMode ? 'bg-[#0b1220] text-white' : 'bg-white text-[#0b1220]'}`}
        >
          {label}
        </div>
      )}
    </div>
  )
}

function MetricCard({
  icon,
  title,
  value,
  comparePct,
  positive,
}: {
  icon: React.ReactNode
  title: string
  value: number | string
  comparePct: number
  positive: boolean
}) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 12, scale: 0.98 }, visible: { opacity: 1, y: 0, scale: 1 } }}>
      <Card className="bg-white dark:bg-[#14192a] border border-[#eef1f4] dark:border-[#24273a] h-full">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            {icon}
            <span>{title}</span>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="flex items-end justify-between tabular-nums">
            <div className="text-2xl md:text-3xl font-semibold">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-md border ${
                positive
                  ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'text-rose-700 border-rose-200 bg-rose-50 dark:bg-rose-900/20'
              }`}
            >
              {positive ? '▲' : '▼'} {Math.abs(comparePct)}%
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-1">Compare to last week</div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ChartShell({
  title,
  icon,
  children,
  className = '',
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`bg-white dark:bg-[#14192a] border border-[#eef1f4] dark:border-[#24273a] ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-gray-800 dark:text-gray-200 text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <div className="flex-1">
        <div className="text-sm text-gray-600 dark:text-gray-300">{label}</div>
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value}</div>
      </div>
    </div>
  )
}

function DailyScroll({
  data,
  selectedKey,
  onSelect,
  darkMode,
}: {
  data: Array<{ key: string; label: string; count: number }>
  selectedKey: string | null
  onSelect: (key: string) => void
  darkMode: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const btnCls =
    'absolute top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md bg-white/70 dark:bg-[#1a2033] border border-[#e5e7eb] dark:border-[#2a2d45] backdrop-blur hover:opacity-100 opacity-90'
  return (
    <div className="relative">
      <button
        className={`${btnCls} left-1`}
        onClick={() => ref.current?.scrollBy({ left: -220, behavior: 'smooth' })}
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div ref={ref} className="overflow-x-auto whitespace-nowrap px-10 py-2">
        <div className="inline-flex gap-3">
          {data.map((d) => {
            const active = selectedKey === d.key
            return (
              <button
                key={d.key}
                onClick={() => onSelect(d.key)}
                className={`px-3 py-2 rounded-lg border text-left min-w-[120px] ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-cyan-400 dark:bg-cyan-900/20 dark:text-cyan-200'
                    : 'border-[#e5e7eb] dark:border-[#2a2d45] bg-white dark:bg-[#15192a] text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="text-sm">{d.label}</div>
                <div className="text-lg font-semibold tabular-nums">{d.count.toLocaleString()}</div>
              </button>
            )
          })}
        </div>
      </div>
      <button
        className={`${btnCls} right-1`}
        onClick={() => ref.current?.scrollBy({ left: 220, behavior: 'smooth' })}
        aria-label="Scroll right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
