import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bell, BriefcaseBusiness, CalendarDays, CalendarClock, CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, Download, ExternalLink, Filter, LayoutDashboard, List, LogOut, Mail, MoreHorizontal, Plus, Search, Sparkles, Target, Trash2, TrendingUp, Upload, UserRound, X } from 'lucide-react'

const stages = ['Wishlist', 'Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn']
const seed = [
  { id: 'demo-1', company: 'Linear', role: 'Product Designer', location: 'Remote · US', work_mode: 'Remote', status: 'Interview', source: 'Company website', job_url: 'https://linear.app', salary: '$145k – $175k', applied_on: '2026-10-28', follow_up: '2026-11-10', notes: 'Portfolio review with the design team next week.' },
  { id: 'demo-2', company: 'Vercel', role: 'Frontend Engineer', location: 'New York, NY', work_mode: 'Hybrid', status: 'Applied', source: 'LinkedIn', job_url: 'https://vercel.com', salary: '$160k – $210k', applied_on: '2026-11-02', follow_up: '2026-11-12', notes: '' },
  { id: 'demo-3', company: 'Figma', role: 'Product Designer, Growth', location: 'San Francisco, CA', work_mode: 'Hybrid', status: 'Applied', source: 'Referral', job_url: 'https://figma.com', salary: '$150k – $190k', applied_on: '2026-11-01', follow_up: null, notes: 'Referred by Maya Chen.' },
  { id: 'demo-4', company: 'Notion', role: 'Product Designer', location: 'San Francisco, CA', work_mode: 'On-site', status: 'Wishlist', source: 'Wellfound', job_url: 'https://notion.so', salary: '$140k – $180k', applied_on: null, follow_up: null, notes: 'Tailor portfolio case studies before applying.' },
  { id: 'demo-5', company: 'Stripe', role: 'Design Engineer', location: 'Remote · US', work_mode: 'Remote', status: 'Interview', source: 'Company website', job_url: 'https://stripe.com', salary: '$170k – $220k', applied_on: '2026-10-21', follow_up: '2026-11-09', notes: 'Recruiter screen complete. Prepare systems design examples.' },
]
const blank = { company: '', role: '', location: '', work_mode: 'Remote', status: 'Wishlist', source: '', job_url: '', salary: '', applied_on: '', follow_up: '', notes: '' }
const initials = (company) => company.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()
const colors = ['violet', 'blue', 'orange', 'green', 'pink', 'teal']
const companyColor = (company) => colors[[...company].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % colors.length]
const prettyDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const escapeIcs = (value = '') => String(value).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;')
function exportCalendarIcs(events) {
  const stamp = new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '')
  const entries = events.map((event) => {
    const details = `${event.company} · ${event.role}`
    const startDate = event.date.replaceAll('-', '')
    const base = ['BEGIN:VEVENT', `UID:nextstep-${escapeIcs(event.id)}@nextstep.local`, `DTSTAMP:${stamp}`, `SUMMARY:${escapeIcs(`${event.title} · ${details}`)}`, `DESCRIPTION:${escapeIcs(details)}`]
    if (event.kind === 'interview' && event.scheduled_at) {
      const start = new Date(event.scheduled_at); const end = new Date(start.getTime() + 30 * 60000)
      const format = (date) => date.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z')
      base.push(`DTSTART:${format(start)}`, `DTEND:${format(end)}`)
    } else {
      const end = new Date(`${event.date}T12:00:00`); end.setDate(end.getDate() + 1)
      base.push(`DTSTART;VALUE=DATE:${startDate}`, `DTEND;VALUE=DATE:${dateKey(end).replaceAll('-', '')}`)
    }
    base.push('END:VEVENT')
    return base.join('\r\n')
  })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//NextStep//Job Search Calendar//EN\r\nCALSCALE:GREGORIAN\r\n${entries.join('\r\n')}\r\nEND:VCALENDAR\r\n`], { type: 'text/calendar;charset=utf-8' }))
  link.download = 'nextstep-calendar.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
