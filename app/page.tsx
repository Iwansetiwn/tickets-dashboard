'use client'

import { useEffect, useMemo, useState } from 'react'
import { atom, useAtom } from 'jotai'
import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
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

const darkModeAtom = atom(false)
const sidebarCollapsedAtom = atom(false)

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
// robust local-day comparison (handles timezone/parsing differences)
const sameDay = (ts?: string, anchor?: Date) => {
  if (!ts || !anchor) return false
  const d = new Date(ts)
  if (isNaN(d.getTime())) return false
  return (
    d.getFullYear() === anchor.getFullYear() &&
    d.getMonth() === anchor.getMonth() &&
    d.getDate() === anchor.getDate()
  )
}

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown'
    const cleaned = dateString
      .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
      .replace(/from IP.*$/i, '')
      .replace(/Updated|Created/gi, '')
      .trim()
    let parsed = new Date(cleaned)
    if (isNaN(parsed.getTime())) {
      const match = cleaned.match(
        /([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})?\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)?)/i
      )
      if (match) {
        const normalized = `${match[1]} ${match[2]}, ${match[3] || new Date().getFullYear()} ${match[4]}`
        parsed = new Date(normalized)
      }
    }
    if (isNaN(parsed.getTime())) return cleaned
    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
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
  const todayDate = new Date()
  const yesterdayDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 1)
  // both anchors are start-of-day local dates
  // (startOfDay is available if needed elsewhere)

  const ticketsToday = useMemo(
    () => tickets.filter((t) => sameDay(t.created_at, todayDate)).length,
    [tickets]
  )
  const ticketsYesterday = useMemo(
    () => tickets.filter((t) => sameDay(t.created_at, yesterdayDate)).length,
    [tickets]
  )

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
      if (!t.created_at) return
      let d = new Date(t.created_at)
      // fallback parse for non-ISO / messy strings like "Oct 15, 2025 11:25 PM"
      if (isNaN(d.getTime())) {
        const match = String(t.created_at).match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})?/)
        if (match) {
          const normalized = `${match[1]} ${match[2]}, ${match[3] || new Date().getFullYear()}`
          d = new Date(normalized)
        }
      }
      if (isNaN(d.getTime())) return

      // use local date key YYYY-MM-DD to avoid timezone/locale collisions
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const key = `${y}-${m}-${day}`

      counts[key] = (counts[key] || 0) + 1
    })

    // produce sorted array and format labels consistently
    return Object.keys(counts)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => {
        const [yy, mm, dd] = k.split('-').map((s) => Number(s))
        const label = new Date(yy, mm - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return { date: label, count: counts[k] }
      })
  }, [tickets])

  const perfData = useMemo(
    () => [
      { label: 'Today', value: ticketsToday },
      { label: 'Yesterday', value: ticketsYesterday },
    ],
    [ticketsToday, ticketsYesterday]
  )
  const diff = ticketsToday - ticketsYesterday
  const perfPct =
    ticketsYesterday === 0 ? (ticketsToday > 0 ? 100 : 0) : Math.round((diff / ticketsYesterday) * 100)
  const perfPositive = diff >= 0

  const handleDelete = async (ticketId: string) => {
    if (!confirm(`Delete ticket ${ticketId}?`)) return
    try {
      const res = await fetch(`/api/tickets?id=${encodeURIComponent(ticketId)}`, { method: 'DELETE' })
      const data = await res.json()
      if ((data as any).success) {
        setTickets((prev) => prev.filter((t) => t.ticket_id !== ticketId))
      } else {
        alert((data as any).error || (data as any).message || 'Failed to delete ticket.')
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

  // dynamic bar sizing so charts fill space better across breakpoints
  const ticketsBarSize = Math.max(18, Math.min(48, Math.floor(320 / Math.max(1, ticketsPerDay.length))))
  const perfBarSize = Math.max(20, Math.min(40, Math.floor(320 / Math.max(1, perfData.length))))
  const brandBarSize = Math.max(18, Math.min(40, Math.floor(320 / Math.max(1, brandChartData.length))))

  return (
    <div className={`flex min-h-screen ${darkMode ? 'dark' : ''}`}>
      <aside
        className={`${collapsed ? 'w-[70px]' : 'w-[70px] md:w-64'} bg-gradient-to-b from-blue-500 to-cyan-400 text-white relative shadow-sm transition-all duration-300 ease-in-out`}
      >
        <div className="h-full flex flex-col">
          <div className="px-3 md:px-6 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white/10" />
            <span
              className={`ml-2 text-sm font-medium hidden md:inline-block transition-all duration-300 ease-in-out md:overflow-hidden ${
                collapsed ? 'md:max-w-0 md:opacity-0' : 'md:max-w-full md:opacity-100'
              }`}
            >
              VisActor Dash
            </span>
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Toggle sidebar"
              className="ml-auto inline-flex items-center justify-center h-8 w-8 rounded-md bg-white/8 hover:bg-white/16 transition-transform duration-300"
            >
              <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.28 }}>
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </motion.div>
            </button>
          </div>

          <nav className="mt-4 space-y-2">
            <SidebarItem icon={<Home className="h-5 w-5" />} label="Dashboard" active collapsed={collapsed} />
            <SidebarItem icon={<Ticket className="h-5 w-5" />} label="Tickets" collapsed={collapsed} />
            <SidebarItem icon={<BarChart3 className="h-5 w-5" />} label="Reports" collapsed={collapsed} />
            <SidebarItem icon={<Settings className="h-5 w-5" />} label="Settings" collapsed={collapsed} />
          </nav>

          <div className="mt-auto mb-4 px-3 md:px-6 text-xs text-white/80">
            <div className={`hidden md:inline-block transition-opacity duration-300 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
              Powered by VisActor
            </div>
          </div>
        </div>
      </aside>

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
            {/* Average Tickets Created */}
            <ChartShell
              title="Average Tickets Created"
              icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
              className="min-h-[320px]"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4">
                  <div className="flex flex-col sm:flex-row sm:gap-6">
                    <LegendRow
                      color={cyan}
                      label="Avg. Created"
                      value={Math.round(
                        (ticketsPerDay.reduce((s, x) => s + x.count, 0) /
                          Math.max(ticketsPerDay.length || 1, 1)) || 0
                      ).toLocaleString()}
                    />
                    <LegendRow
                      color={primaryBlue}
                      label="Avg. Resolved"
                      value={Math.round(resolvedCount / Math.max(ticketsPerDay.length || 1, 1)).toLocaleString()}
                    />
                  </div>
                </div>

                <div className="w-full h-[320px] md:h-[360px] min-h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RBarChart
                      data={ticketsPerDay}
                      // provide extra left gutter so Y axis and grid labels aren't cut off
                      margin={{ top: 12, right: 12, left: 48, bottom: 12 }}
                    >
                      <defs>
                        <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={cyan} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={primaryBlue} stopOpacity={0.95} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#2b2f45' : '#eef2f7'} />
                      <XAxis dataKey="date" tick={{ fill: darkMode ? '#cfd2ff' : '#6b7280', fontSize: 12 }} />
                      <YAxis tick={{ fill: darkMode ? '#cfd2ff' : '#6b7280', fontSize: 12 }} />
                      <RTooltip
                        contentStyle={{
                          backgroundColor: darkMode ? 'rgba(20,22,40,0.95)' : '#fff',
                          border: `1px solid ${darkMode ? '#3a3d5c' : '#e5e7eb'}`,
                          borderRadius: '10px',
                          color: darkMode ? '#e6e8ff' : '#111',
                        }}
                      />
                      <Bar dataKey="count" fill="url(#barFill)" radius={[6, 6, 0, 0]} barSize={ticketsBarSize} />
                    </RBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </ChartShell>

            {/* Ticket Performance (Today vs Yesterday) */}
            <ChartShell
              title="Ticket Performance (Today vs Yesterday)"
              icon={<Activity className="h-5 w-5 text-blue-600" />}
              className="min-h-[320px]"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center">
                  <div className="text-4xl font-semibold tracking-tight tabular-nums">
                    {diff >= 0 ? '+' : ''}
                    {diff}
                  </div>
                  <div className="text-base font-normal text-gray-500">tickets</div>
                  <div
                    className={`mt-2 inline-flex items-center gap-1 text-sm px-3 py-1 rounded-md border tabular-nums ${
                      perfPositive
                        ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'text-rose-700 border-rose-200 bg-rose-50 dark:bg-rose-900/20'
                    }`}
                  >
                    {perfPositive ? '▲' : '▼'} {Math.abs(perfPct)}%
                    <span className="text-gray-500 ml-2">vs yesterday</span>
                  </div>
                </div>

                <div className="w-full h-[320px] md:h-[360px] min-h-[260px]">
                  {/* nudge left so chart surface is visually centered; reduce left gutter and Y width */}
                  <div className="w-full h-full transform md:-translate-x-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <RBarChart
                        data={perfData}
                        layout="vertical"
                        margin={{ top: 12, right: 8, left: 36, bottom: 12 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#2b2f45' : '#eef2f7'} />
                        <XAxis type="number" tick={{ fill: darkMode ? '#cfd2ff' : '#6b7280' }} />
                        {/* slightly smaller reserved width so chart area grows */}
                        <YAxis type="category" dataKey="label" tick={{ fill: darkMode ? '#cfd2ff' : '#6b7280' }} width={100} />
                        <RTooltip
                          contentStyle={{
                            backgroundColor: darkMode ? 'rgba(20,22,40,0.95)' : '#fff',
                            border: `1px solid ${darkMode ? '#3a3d5c' : '#e5e7eb'}`,
                            borderRadius: '10px',
                            color: darkMode ? '#e6e8ff' : '#111',
                          }}
                        />
                        <Bar dataKey="value" radius={[6, 6, 6, 6]} fill={primaryBlue} barSize={perfBarSize} barCategoryGap="20%" />
                      </RBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ChartShell>

            {/* Tickets by Brand */}
            <ChartShell
              title="Tickets by Brand"
              icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
              className="min-h-[320px]"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Top brands</div>
                </div>

                <div className="w-full h-[320px] md:h-[360px] min-h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RBarChart
                      data={brandChartData}
                      layout="vertical"
                      // extra left margin so long brand labels don't get clipped
                      margin={{ top: 8, right: 12, left: 44, bottom: 12 }}
                    >
                      <defs>
                        <linearGradient id="brandFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={cyan} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={primaryBlue} stopOpacity={0.95} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#2b2f45' : '#eef2f7'} />
                      <XAxis type="number" tick={{ fill: darkMode ? '#cfd2ff' : '#6b7280' }} />
                      <YAxis type="category" dataKey="label" tick={{ fill: darkMode ? '#cfd2ff' : '#6b7280' }} />
                      <RTooltip
                        formatter={(value: any) => [`${value}`, 'tickets']}
                        contentStyle={{
                          backgroundColor: darkMode ? 'rgba(20,22,40,0.95)' : '#fff',
                          border: `1px solid ${darkMode ? '#3a3d5c' : '#e5e7eb'}`,
                          borderRadius: '10px',
                          color: darkMode ? '#e6e8ff' : '#111',
                        }}
                      />
                      <Bar dataKey="value" fill="url(#brandFill)" radius={[6, 6, 6, 6]} barSize={brandBarSize} />
                    </RBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </ChartShell>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <Card className="border border-[#eef1f4] dark:border-[#2a2d45]">
              <CardHeader>
                <CardTitle className="text-blue-600 dark:text-cyan-300 text-lg">All Tickets</CardTitle>
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
                      {tickets.map((t, i) => (
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
                            {formatDate(t.updated_at)}
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
  return (
    <div className="group relative">
      <a
        className={`mx-2 md:mx-3 flex items-center md:gap-3 rounded-md px-3 py-2 transition-colors ${
          active ? 'bg-white/12' : 'hover:bg-white/8'
        }`}
        title={label}
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10">{icon}</span>
        <span
          className={`ml-3 text-sm font-medium hidden md:inline-block transition-all duration-300 ease-in-out md:overflow-hidden ${
            collapsed ? 'md:max-w-0 md:opacity-0' : 'md:max-w-full md:opacity-100'
          }`}
        >
          {label}
        </span>
      </a>
      <div
        className={`pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 rounded-md bg-white text-gray-900 px-2 py-1 text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
          collapsed ? '' : 'md:hidden'
        }`}
      >
        {label}
      </div>
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