const followUpState = (value) => {
  if (!value) return ''
  const due = new Date(`${value}T00:00:00`)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((due - today) / 86400000)
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `In ${days} days`
}
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted && char === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = '' }
    else cell += char
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row)
  if (rows.length < 2) throw new Error('This CSV has no application rows.')
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
  const aliases = { company: ['company'], role: ['role', 'jobtitle', 'position'], location: ['location'], work_mode: ['workmode', 'workstyle'], status: ['status', 'stage'], source: ['source'], applied_on: ['appliedon', 'applicationdate'], follow_up: ['followup', 'followupdate'], salary: ['salary', 'salaryrange'], job_url: ['joburl', 'url', 'link'], notes: ['notes', 'note'] }
  return rows.map((cells) => {
    const values = Object.fromEntries(headers.map((header, index) => [header, (cells[index] || '').trim()]))
    const item = Object.fromEntries(Object.entries(aliases).map(([field, keys]) => [field, keys.map((key) => values[key]).find(Boolean) || '']))
    if (!item.company || !item.role) return null
    item.status = stages.find((stage) => stage.toLowerCase() === item.status.toLowerCase()) || 'Applied'
    item.work_mode = ['Remote', 'Hybrid', 'On-site'].find((mode) => mode.toLowerCase() === item.work_mode.toLowerCase()) || 'Remote'
    item.applied_on ||= null; item.follow_up ||= null
    return item
  }).filter(Boolean)
}
const previewEvents = (applications) => applications.map((item) => ({ id: `sample-${item.id}`, application_id: item.id, company: item.company, role: item.role, status: item.status, event_type: 'created', title: 'Application added', description: `Started tracking ${item.role} at ${item.company}.`, created_at: new Date(`${item.applied_on || '2026-11-07'}T12:00:00`).toISOString() })).sort((a, b) => b.created_at.localeCompare(a.created_at))
function previewAnalytics(applications) {
  const today = new Date()
  const monday = new Date(today); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const starts = Array.from({ length: 6 }, (_, index) => { const date = new Date(monday); date.setDate(date.getDate() - (5 - index) * 7); return date })
  const counts = new Map(starts.map((date) => [date.toDateString(), 0]))
  applications.forEach((item) => {
    const date = new Date(`${item.applied_on || today.toISOString().slice(0, 10)}T12:00:00`)
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    const key = date.toDateString()
    if (counts.has(key)) counts.set(key, counts.get(key) + 1)
  })
  const applied = applications.filter((item) => item.applied_on)
  const responded = applied.filter((item) => ['Interview', 'Offer', 'Rejected'].includes(item.status)).length
  return { applications_total: applications.length, active_total: applications.filter((item) => ['Wishlist', 'Applied', 'Interview'].includes(item.status)).length, interviewing_total: applications.filter((item) => item.status === 'Interview').length, interview_rounds_total: 0, offers_total: applications.filter((item) => item.status === 'Offer').length, applications_this_month: applications.filter((item) => (item.applied_on || today.toISOString().slice(0, 10)).slice(0, 7) === today.toISOString().slice(0, 7)).length, response_rate: applied.length ? Math.round(responded / applied.length * 100) : 0, weekly_applications: starts.map((date) => ({ week_start: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count: counts.get(date.toDateString()) })) }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('nextstep_token'))
  const [user, setUser] = useState(null)
  const [apps, setApps] = useState(seed)
  const [activity, setActivity] = useState([])
  const [calendarItems, setCalendarItems] = useState([])
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(() => dateKey(new Date()))
  const [analytics, setAnalytics] = useState(null)
  const [demo, setDemo] = useState(!localStorage.getItem('nextstep_token'))
  const [showDemoBanner, setShowDemoBanner] = useState(!localStorage.getItem('nextstep_token'))
  const [activeNav, setActiveNav] = useState('Overview')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All applications')
  const [view, setView] = useState('list')
  const [dragOverStage, setDragOverStage] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [interviewForm, setInterviewForm] = useState({ title: '', interview_type: 'Recruiter screen', scheduled_at: '', interviewer: '', notes: '' })
  const [contactForm, setContactForm] = useState({ name: '', role: '', email: '', profile_url: '' })
  const [form, setForm] = useState(blank)
  const [authModal, setAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState('register')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [importRows, setImportRows] = useState(null)
  const importInput = useRef(null)

  const request = async (url, options = {}) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL || ''}${url}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } })
    if (response.status === 204) return null
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.detail || 'Something went wrong')
    return payload
  }

  const refreshInsights = async () => {
    if (demo) return
    const [events, report] = await Promise.all([request('/api/activity'), request('/api/analytics')])
    setActivity(events); setAnalytics(report)
  }

  useEffect(() => {
    if (!token) return
    Promise.all([request('/api/auth/me'), request('/api/applications'), request('/api/activity'), request('/api/analytics')]).then(([profile, data, events, report]) => {
      setUser(profile); setApps(data); setActivity(events); setAnalytics(report); setDemo(false); setShowDemoBanner(false)
    }).catch(() => { localStorage.removeItem('nextstep_token'); setToken(null); setDemo(true); setShowDemoBanner(true); setApps(seed); setActivity([]); setAnalytics(null) })
  }, [token])

  useEffect(() => {
    if (!demo && activeNav === 'Calendar') request('/api/calendar').then(setCalendarItems).catch((error) => setNotice(error.message))
  }, [activeNav, demo, token])

  const filtered = useMemo(() => apps.filter((item) => {
    const matchesQuery = `${item.company} ${item.role} ${item.location}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (statusFilter === 'All applications' || item.status === statusFilter)
  }), [apps, query, statusFilter])
  const count = (status) => apps.filter((item) => item.status === status).length
  const insights = demo ? previewAnalytics(apps) : analytics || previewAnalytics([])
  const visibleActivity = demo ? previewEvents(apps) : activity
  const visibleCalendar = demo ? apps.filter((item) => item.follow_up && !['Rejected', 'Withdrawn'].includes(item.status)).map((item) => ({ id: `follow-up-${item.id}`, application_id: item.id, kind: 'follow-up', title: 'Follow-up reminder', company: item.company, role: item.role, date: item.follow_up, scheduled_at: null })) : calendarItems
  const openCalendarApplication = (applicationId) => { const item = apps.find((application) => String(application.id) === String(applicationId)); if (item) openDetails(item) }
  const activeCount = apps.filter((item) => ['Applied', 'Interview', 'Wishlist'].includes(item.status)).length
  const followUps = apps.filter((item) => item.follow_up && !['Rejected', 'Withdrawn'].includes(item.status)).sort((a, b) => a.follow_up.localeCompare(b.follow_up))
  const upcoming = followUps.slice(0, 4)
  const overdueCount = followUps.filter((item) => followUpState(item.follow_up).includes('overdue')).length
  const submitAuth = async (event) => {
    event.preventDefault(); setBusy(true)
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      const data = await request(`/api/auth/${authMode}`, { method: 'POST', body: JSON.stringify(body) })
      localStorage.setItem('nextstep_token', data.access_token); setToken(data.access_token); setUser(data.user); setDemo(false); setShowDemoBanner(false); setAuthModal(false); setNotice('Your workspace is ready.')
    } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  const saveApplication = async (event) => {
    event.preventDefault(); setBusy(true)
    const payload = { ...form, applied_on: form.applied_on || null, follow_up: form.follow_up || null }
    try {
      if (demo) {
        if (editing) setApps((items) => items.map((item) => item.id === editing.id ? { ...payload, id: item.id } : item))
        else setApps((items) => [{ ...payload, id: `demo-${Date.now()}` }, ...items])
      } else {
        const saved = await request(editing ? `/api/applications/${editing.id}` : '/api/applications', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
        setApps((items) => editing ? items.map((item) => item.id === editing.id ? saved : item) : [saved, ...items])
        if (activeNav === 'Calendar') setCalendarItems(await request('/api/calendar'))
        refreshInsights().catch(() => {})
      }
      setModal(false); setEditing(null); setForm(blank); setNotice(editing ? 'Application updated.' : 'Application added.')
    } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  const openEdit = (item) => { setEditing(item); setForm({ ...blank, ...item, applied_on: item.applied_on || '', follow_up: item.follow_up || '' }); setModal(true) }
  const openDetails = async (item) => {
    setDetail({ application: item, events: demo ? [{ id: 'demo-created', event_type: 'created', title: 'Application added', description: `Added ${item.role} at ${item.company}.`, created_at: item.created_at || item.applied_on || new Date().toISOString() }] : [], interviews: [], contacts: [] }); setNoteDraft(''); setInterviewForm({ title: '', interview_type: 'Recruiter screen', scheduled_at: '', interviewer: '', notes: '' }); setContactForm({ name: '', role: '', email: '', profile_url: '' }); setDetailLoading(!demo)
    if (demo) return
    try { setDetail(await request(`/api/applications/${item.id}/details`)) }
    catch (error) { setNotice(error.message) } finally { setDetailLoading(false) }
  }
  const refreshDetails = async () => { if (!demo && detail) setDetail(await request(`/api/applications/${detail.application.id}/details`)) }
  const submitDetailNote = async (event) => {
    event.preventDefault(); const note = noteDraft.trim(); if (!note || !detail) return
    try {
      if (demo) setDetail((value) => ({ ...value, events: [{ id: Date.now(), event_type: 'note', title: 'Note added', description: note, created_at: new Date().toISOString() }, ...value.events] }))
      else { await request(`/api/applications/${detail.application.id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }); await refreshDetails(); refreshInsights().catch(() => {}) }
      setNoteDraft(''); setNotice('Note added to the timeline.')
    } catch (error) { setNotice(error.message) }
  }
  const submitInterview = async (event) => {
    event.preventDefault(); if (!detail) return
    try {
      const payload = { ...interviewForm, scheduled_at: interviewForm.scheduled_at || null }
      if (demo) setDetail((value) => ({ ...value, interviews: [{ ...payload, id: Date.now(), created_at: new Date().toISOString() }, ...value.interviews], events: [{ id: Date.now() + 1, event_type: 'interview', title: payload.title, description: `Interview round scheduled${payload.interviewer ? ` with ${payload.interviewer}` : ''}`, created_at: new Date().toISOString() }, ...value.events] }))
      else { await request(`/api/applications/${detail.application.id}/interviews`, { method: 'POST', body: JSON.stringify(payload) }); await refreshDetails(); setCalendarItems(await request('/api/calendar')); refreshInsights().catch(() => {}) }
      setInterviewForm({ title: '', interview_type: 'Recruiter screen', scheduled_at: '', interviewer: '', notes: '' }); setNotice('Interview round added.')
    } catch (error) { setNotice(error.message) }
  }
  const submitContact = async (event) => {
    event.preventDefault(); if (!detail) return
    try {
      const payload = { ...contactForm, email: contactForm.email || null }
      if (demo) setDetail((value) => ({ ...value, contacts: [{ ...payload, email: payload.email || '', id: Date.now(), created_at: new Date().toISOString() }, ...value.contacts], events: [{ id: Date.now() + 1, event_type: 'contact', title: 'Contact added', description: `Added ${payload.name}${payload.role ? ` · ${payload.role}` : ''}`, created_at: new Date().toISOString() }, ...value.events] }))
      else { await request(`/api/applications/${detail.application.id}/contacts`, { method: 'POST', body: JSON.stringify(payload) }); await refreshDetails(); refreshInsights().catch(() => {}) }
      setContactForm({ name: '', role: '', email: '', profile_url: '' }); setNotice('Contact added.')
    } catch (error) { setNotice(error.message) }
  }
  const deleteDetailItem = async (kind, item) => {
    if (!detail || !window.confirm(`Remove this ${kind === 'contacts' ? 'contact' : 'interview round'}?`)) return
    try {
      if (demo) setDetail((value) => ({ ...value, [kind]: value[kind].filter((record) => record.id !== item.id) }))
      else { await request(`/api/applications/${detail.application.id}/${kind}/${item.id}`, { method: 'DELETE' }); await refreshDetails(); if (kind === 'interviews') setCalendarItems(await request('/api/calendar')); refreshInsights().catch(() => {}) }
      setNotice(`${kind === 'contacts' ? 'Contact' : 'Interview round'} removed.`)
    } catch (error) { setNotice(error.message) }
  }
  const moveApplication = async (item, nextStatus) => {
    if (item.status === nextStatus) return
    const payload = { ...item, status: nextStatus, applied_on: item.applied_on || null, follow_up: item.follow_up || null }
    try {
      if (demo) setApps((items) => items.map((application) => application.id === item.id ? { ...application, status: nextStatus } : application))
      else {
        const saved = await request(`/api/applications/${item.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setApps((items) => items.map((application) => application.id === item.id ? saved : application))
        refreshInsights().catch(() => {})
      }
      setNotice(`${item.company} moved to ${nextStatus}.`)
    } catch (error) { setNotice(error.message) }
  }
  const remove = async (item) => {
    if (!window.confirm(`Remove your ${item.role} application at ${item.company}?`)) return
    try { if (!demo) { await request(`/api/applications/${item.id}`, { method: 'DELETE' }); refreshInsights().catch(() => {}) }; setApps((items) => items.filter((app) => app.id !== item.id)); setNotice('Application removed.') }
    catch (error) { setNotice(error.message) }
  }
  const logout = () => { localStorage.removeItem('nextstep_token'); setToken(null); setUser(null); setDemo(true); setShowDemoBanner(true); setApps(seed); setActivity([]); setAnalytics(null) }
  const exportCsv = () => {
    const headers = ['Company', 'Role', 'Location', 'Work mode', 'Status', 'Source', 'Applied on', 'Follow-up', 'Salary', 'Job URL', 'Notes']
    const rows = apps.map((item) => headers.map((_, index) => [item.company, item.role, item.location, item.work_mode, item.status, item.source, item.applied_on || '', item.follow_up || '', item.salary, item.job_url, item.notes][index]))
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value || '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = 'nextstep-applications.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }
  const readImport = async (file) => {
    if (!file) return
    try {
      const imported = parseCsv(await file.text())
      const key = (item) => `${item.company.trim().toLowerCase()}|${item.role.trim().toLowerCase()}|${item.applied_on || ''}`
      const existing = new Set(apps.map(key)); const seen = new Set()
      setImportRows(imported.map((item) => { const duplicate = existing.has(key(item)) || seen.has(key(item)); seen.add(key(item)); return { ...item, duplicate } }))
    } catch (error) { setNotice(error.message) }
    if (importInput.current) importInput.current.value = ''
  }
  const confirmImport = async () => {
    const fresh = importRows.filter((item) => !item.duplicate)
    setBusy(true)
    try {
      const created = []
      for (const item of fresh) created.push(demo ? { ...item, id: `import-${Date.now()}-${created.length}` } : await request('/api/applications', { method: 'POST', body: JSON.stringify(item) }))
      setApps((items) => [...created, ...items]); setImportRows(null); setNotice(`Imported ${created.length} application${created.length === 1 ? '' : 's'}${fresh.length < importRows.length ? ` · skipped ${importRows.length - fresh.length} duplicate${importRows.length - fresh.length === 1 ? '' : 's'}` : ''}.`)
      if (!demo) refreshInsights().catch(() => {})
    } catch (error) { setNotice(`Import stopped: ${error.message}. Any earlier rows were saved.`); if (!demo) request('/api/applications').then(setApps).catch(() => {}) }
    finally { setBusy(false) }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home"><span className="brand-mark"><Sparkles size={18} strokeWidth={2.2} /></span><span>nextstep<span className="brand-period">.</span></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <button className={`nav-item ${activeNav === 'Overview' ? 'selected' : ''}`} onClick={() => setActiveNav('Overview')}><LayoutDashboard size={17} />Overview</button>
      <button className={`nav-item ${activeNav === 'Applications' ? 'selected' : ''}`} onClick={() => setActiveNav('Applications')}><BriefcaseBusiness size={17} />Applications<span className="nav-count">{apps.length}</span></button>
      <button className={`nav-item ${activeNav === 'Calendar' ? 'selected' : ''}`} onClick={() => setActiveNav('Calendar')}><CalendarRange size={17} />Calendar</button>
      <button className={`nav-item ${activeNav === 'Activity' ? 'selected' : ''}`} onClick={() => setActiveNav('Activity')}><Activity size={17} />Activity</button>
      <button className={`nav-item ${activeNav === 'Insights' ? 'selected' : ''}`} onClick={() => setActiveNav('Insights')}><BarChart3 size={17} />Insights</button>
      <div className="sidebar-divider" />
      <div className="workspace-label">YOUR PIPELINE</div>
      {stages.slice(0, 4).map((stage) => <button key={stage} className="nav-item pipeline-nav" onClick={() => { setStatusFilter(stage); setActiveNav('Applications') }}><span className={`tiny-dot ${stage.toLowerCase()}`} />{stage}<span className="nav-count">{count(stage)}</span></button>)}
      <div className="sidebar-spacer" />
      <div className="sidebar-tip"><div className="tip-spark"><Sparkles size={15} /></div><strong>Small steps add up.</strong><p>Every application is progress. Keep your momentum going.</p><button onClick={() => setNotice('You’ve got this. One step at a time.')}>A little encouragement <ArrowRight size={13} /></button></div>
      <button className="profile" onClick={() => user ? logout() : (setAuthMode('register'), setAuthModal(true))}><div className="avatar">{user ? initials(user.name) : 'JD'}</div><div className="profile-copy"><strong>{user?.name || 'Jordan Davis'}</strong><span>{user?.email || 'Product designer'}</span></div>{user ? <LogOut size={16} className="profile-more" /> : <MoreHorizontal size={18} className="profile-more" />}</button>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeNav}</strong></div><div className="top-actions"><div className="searchbox"><Search size={16} /><input placeholder="Search anything..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="Notifications" onClick={() => setNotice('You’re all caught up.')}><Bell size={17} /><i /></button><span className="top-divider" /><button className="help-link" onClick={() => setNotice('Tip: set a follow-up date so no opportunity slips through.') }><CircleHelp size={16} />Help</button></div></header>
      <div className="page-content">
        {demo && showDemoBanner && <div className="demo-banner"><Sparkles size={15} /><span>You’re exploring with sample data. Create a free account to save your applications.</span><button onClick={() => { setAuthMode('register'); setAuthModal(true) }}>Create account <ArrowRight size={14} /></button><button className="banner-close" aria-label="Dismiss" onClick={() => setShowDemoBanner(false)}><X size={15} /></button></div>}
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR CAREER, IN MOTION</div><h1>{activeNav === 'Applications' ? 'Applications' : activeNav === 'Calendar' ? 'Your calendar' : activeNav === 'Activity' ? 'Your activity' : activeNav === 'Insights' ? 'Insights' : <>A little progress<br />goes a <span>long way.</span></>}</h1><p className="welcome-sub">{activeNav === 'Applications' ? 'Every opportunity, thoughtfully organized.' : activeNav === 'Calendar' ? 'Interviews and follow-ups, all in one view.' : activeNav === 'Activity' ? 'Your job search journey, one step at a time.' : activeNav === 'Insights' ? 'A clearer picture of your job search momentum.' : 'Your job search, organized around what matters next.'}</p></div><div className="welcome-buttons"><input ref={importInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => readImport(event.target.files?.[0])} /><button className="secondary-button" onClick={() => importInput.current?.click()}><Upload size={14} />Import</button><button className="secondary-button" onClick={exportCsv}><Download size={15} />Export</button><button className="primary-button" onClick={() => { setEditing(null); setForm(blank); setModal(true) }}><Plus size={17} />Add application</button></div></section>
        {!demo && apps.length === 0 && activeNav === 'Overview' && <OnboardingCard onAdd={() => { setEditing(null); setForm(blank); setModal(true) }} />}
        {activeNav === 'Calendar' ? <CalendarPage events={visibleCalendar} month={calendarMonth} selectedDay={selectedCalendarDay} onMonthChange={setCalendarMonth} onDaySelect={setSelectedCalendarDay} onOpen={openCalendarApplication} onAdd={() => { setEditing(null); setForm(blank); setModal(true) }} onExport={() => exportCalendarIcs(visibleCalendar)} /> : activeNav === 'Activity' ? <ActivityPage events={visibleActivity} loading={!demo && !analytics} onOpen={(id) => { const item = apps.find((application) => String(application.id) === String(id)); if (item) openDetails(item) }} /> : activeNav === 'Insights' ? <InsightsPage analytics={insights} applications={apps} /> : <>
        <section className="stats-grid">
          <StatCard label="TOTAL APPLICATIONS" value={apps.length} change="Your opportunities" icon={<BriefcaseBusiness size={17} />} tone="sage" trend="up" />
          <StatCard label="IN THE PIPELINE" value={activeCount} change="Active opportunities" icon={<Target size={17} />} tone="blue" trend="up" />
          <StatCard label="INTERVIEWS" value={count('Interview')} change="Keep the momentum" icon={<CalendarDays size={17} />} tone="orange" trend="up" />
          <StatCard label="OFFERS RECEIVED" value={count('Offer')} change="Big things ahead" icon={<Sparkles size={17} />} tone="purple" trend="up" />
        </section>
        <div className="content-grid">
          <section className="panel applications-panel">
            <div className="panel-heading"><div><div className="panel-title-row"><h2>Recent applications</h2><span className="soft-count">{filtered.length}</span></div><p>A snapshot of where things stand</p></div><button className="text-link" onClick={() => { setActiveNav('Applications'); setStatusFilter('All applications') }}>View all <ArrowRight size={14} /></button></div>
            <div className="table-tools"><div className="filter-wrap"><Filter size={14} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All applications</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select><ChevronDown size={13} /></div><div className="view-toggle"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={15} /></button><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')} aria-label="Board view"><Command size={15} /></button></div></div>
            {view === 'list' ? <div className="table-wrap"><table><thead><tr><th>COMPANY / ROLE</th><th>STATUS</th><th>APPLIED</th><th>FOLLOW-UP</th><th></th></tr></thead><tbody>{filtered.slice(0, activeNav === 'Applications' ? undefined : 5).map((item) => <tr key={item.id} onClick={() => openDetails(item)}><td><div className="company-cell"><div className={`company-logo ${companyColor(item.company)}`}>{initials(item.company)}</div><div><strong>{item.company}</strong><span>{item.role}</span></div></div></td><td><StatusPill status={item.status} /></td><td className="date-cell">{prettyDate(item.applied_on)}</td><td className="date-cell">{item.follow_up ? <span className="follow-date"><Clock3 size={13} />{prettyDate(item.follow_up)}</span> : '—'}</td><td><button className="row-more" onClick={(event) => { event.stopPropagation(); openEdit(item) }} aria-label="Edit application"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyState onAdd={() => setModal(true)} />}</div> : <div className="board-view" aria-label="Application pipeline">{stages.map((stage) => <section className={`board-column ${dragOverStage === stage ? 'drag-over' : ''}`} key={stage} onDragOver={(event) => { event.preventDefault(); setDragOverStage(stage) }} onDragLeave={() => setDragOverStage('')} onDrop={(event) => { event.preventDefault(); const itemId = event.dataTransfer.getData('text/plain'); const dragged = apps.find((application) => String(application.id) === itemId); if (dragged) moveApplication(dragged, stage); setDragOverStage('') }}><div className="board-heading"><span className={`tiny-dot ${stage.toLowerCase()}`} />{stage}<span>{apps.filter((item) => item.status === stage).length}</span></div>{filtered.filter((item) => item.status === stage).map((item) => <article className="board-card" key={item.id} draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', String(item.id)); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDragOverStage('')} role="button" tabIndex={0} aria-label={`Open ${item.company} application details`} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openDetails(item) } }} onClick={() => openDetails(item)}><div className="board-company"><div className={`company-logo mini ${companyColor(item.company)}`}>{initials(item.company)}</div><strong>{item.company}</strong></div><span>{item.role}</span><small>{item.location || 'Location not set'}</small><select className="board-status-select" aria-label={`Move ${item.company} to another stage`} value={item.status} onClick={(event) => event.stopPropagation()} onChange={(event) => moveApplication(item, event.target.value)}>{stages.map((option) => <option key={option} value={option}>Move to {option}</option>)}</select></article>)}</section>)}</div>}
            <div className="table-footer"><span>Showing <strong>{filtered.length}</strong> of <strong>{apps.length}</strong> applications</span><button onClick={() => { setActiveNav('Applications'); setStatusFilter('All applications') }}>See all applications <ArrowRight size={13} /></button></div>
          </section>
          <aside className="right-column">
            <section className="panel follow-panel"><div className="panel-heading compact"><div><h2>Follow-up reminders</h2><p>{overdueCount ? `${overdueCount} need${overdueCount === 1 ? 's' : ''} your attention` : 'Stay one step ahead'}</p></div>{overdueCount > 0 && <span className="overdue-count">{overdueCount} overdue</span>}</div><div className="upcoming-list">{upcoming.length ? upcoming.map((item, index) => { const state = followUpState(item.follow_up); const isOverdue = state.includes('overdue'); return <div className={`upcoming-item ${isOverdue ? 'is-overdue' : ''}`} key={item.id}><div className={`date-tile tile-${index}`}><span>{new Date(`${item.follow_up}T12:00:00`).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span><strong>{new Date(`${item.follow_up}T12:00:00`).getDate()}</strong></div><div className="upcoming-copy"><strong>{item.status === 'Interview' ? 'Interview follow-up' : 'Follow up'}</strong><span>{item.company} · {item.role}</span><small>{state}{item.status === 'Interview' ? ' · Interview' : ' · Reminder'}</small></div><button className="upcoming-more" onClick={() => openDetails(item)} aria-label={`Open ${item.company} application and update follow-up`}><MoreHorizontal size={17} /></button></div> }) : <div className="no-upcoming"><CalendarDays size={18} /><span>No follow-ups planned yet.</span><button onClick={() => { setEditing(null); setForm(blank); setModal(true) }}>Add a reminder <Plus size={13} /></button></div>}</div><button className="calendar-link" onClick={() => setActiveNav('Calendar')}>Open calendar <ArrowRight size={13} /></button></section>
            <section className="momentum-card"><div className="momentum-heading"><div className="momentum-icon"><TrendingUp size={17} /></div><span>YOUR MOMENTUM</span><MoreHorizontal size={17} /></div><div className="momentum-number">{insights.applications_total}<span> applications tracked</span></div><ActivityChart points={insights.weekly_applications} compact /><div className="momentum-foot"><span><ArrowUpRight size={13} />{insights.applications_this_month} added this month</span><button onClick={() => setActiveNav('Insights')}>Your insights <ArrowRight size={13} /></button></div></section>
            <div className="quote-card"><span className="quote-mark">“</span><p>Small steps every day lead to big changes over time.</p><span className="quote-attr">A NOTE TO YOUR FUTURE SELF</span></div>
          </aside>
        </div>
        </>}
        <footer className="page-footer"><span>Made for the next chapter <span className="footer-heart">✳</span></span><span>YOUR SEARCH, YOUR PACE.</span></footer>
      </div>
    </main>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}
    {detail && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetail(null)}><section className="modal-card detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="detail-header"><div className={`company-logo detail-logo ${companyColor(detail.application.company)}`}>{initials(detail.application.company)}</div><div className="detail-heading-copy"><div className="detail-eyebrow">APPLICATION DETAILS</div><h2 id="detail-title">{detail.application.company}</h2><p>{detail.application.role}{detail.application.location ? ` · ${detail.application.location}` : ''}</p></div><StatusPill status={detail.application.status} /><div className="detail-header-actions"><button className="secondary-button" onClick={() => { const item = detail.application; setDetail(null); openEdit(item) }}><ExternalLink size={14} />Edit details</button><button type="button" className="modal-close" onClick={() => setDetail(null)} aria-label="Close details"><X size={18} /></button></div></div>
      <div className="detail-facts"><div><span>APPLIED</span><strong>{prettyDate(detail.application.applied_on)}</strong></div><div><span>FOLLOW-UP</span><strong>{prettyDate(detail.application.follow_up)}</strong></div><div><span>WORK STYLE</span><strong>{detail.application.work_mode || 'Not set'}</strong></div><div><span>SALARY RANGE</span><strong>{detail.application.salary || 'Not listed'}</strong></div>{detail.application.job_url && <a href={detail.application.job_url} target="_blank" rel="noreferrer"><ExternalLink size={13} />View job posting</a>}</div>
      {detailLoading ? <div className="detail-loading"><span className="loading-spinner" />Loading your application details…</div> : <div className="detail-body"><div className="detail-main-column"><section className="detail-section timeline-section"><div className="detail-section-heading"><div><h3>Activity timeline</h3><p>Status changes and notes in one place</p></div><span className="soft-count">{detail.events.length}</span></div>{detail.application.notes?.trim() && <div className="saved-application-note"><span>APPLICATION NOTE</span><p>{detail.application.notes}</p></div>}<form className="note-composer" onSubmit={submitDetailNote}><div className="note-avatar"><Sparkles size={14} /></div><div className="note-compose-content"><textarea aria-label="Write a note" rows="2" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add a note about this application…" /><div className="note-compose-footer"><span>Notes are private to your workspace</span><button className="primary-button" disabled={!noteDraft.trim()}><Plus size={14} />Add note</button></div></div></form><div className="timeline-list">{detail.events.length ? detail.events.map((event) => <div className="timeline-item" key={event.id}><div className={`timeline-marker ${event.event_type}`}><TimelineIcon type={event.event_type} /></div><div className="timeline-copy"><div className="timeline-title-row"><strong>{event.title}</strong><time>{new Date(event.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time></div>{event.description && <p>{event.description}</p>}</div></div>) : <div className="section-empty">Your application updates will appear here.</div>}</div></section></div>
      <div className="detail-side-column"><section className="detail-section"><div className="detail-section-heading"><div><h3>Interview rounds</h3><p>Prepare for every conversation</p></div><span className="soft-count">{detail.interviews.length}</span></div>{detail.interviews.map((interview) => <div className="detail-record" key={interview.id}><div className="record-icon interview-record"><CalendarClock size={15} /></div><div className="record-copy"><strong>{interview.title}</strong><span>{interview.interview_type}{interview.interviewer ? ` · ${interview.interviewer}` : ''}</span>{interview.scheduled_at && <small>{new Date(interview.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>}{interview.notes && <p>{interview.notes}</p>}</div><button type="button" className="record-delete" onClick={() => deleteDetailItem('interviews', interview)} aria-label={`Remove ${interview.title}`}><X size={14} /></button></div>)}<form className="inline-add-form" onSubmit={submitInterview}><label>Round name<input required value={interviewForm.title} onChange={(event) => setInterviewForm({ ...interviewForm, title: event.target.value })} placeholder="e.g. Product design interview" /></label><div className="inline-form-row"><label>Type<select value={interviewForm.interview_type} onChange={(event) => setInterviewForm({ ...interviewForm, interview_type: event.target.value })}><option>Recruiter screen</option><option>Technical interview</option><option>Portfolio review</option><option>Panel interview</option><option>Final interview</option><option>Other</option></select></label><label>Date & time<input type="datetime-local" value={interviewForm.scheduled_at} onChange={(event) => setInterviewForm({ ...interviewForm, scheduled_at: event.target.value })} /></label></div><label>Interviewer<input value={interviewForm.interviewer} onChange={(event) => setInterviewForm({ ...interviewForm, interviewer: event.target.value })} placeholder="Name, if known" /></label><label>Preparation notes<textarea rows="2" value={interviewForm.notes} onChange={(event) => setInterviewForm({ ...interviewForm, notes: event.target.value })} placeholder="Topics to review, questions to ask…" /></label><button className="soft-add-button"><Plus size={13} />Add interview round</button></form></section>
      <section className="detail-section contacts-section"><div className="detail-section-heading"><div><h3>People</h3><p>Keep helpful contacts close</p></div><span className="soft-count">{detail.contacts.length}</span></div>{detail.contacts.map((contact) => <div className="detail-record" key={contact.id}><div className="record-icon contact-record"><UserRound size={15} /></div><div className="record-copy"><strong>{contact.name}</strong><span>{contact.role || 'Contact'}</span>{contact.email && <a href={`mailto:${contact.email}`}><Mail size={11} />{contact.email}</a>}{contact.profile_url && <a href={contact.profile_url} target="_blank" rel="noreferrer"><ExternalLink size={11} />Profile</a>}</div><button type="button" className="record-delete" onClick={() => deleteDetailItem('contacts', contact)} aria-label={`Remove ${contact.name}`}><X size={14} /></button></div>)}<form className="inline-add-form contact-form" onSubmit={submitContact}><label>Name<input required value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} placeholder="e.g. Alex Morgan" /></label><div className="inline-form-row"><label>Role<input value={contactForm.role} onChange={(event) => setContactForm({ ...contactForm, role: event.target.value })} placeholder="Recruiter" /></label><label>Email<input type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} placeholder="alex@company.com" /></label></div><label>LinkedIn or profile URL<input type="url" value={contactForm.profile_url} onChange={(event) => setContactForm({ ...contactForm, profile_url: event.target.value })} placeholder="https://" /></label><button className="soft-add-button"><Plus size={13} />Add contact</button></form></section></div></div>}
    </section></div>}
    {importRows && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setImportRows(null)}><section className="modal-card import-card"><div className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line" />BRING YOUR SEARCH WITH YOU</div><h2>Review your import</h2><p>{importRows.filter((item) => !item.duplicate).length} new applications · {importRows.filter((item) => item.duplicate).length} duplicates skipped</p></div><button type="button" className="modal-close" onClick={() => setImportRows(null)} aria-label="Close import preview"><X size={18} /></button></div><div className="import-preview-list">{importRows.slice(0, 6).map((item, index) => <div className="import-preview-row" key={`${item.company}-${item.role}-${index}`}><div><strong>{item.company}</strong><span>{item.role} · {item.status}</span></div><small className={item.duplicate ? 'duplicate-tag' : 'new-tag'}>{item.duplicate ? 'Already tracked' : 'Ready to add'}</small></div>)}{importRows.length > 6 && <p className="import-more">and {importRows.length - 6} more rows…</p>}</div><div className="modal-actions"><button className="secondary-button" onClick={() => setImportRows(null)}>Cancel</button><button className="primary-button" disabled={busy || !importRows.some((item) => !item.duplicate)} onClick={confirmImport}>{busy ? 'Importing…' : <><Upload size={14} />Import {importRows.filter((item) => !item.duplicate).length} applications</>}</button></div></section></div>}
    {modal && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(false)}><form className="modal-card" onSubmit={saveApplication}><div className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR NEXT OPPORTUNITY</div><h2>{editing ? 'Update application' : 'Add an application'}</h2><p>Keep the important details in one place.</p></div><button type="button" className="modal-close" onClick={() => setModal(false)} aria-label="Close"><X size={18} /></button></div><div className="form-grid"><label>Company<input required autoFocus value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Acme Inc." /></label><label>Role<input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Product Designer" /></label><label>Location<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City or remote" /></label><label>Work style<select value={form.work_mode} onChange={(e) => setForm({ ...form, work_mode: e.target.value })}><option>Remote</option><option>Hybrid</option><option>On-site</option></select></label><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label><label>Applied on<input type="date" value={form.applied_on} onChange={(e) => setForm({ ...form, applied_on: e.target.value })} /></label><label>Follow-up date<input type="date" value={form.follow_up} onChange={(e) => setForm({ ...form, follow_up: e.target.value })} /></label><label>Salary range<input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="e.g. $120k – $150k" /></label><label className="full-field">Job posting URL<input type="url" value={form.job_url} onChange={(e) => setForm({ ...form, job_url: e.target.value })} placeholder="https://" /></label><label className="full-field">Notes<textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="A few details to remember…" /></label></div><div className="modal-actions">{editing && <button className="delete-button" type="button" onClick={() => { setModal(false); remove(editing) }}><Trash2 size={15} />Delete</button>}<button className="secondary-button" type="button" onClick={() => setModal(false)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : <><Check size={15} />{editing ? 'Save changes' : 'Add application'}</>}</button></div></form></div>}
    {authModal && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAuthModal(false)}><form className="modal-card auth-card" onSubmit={submitAuth}><div className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR NEXT CHAPTER</div><h2>{authMode === 'register' ? 'Make it yours.' : 'Welcome back.'}</h2><p>{authMode === 'register' ? 'Create an account to save your job search.' : 'Sign in to pick up where you left off.'}</p></div><button type="button" className="modal-close" onClick={() => setAuthModal(false)} aria-label="Close"><X size={18} /></button></div>{authMode === 'register' && <label className="auth-field">Your name<input name="name" required minLength="2" placeholder="Jordan Davis" /></label>}<label className="auth-field">Email address<input name="email" type="email" required placeholder="you@example.com" /></label><label className="auth-field">Password<input name="password" type="password" required minLength="8" placeholder="At least 8 characters" /></label><button className="primary-button auth-submit" disabled={busy}>{busy ? 'One moment…' : authMode === 'register' ? 'Create my account' : 'Sign in'}<ArrowRight size={15} /></button><p className="auth-switch">{authMode === 'register' ? 'Already have an account?' : 'New to NextStep?'} <button type="button" onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>{authMode === 'register' ? 'Sign in' : 'Create an account'}</button></p></form></div>}
  </div>
}

function StatCard({ label, value, change, icon, tone, trend }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}>{icon}</div></div><div className="stat-bottom"><strong>{value}</strong><div className="stat-meta"><span className="stat-trend"><ArrowUpRight size={13} /></span>{change}</div></div><div className={`stat-decoration ${tone}`} /></div>
}
function StatusPill({ status }) { return <span className={`status-pill ${status.toLowerCase()}`}><i />{status}</span> }
function TimelineIcon({ type }) {
  if (type === 'created') return <BriefcaseBusiness size={13} />
  if (type === 'status') return <Activity size={13} />
  if (type === 'interview') return <CalendarClock size={13} />
  if (type === 'contact') return <UserRound size={13} />
  if (type === 'note') return <Mail size={13} />
  return <Check size={13} />
}
function EmptyState({ onAdd }) { return <div className="empty-state"><div className="empty-icon"><BriefcaseBusiness size={20} /></div><strong>No applications found</strong><span>Try changing your search, or add an opportunity to get started.</span><button onClick={onAdd}><Plus size={14} />Add application</button></div> }

function CalendarPage({ events, month, selectedDay, onMonthChange, onDaySelect, onOpen, onAdd, onExport }) {
  const year = month.getFullYear(); const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1); const offset = (firstDay.getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, index) => new Date(year, monthIndex, index - offset + 1))
  const selectedEvents = events.filter((event) => event.date === selectedDay).sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))
  const eventsFor = (key) => events.filter((event) => event.date === key)
  const selectedDate = new Date(`${selectedDay}T12:00:00`)
  const changeMonth = (delta) => { const next = new Date(year, monthIndex + delta, 1); onMonthChange(next); onDaySelect(dateKey(next)) }
  return <div className="calendar-page">
    <section className="calendar-board panel"><div className="calendar-toolbar"><div><span className="calendar-month-label">YOUR SCHEDULE</span><h2>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2></div><div className="calendar-controls"><button className="calendar-export" onClick={onExport} disabled={!events.length}><Download size={13} />Export .ics</button><button className="calendar-today" onClick={() => { const today = new Date(); onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1)); onDaySelect(dateKey(today)) }}>Today</button><button aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button><button aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button></div></div>
      <div className="calendar-grid"><div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{days.map((day) => { const key = dateKey(day); const dayEvents = eventsFor(key); const inMonth = day.getMonth() === monthIndex; const today = key === dateKey(new Date()); return <button key={key} className={`calendar-day ${inMonth ? '' : 'outside-month'} ${selectedDay === key ? 'selected' : ''} ${today ? 'today' : ''}`} onClick={() => onDaySelect(key)}><span className="calendar-day-number">{day.getDate()}</span>{dayEvents.length > 0 && <span className="calendar-day-events">{dayEvents.slice(0, 2).map((event) => <i key={event.id} className={event.kind} />)}{dayEvents.length > 2 && <small>+{dayEvents.length - 2}</small>}</span>}</button> })}</div></div>
      <div className="calendar-legend"><span><i className="interview" />Interview</span><span><i className="follow-up" />Follow-up</span><span>{events.length} scheduled {events.length === 1 ? 'item' : 'items'}</span></div>
    </section>
    <section className="calendar-agenda panel"><div className="calendar-agenda-heading"><div><span className="calendar-month-label">DAY PLAN</span><h2>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div><span className="soft-count">{selectedEvents.length}</span></div>{selectedEvents.length ? <div className="calendar-agenda-list">{selectedEvents.map((event) => <button key={event.id} className="calendar-agenda-item" onClick={() => onOpen(event.application_id)}><span className={`calendar-agenda-icon ${event.kind}`}>{event.kind === 'interview' ? <CalendarClock size={16} /> : <Clock3 size={16} />}</span><span className="calendar-agenda-copy"><strong>{event.title}</strong><small>{event.company} · {event.role}</small><em>{event.kind === 'interview' ? `${event.interview_type || 'Interview'}${event.scheduled_at ? ` · ${new Date(event.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}` : 'Follow-up reminder'}</em></span><ArrowRight size={15} /></button>)}</div> : <div className="calendar-empty"><CalendarDays size={21} /><strong>A little room to breathe.</strong><span>No interviews or follow-ups are scheduled for this day.</span><button className="soft-add-button" onClick={onAdd}><Plus size={13} />Add an application</button></div>}</section>
  </div>
}

function ActivityPage({ events, loading, onOpen }) {
  const groups = events.reduce((all, event) => {
    const date = new Date(event.created_at)
    const key = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    all[key] ||= []; all[key].push(event); return all
  }, {})
  return <div className="activity-page panel">
    <div className="insight-panel-heading"><div><span className="eyebrow-line" /><h2>Recent activity</h2><p>A running log of what’s happening across your applications.</p></div><span className="soft-count">{events.length} updates</span></div>
    {loading ? <div className="activity-empty">Loading your activity…</div> : events.length ? <div className="activity-groups">{Object.entries(groups).map(([day, dayEvents]) => <section className="activity-day" key={day}><h3>{day}</h3>{dayEvents.map((event) => <button className="activity-row" key={event.id} onClick={() => onOpen(event.application_id)}><div className={`activity-event-icon ${event.event_type}`}><TimelineIcon type={event.event_type} /></div><div className={`company-logo mini ${companyColor(event.company)}`}>{initials(event.company)}</div><div className="activity-row-copy"><strong>{event.title}</strong><span>{event.company} · {event.role}</span>{event.description && <p>{event.description}</p>}</div><div className="activity-row-meta"><StatusPill status={event.status} /><time>{new Date(event.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time></div><ArrowRight className="activity-row-arrow" size={15} /></button>)}</section>)}</div> : <div className="activity-empty"><div className="empty-icon"><Activity size={19} /></div><strong>No activity yet</strong><span>Add an application or update a stage to start your activity timeline.</span></div>}
  </div>
}

function InsightsPage({ analytics, applications }) {
  const metrics = [
    { label: 'APPLICATIONS THIS MONTH', value: analytics.applications_this_month, note: 'New opportunities tracked', tone: 'sage', icon: <BriefcaseBusiness size={16} /> },
    { label: 'IN INTERVIEW STAGE', value: analytics.interviewing_total, note: `${analytics.interview_rounds_total} interview rounds logged`, tone: 'orange', icon: <CalendarDays size={16} /> },
    { label: 'RESPONSE RATE', value: `${analytics.response_rate}%`, note: 'Interview, offer or rejection', tone: 'blue', icon: <ArrowUpRight size={16} /> },
    { label: 'OFFERS', value: analytics.offers_total, note: 'Your next chapter is close', tone: 'purple', icon: <Sparkles size={16} /> },
  ]
  return <div className="insights-page">
    <div className="insight-metric-grid">{metrics.map((metric) => <div className="insight-metric" key={metric.label}><div className="insight-metric-top"><span>{metric.label}</span><div className={`insight-metric-icon ${metric.tone}`}>{metric.icon}</div></div><strong>{metric.value}</strong><small>{metric.note}</small></div>)}</div>
    <div className="insight-content-grid"><section className="insight-panel panel"><div className="insight-panel-heading"><div><span className="eyebrow-line" /><h2>Application activity</h2><p>Applications added each week over the last six weeks.</p></div><span className="chart-period">LAST 6 WEEKS</span></div><ActivityChart points={analytics.weekly_applications} /><div className="chart-summary"><span><i />Applications added</span><strong>{analytics.weekly_applications.reduce((sum, point) => sum + point.count, 0)} in this period</strong></div></section>
    <section className="insight-panel panel stage-panel"><div className="insight-panel-heading"><div><span className="eyebrow-line" /><h2>Pipeline by stage</h2><p>Where your opportunities stand today.</p></div></div><div className="stage-breakdown">{stages.map((stage) => { const total = applications.filter((item) => item.status === stage).length; const width = applications.length ? total / applications.length * 100 : 0; return <div className="stage-breakdown-row" key={stage}><div className="stage-label"><span className={`tiny-dot ${stage.toLowerCase()}`} />{stage}<strong>{total}</strong></div><div className="stage-track"><span className={`stage-fill ${stage.toLowerCase()}`} style={{ width: `${Math.max(total ? 7 : 0, width)}%` }} /></div></div> })}</div><div className="stage-panel-foot"><span>{analytics.active_total} active opportunities</span><span>{applications.length ? Math.round(analytics.active_total / applications.length * 100) : 0}% of your tracker</span></div></section></div>
    <div className="insights-footnote"><CircleHelp size={14} /><span>Response rate counts applications with an interview, offer, or rejection stage, divided by applications with an applied date.</span></div>
  </div>
}

function ActivityChart({ points = [], compact = false }) {
  const values = points.map((point) => point.count)
  const max = Math.max(1, ...values)
  const coords = values.map((value, index) => [12 + index * (276 / Math.max(1, values.length - 1)), 54 - value / max * 42])
  const line = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = coords.length ? `${line} L 288 60 L 12 60 Z` : ''
  return <div className={`activity-chart ${compact ? 'compact' : ''}`}><svg viewBox="0 0 300 70" preserveAspectRatio="none" role="img" aria-label="Applications added each week"><defs><linearGradient id={compact ? 'smallChartFill' : 'largeChartFill'} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b4cbb2" stopOpacity=".36"/><stop offset="1" stopColor="#b4cbb2" stopOpacity="0"/></linearGradient></defs>{!compact && [16, 37, 58].map((y) => <line key={y} x1="12" x2="288" y1={y} y2={y} stroke="#edf0eb" strokeDasharray="3 4" />)}{coords.length > 1 && <><path d={area} fill={`url(#${compact ? 'smallChartFill' : 'largeChartFill'})`} /><path d={line} fill="none" stroke="#789779" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></>}{!compact && coords.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="3" fill="#fff" stroke="#789779" strokeWidth="2"><title>{points[index].count} applications, week of {points[index].label}</title></circle>)}</svg><div className="activity-chart-labels">{points.map((point) => <span key={point.week_start}>{point.label}</span>)}</div></div>
}

function OnboardingCard({ onAdd }) {
  return <section className="onboarding-card"><div className="onboarding-copy"><div className="onboarding-kicker"><Sparkles size={14} />A FRESH START</div><h2>Your job search starts<br />with <span>one opportunity.</span></h2><p>Keep each role, follow-up, and interview in one calm workspace. Add your first application to get your pipeline moving.</p><button className="primary-button" onClick={onAdd}><Plus size={15} />Add your first application</button></div><div className="onboarding-steps"><div className="onboarding-step current"><span>01</span><div><strong>Capture an opportunity</strong><small>Company, role, and status</small></div><ArrowRight size={15} /></div><div className="onboarding-step"><span>02</span><div><strong>Choose your next step</strong><small>Set a follow-up or interview</small></div><ArrowRight size={15} /></div><div className="onboarding-step"><span>03</span><div><strong>Keep your momentum</strong><small>See progress as it builds</small></div><ArrowRight size={15} /></div></div></section>
}

export default App
