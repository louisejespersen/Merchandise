import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  LogOut,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Shirt,
  X,
} from 'lucide-react'
import {
  csvEscape,
  formatDate,
  isSupabaseConfigured,
  SHIRT_SIZES,
  supabase,
  type Order,
  type Product,
} from './lib'

type Notice = { kind: 'success' | 'error'; text: string } | null

type OrderFormValue = {
  customer_name: string
  phone_number: string
  product_number: string
  shirt_size: string
  print_text: string
  prepaid: string
}

const EMPTY_FORM: OrderFormValue = {
  customer_name: '',
  phone_number: '',
  product_number: '',
  shirt_size: '',
  print_text: '',
  prepaid: 'no',
}

function App() {
  const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin'

  if (!isSupabaseConfigured || !supabase) {
    return <SetupScreen />
  }

  return isAdminRoute ? <AdminApp /> : <PublicOrderForm />
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`brand ${compact ? 'brand-compact' : ''}`} href="/" aria-label="Trøjeordrer – forside">
      <span className="brand-icon"><Shirt size={20} strokeWidth={2.2} /></span>
      <span><strong>Trøjeordrer</strong>{!compact && <small>Ordreregistrering</small>}</span>
    </a>
  )
}

function SetupScreen() {
  return (
    <main className="setup-page">
      <div className="setup-card">
        <Brand />
        <div className="setup-icon"><ClipboardList size={28} /></div>
        <h1>Systemet mangler forbindelse</h1>
        <p>Webappen er klar, men den er endnu ikke forbundet til jeres Supabase-database.</p>
        <p className="muted">Følg opsætningsvejledningen i projektets <strong>README.md</strong>: opret projektet i Supabase, kør SQL-migreringen og udfyld <code>.env.local</code>.</p>
        <a className="button button-primary" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Åbn Supabase <ChevronDown size={16} /></a>
      </div>
    </main>
  )
}

function PublicOrderForm() {
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [form, setForm] = useState<OrderFormValue>(EMPTY_FORM)
  const [notice, setNotice] = useState<Notice>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function loadProducts() {
    if (!supabase) return
    setProductsLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('product_number, is_active')
      .eq('is_active', true)
      .order('product_number')
    if (error) setNotice({ kind: 'error', text: 'Varenumrene kunne ikke hentes. Prøv at genindlæse siden.' })
    else setProducts(data ?? [])
    setProductsLoading(false)
  }

  useEffect(() => { void loadProducts() }, [])

  function update<K extends keyof OrderFormValue>(key: K, value: OrderFormValue[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || submitting) return
    setNotice(null)
    const cleanForm = {
      customer_name: form.customer_name.trim(),
      phone_number: form.phone_number.trim(),
      product_number: form.product_number,
      shirt_size: form.shirt_size,
      print_text: form.print_text.trim(),
      prepaid: form.prepaid === 'yes',
    }
    if (!cleanForm.customer_name || !cleanForm.phone_number || !cleanForm.product_number || !cleanForm.shirt_size || !cleanForm.print_text) {
      setNotice({ kind: 'error', text: 'Udfyld venligst alle felter.' })
      return
    }
    if ([...cleanForm.print_text].length > 9) {
      setNotice({ kind: 'error', text: 'Trykket må maksimalt være 9 tegn.' })
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('orders').insert(cleanForm)
    setSubmitting(false)
    if (error) {
      console.error('Ordren kunne ikke gemmes:', error)
      const isInactiveProduct = error.message
        .toLocaleLowerCase('da-DK')
        .includes('varenummeret er ikke aktivt')

      setNotice({
        kind: 'error',
        text: isInactiveProduct
          ? 'Det valgte varenummer er ikke længere aktivt. Genindlæs siden, og vælg et af de tilgængelige varenumre.'
          : 'Ordren kunne ikke gemmes. Kontrollér oplysningerne, og prøv igen.',
      })
      return
    }
    setSubmitted(true)
    setForm(EMPTY_FORM)
  }

  return (
    <main className="page-shell public-shell">
      <header className="topbar">
        <Brand />
        <a className="topbar-link" href="/admin"><ShieldCheck size={16} /> Administration</a>
      </header>

      <section className="form-layout">
        <div className="intro-block">
          <div className="eyebrow"><span className="eyebrow-dot" /> ORDREBESTILLING</div>
          <h1>Bestil din<br /><span>trøje her.</span></h1>
          <p>Udfyld oplysningerne nedenfor. Kontrollér gerne stavningen af navn og tryk, inden du sender bestillingen.</p>
          <div className="intro-note"><ShieldCheck size={17} /><span>Dine oplysninger bruges kun til at håndtere bestillingen.</span></div>
        </div>

        <section className="form-card">
          {submitted ? (
            <div className="success-state">
              <div className="success-mark"><Check size={32} /></div>
              <p className="eyebrow">BESTILLING MODTAGET</p>
              <h2>Tak for din ordre!</h2>
              <p>Bestillingen er registreret. Du kan lukke siden eller oprette endnu en ordre.</p>
              <button className="button button-primary button-wide" onClick={() => { setSubmitted(false); setNotice(null) }}>Opret en ny ordre</button>
            </div>
          ) : (
            <>
              <div className="card-heading">
                <div><h2>Ny ordre</h2><p>Felter markeret med * skal udfyldes.</p></div>
                <span className="step-count">01 <i>/</i> 01</span>
              </div>
              {notice && <NoticeBox notice={notice} />}
              <form onSubmit={handleSubmit} className="order-form">
                <fieldset>
                  <legend><span className="legend-number">1</span> Kundeoplysninger</legend>
                  <div className="field-grid">
                    <label className="field field-full">
                      <span>Kundens navn <b>*</b></span>
                      <input value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} placeholder="Fx Anders Jensen" maxLength={100} autoComplete="name" required />
                    </label>
                    <label className="field field-full">
                      <span>Telefonnummer <b>*</b></span>
                      <input type="tel" value={form.phone_number} onChange={(e) => update('phone_number', e.target.value)} placeholder="Fx 12 34 56 78" maxLength={30} autoComplete="tel" required />
                    </label>
                  </div>
                </fieldset>

                <fieldset>
                  <legend><span className="legend-number">2</span> Trøje og tryk</legend>
                  <div className="field-grid">
                    <label className="field">
                      <span>Varenummer <b>*</b></span>
                      <select value={form.product_number} onChange={(e) => update('product_number', e.target.value)} required disabled={productsLoading || products.length === 0}>
                        <option value="">{productsLoading ? 'Henter varenumre…' : 'Vælg varenummer'}</option>
                        {products.map((product) => <option key={product.product_number} value={product.product_number}>{product.product_number}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      <span>Størrelse <b>*</b></span>
                      <select value={form.shirt_size} onChange={(e) => update('shirt_size', e.target.value)} required>
                        <option value="">Vælg størrelse</option>
                        {SHIRT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </label>
                    <label className="field field-full">
                      <span>Tryk på trøjen <b>*</b></span>
                      <input value={form.print_text} onChange={(e) => update('print_text', e.target.value)} placeholder="Skriv teksten til trykket" maxLength={9} required />
                      <small className="field-hint"><span>Det færdige tryk må højst være 9 tegn.</span><span className={form.print_text.length > 9 ? 'text-danger' : ''}>{form.print_text.length}/9</span></small>
                    </label>
                  </div>
                </fieldset>

                <fieldset className="payment-fieldset">
                  <legend><span className="legend-number">3</span> Betaling</legend>
                  <div className="payment-options">
                    <label className={`choice-card ${form.prepaid === 'yes' ? 'choice-selected' : ''}`}>
                      <input type="radio" name="prepaid" value="yes" checked={form.prepaid === 'yes'} onChange={(e) => update('prepaid', e.target.value)} />
                      <span className="choice-radio" /><span><strong>Ja</strong><small>Betalt på forhånd</small></span>
                    </label>
                    <label className={`choice-card ${form.prepaid === 'no' ? 'choice-selected' : ''}`}>
                      <input type="radio" name="prepaid" value="no" checked={form.prepaid === 'no'} onChange={(e) => update('prepaid', e.target.value)} />
                      <span className="choice-radio" /><span><strong>Nej</strong><small>Ikke betalt endnu</small></span>
                    </label>
                  </div>
                </fieldset>
                <button className="button button-primary button-wide submit-button" type="submit" disabled={submitting || productsLoading || products.length === 0}>
                  {submitting ? <><RefreshCw className="spin" size={17} /> Gemmer ordre…</> : <>Send bestilling <ArrowLeft className="button-arrow" size={17} /></>}
                </button>
                {products.length === 0 && !productsLoading && <p className="inline-error">Der er ingen aktive varenumre. Kontakt den ordreansvarlige.</p>}
                <p className="form-footnote">Når du sender bestillingen, bliver oplysningerne gemt i ordresystemet.</p>
              </form>
            </>
          )}
        </section>
      </section>
      <footer className="page-footer"><span>Trøjeordrer</span><span>Ordreformular</span></footer>
    </main>
  )
}

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null
  return <div className={`notice notice-${notice.kind}`}><AlertCircle size={17} /><span>{notice.text}</span></div>
}

function AdminApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [search, setSearch] = useState('')
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'pending' | 'delivered'>('pending')
  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders')
  const [editing, setEditing] = useState<Order | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [newProductNumber, setNewProductNumber] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setIsAdmin(false)
        setOrders([])
        setProducts([])
      }
      setAuthLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function verifyAdmin() {
      if (!supabase || !session) { setIsAdmin(false); return }
      setCheckingAdmin(true)
      const { data, error } = await supabase.from('admin_users').select('user_id').eq('user_id', session.user.id).maybeSingle()
      setIsAdmin(!error && Boolean(data))
      setCheckingAdmin(false)
      if (error || !data) {
        setNotice({ kind: 'error', text: 'Denne konto har ikke administratoradgang. Kontakt systemejeren.' })
        await supabase.auth.signOut()
      }
    }
    void verifyAdmin()
  }, [session])

  async function loadAdminData() {
    if (!supabase || !session) return
    setDataLoading(true)
    setNotice(null)
    const [ordersResult, productsResult] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('product_number, is_active').order('product_number'),
    ])
    if (ordersResult.error) setNotice({ kind: 'error', text: 'Ordrerne kunne ikke hentes. Kontrollér administratoradgangen.' })
    else setOrders((ordersResult.data ?? []) as Order[])
    if (productsResult.error) setNotice({ kind: 'error', text: 'Varenumrene kunne ikke hentes.' })
    else setProducts(productsResult.data ?? [])
    setDataLoading(false)
  }

  useEffect(() => {
    if (isAdmin && session) void loadAdminData()
    // loadAdminData depends on the current session; reloading is explicit elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session?.user.id])

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('da-DK')
    return orders.filter((order) => {
      const matchesFilter = deliveryFilter === 'all' || (deliveryFilter === 'pending' && !order.delivered) || (deliveryFilter === 'delivered' && order.delivered)
      const searchable = [order.id, order.customer_name, order.phone_number, order.product_number, order.shirt_size, order.print_text].join(' ').toLocaleLowerCase('da-DK')
      return matchesFilter && (!term || searchable.includes(term))
    })
  }, [orders, search, deliveryFilter])

  async function toggleDelivered(order: Order) {
    if (!supabase) return
    const nextValue = !order.delivered
    // Læs tidsstemplet tilbage fra databasen. Triggeren på serversiden sætter delivered_at.
    const { data, error } = await supabase
      .from('orders')
      .update({ delivered: nextValue })
      .eq('id', order.id)
      .select('delivered, delivered_at')
      .single()
    if (error) {
      console.error('Kunne ikke opdatere udleveringsstatus:', error)
      setNotice({ kind: 'error', text: `Ordre #${order.id} kunne ikke opdateres.` })
    } else {
      const updated = data as { delivered: boolean; delivered_at: string | null }
      setOrders((current) => current.map((item) => item.id === order.id
        ? { ...item, delivered: updated.delivered, delivered_at: updated.delivered_at }
        : item))
      setNotice({ kind: 'success', text: nextValue ? `Ordre #${order.id} er markeret som udleveret.` : `Ordre #${order.id} er markeret som ikke udleveret.` })
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !editing) return
    setSavingEdit(true)
    const payload = {
      customer_name: editing.customer_name.trim(),
      phone_number: editing.phone_number.trim(),
      product_number: editing.product_number,
      shirt_size: editing.shirt_size,
      print_text: editing.print_text.trim(),
      prepaid: editing.prepaid,
    }
    if (!payload.customer_name || !payload.phone_number || !payload.product_number || !payload.shirt_size || !payload.print_text || [...payload.print_text].length > 9) {
      setNotice({ kind: 'error', text: 'Kontrollér felterne. Trykket skal være mellem 1 og 9 tegn.' })
      setSavingEdit(false)
      return
    }
    const { error } = await supabase.from('orders').update(payload).eq('id', editing.id)
    setSavingEdit(false)
    if (error) setNotice({ kind: 'error', text: 'Ændringerne kunne ikke gemmes.' })
    else {
      setOrders((current) => current.map((item) => item.id === editing.id ? { ...item, ...payload } : item))
      setEditing(null)
      setNotice({ kind: 'success', text: `Ordre #${editing.id} er opdateret.` })
    }
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const number = newProductNumber.trim()
    if (!number) return
    setSavingProduct(true)
    const { error } = await supabase.from('products').insert({ product_number: number, is_active: true })
    setSavingProduct(false)
    if (error) setNotice({ kind: 'error', text: 'Varenummeret kunne ikke tilføjes. Det findes måske allerede.' })
    else {
      setNewProductNumber('')
      setNotice({ kind: 'success', text: `Varenummer ${number} er tilføjet.` })
      await loadAdminData()
    }
  }

  async function toggleProduct(product: Product) {
    if (!supabase) return
    const { error } = await supabase.from('products').update({ is_active: !product.is_active }).eq('product_number', product.product_number)
    if (error) setNotice({ kind: 'error', text: 'Varenummeret kunne ikke opdateres.' })
    else {
      setProducts((current) => current.map((item) => item.product_number === product.product_number ? { ...item, is_active: !item.is_active } : item))
      setNotice({ kind: 'success', text: `Varenummer ${product.product_number} er opdateret.` })
    }
  }

  function exportCsv() {
    const headers = ['Ordrenr.', 'Kundens navn', 'Telefonnummer', 'Varenummer', 'Størrelse', 'Tryk', 'Betalt på forhånd', 'Udleveret', 'Oprettet', 'Udleveret tidspunkt']
    const rows = filteredOrders.map((order) => [order.id, order.customer_name, order.phone_number, order.product_number, order.shirt_size, order.print_text, order.prepaid ? 'Ja' : 'Nej', order.delivered ? 'Ja' : 'Nej', formatDate(order.created_at), formatDate(order.delivered_at)])
    const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(csvEscape).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `ordreoversigt-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function signOut() {
    await supabase?.auth.signOut()
    window.location.href = '/admin'
  }

  if (authLoading || checkingAdmin) return <LoadingScreen text="Kontrollerer adgang…" />
  if (!session || !isAdmin) return <LoginScreen notice={notice} />

  const pendingCount = orders.filter((order) => !order.delivered).length
  const deliveredCount = orders.length - pendingCount

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Brand compact />
        <div className="admin-user"><span className="admin-avatar"><ShieldCheck size={16} /></span><span className="admin-email">{session.user.email}</span><button className="icon-button" onClick={signOut} aria-label="Log ud" title="Log ud"><LogOut size={17} /></button></div>
      </header>
      <div className="admin-container">
        <div className="admin-heading">
          <div><p className="eyebrow">ADMINISTRATION</p><h1>Ordreoversigt</h1><p className="admin-subtitle">Administrér bestillinger og hold styr på udleveringer.</p></div>
          <button className="button button-secondary" onClick={() => void loadAdminData()} disabled={dataLoading}><RefreshCw className={dataLoading ? 'spin' : ''} size={16} /> Opdater</button>
        </div>

        {notice && <NoticeBox notice={notice} />}

        <div className="stats-grid">
          <StatCard label="Alle ordrer" value={orders.length} icon={<ClipboardList size={18} />} tone="neutral" />
          <StatCard label="Afventer udlevering" value={pendingCount} icon={<PackageCheck size={18} />} tone="amber" />
          <StatCard label="Udleveret" value={deliveredCount} icon={<CheckCircle2 size={18} />} tone="green" />
        </div>

        <div className="admin-tabs">
          <button className={activeTab === 'orders' ? 'tab-active' : ''} onClick={() => setActiveTab('orders')}><ClipboardList size={16} /> Ordrer <span>{orders.length}</span></button>
          <button className={activeTab === 'products' ? 'tab-active' : ''} onClick={() => setActiveTab('products')}><Shirt size={16} /> Varenumre <span>{products.filter((p) => p.is_active).length}</span></button>
        </div>

        {activeTab === 'orders' ? (
          <section className="panel">
            <div className="panel-head"><div><h2>Bestillinger</h2><p>Se, søg i og opdatér registrerede ordrer.</p></div><button className="button button-outline" onClick={exportCsv} disabled={filteredOrders.length === 0}><Download size={16} /> Eksportér CSV</button></div>
            <div className="toolbar">
              <label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søg navn, telefon, varenr. eller tryk" /></label>
              <div className="filter-pills" aria-label="Filtrér ordrer">
                <button className={deliveryFilter === 'pending' ? 'filter-active' : ''} onClick={() => setDeliveryFilter('pending')}>Afventer <span>{pendingCount}</span></button>
                <button className={deliveryFilter === 'delivered' ? 'filter-active' : ''} onClick={() => setDeliveryFilter('delivered')}>Udleveret <span>{deliveredCount}</span></button>
                <button className={deliveryFilter === 'all' ? 'filter-active' : ''} onClick={() => setDeliveryFilter('all')}>Alle</button>
              </div>
            </div>
            {dataLoading ? <LoadingScreen text="Henter ordrer…" inline /> : filteredOrders.length === 0 ? (
              <div className="empty-state"><ClipboardList size={28} /><strong>Ingen ordrer fundet</strong><span>Prøv at ændre søgning eller filter.</span></div>
            ) : (
              <div className="orders-list">
                <div className="orders-table-wrap">
                  <table className="orders-table">
                    <thead><tr><th>Ordre</th><th>Kunde</th><th>Trøje</th><th>Betaling</th><th>Status</th><th>Handling</th></tr></thead>
                    <tbody>{filteredOrders.map((order) => <tr key={order.id}>
                      <td><strong>#{order.id}</strong><small>{formatDate(order.created_at)}</small></td>
                      <td><strong>{order.customer_name}</strong><small>{order.phone_number}</small></td>
                      <td><strong>{order.product_number} · {order.shirt_size}</strong><small>Tryk: {order.print_text}</small></td>
                      <td><StatusPill good={order.prepaid}>{order.prepaid ? 'Betalt' : 'Ikke betalt'}</StatusPill></td>
                      <td>
                        <StatusPill good={order.delivered}>{order.delivered ? 'Udleveret' : 'Afventer'}</StatusPill>
                        {order.delivered && <small>Udleveret: {formatDate(order.delivered_at)}</small>}
                      </td>
                      <td><div className="row-actions"><button className="text-action" onClick={() => setEditing({ ...order })}>Redigér</button><button className={`deliver-button ${order.delivered ? 'is-delivered' : ''}`} onClick={() => void toggleDelivered(order)}>{order.delivered ? <><Check size={14} /> Udleveret</> : 'Markér udleveret'}</button></div></td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <div className="mobile-order-list">{filteredOrders.map((order) => <article className="mobile-order-card" key={order.id}>
                  <div className="mobile-order-top"><strong>#{order.id} · {order.customer_name}</strong><StatusPill good={order.delivered}>{order.delivered ? 'Udleveret' : 'Afventer'}</StatusPill></div>
                  <div className="mobile-order-details"><span>{order.phone_number}</span><span>Varenr. {order.product_number} · {order.shirt_size}</span><span>Tryk: {order.print_text}</span>{order.delivered && <span>Udleveret: {formatDate(order.delivered_at)}</span>}</div>
                  <div className="mobile-order-bottom"><StatusPill good={order.prepaid}>{order.prepaid ? 'Betalt' : 'Ikke betalt'}</StatusPill><div className="row-actions"><button className="text-action" onClick={() => setEditing({ ...order })}>Redigér</button><button className={`deliver-button ${order.delivered ? 'is-delivered' : ''}`} onClick={() => void toggleDelivered(order)}>{order.delivered ? 'Fortryd udlevering' : 'Markér udleveret'}</button></div></div>
                </article>)}</div>
              </div>
            )}
            <div className="results-footer">Viser {filteredOrders.length} af {orders.length} ordrer</div>
          </section>
        ) : (
          <section className="panel products-panel">
            <div className="panel-head"><div><h2>Varenumre</h2><p>Kun aktive varenumre vises i den offentlige ordreformular.</p></div></div>
            <form className="add-product-form" onSubmit={addProduct}><label className="field"><span>Tilføj varenummer</span><input value={newProductNumber} onChange={(e) => setNewProductNumber(e.target.value)} placeholder="Fx 106" maxLength={20} required /></label><button className="button button-primary" type="submit" disabled={savingProduct || !newProductNumber.trim()}>{savingProduct ? <RefreshCw className="spin" size={16} /> : <Plus size={16} />} Tilføj</button></form>
            <div className="product-list">{products.map((product) => <div className="product-row" key={product.product_number}><div className="product-number-icon"><Shirt size={17} /></div><strong>Varenummer {product.product_number}</strong><span className={product.is_active ? 'product-active' : 'product-inactive'}>{product.is_active ? 'Aktiv' : 'Deaktiveret'}</span><button className="text-action" onClick={() => void toggleProduct(product)}>{product.is_active ? 'Deaktivér' : 'Aktivér'}</button></div>)}</div>
          </section>
        )}
        <p className="admin-footnote"><ShieldCheck size={14} /> Du er logget ind som administrator. Ordredata er kun synlige for godkendte administratorer.</p>
      </div>
      {editing && <EditOrderModal order={editing} products={products.filter((p) => p.is_active)} onChange={setEditing} onClose={() => setEditing(null)} onSave={saveEdit} saving={savingEdit} />}
    </main>
  )
}

function LoginScreen({ notice }: { notice: Notice }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loginNotice, setLoginNotice] = useState<Notice>(notice)

  useEffect(() => { setLoginNotice(notice) }, [notice])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setSubmitting(true)
    setLoginNotice(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setSubmitting(false)
    if (error) setLoginNotice({ kind: 'error', text: 'Login mislykkedes. Kontrollér e-mail og adgangskode.' })
  }

  return <main className="login-page"><header className="topbar"><Brand /><a className="topbar-link" href="/"><ArrowLeft size={16} /> Til ordreformular</a></header><div className="login-wrap"><div className="login-card"><div className="login-icon"><ShieldCheck size={25} /></div><p className="eyebrow">SIKKER ADGANG</p><h1>Administration</h1><p className="login-intro">Log ind for at se og administrere ordrer.</p>{loginNotice && <NoticeBox notice={loginNotice} />}<form onSubmit={handleLogin} className="order-form"><label className="field"><span>E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="navn@eksempel.dk" required /></label><label className="field"><span>Adgangskode</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label><button className="button button-primary button-wide" type="submit" disabled={submitting}>{submitting ? <><RefreshCw className="spin" size={16} /> Logger ind…</> : 'Log ind'}</button></form><p className="login-footnote">Adgang gives kun til konti, der er godkendt som administratorer.</p></div></div></main>
}

function EditOrderModal({ order, products, onChange, onClose, onSave, saving }: {
  order: Order
  products: Product[]
  onChange: (order: Order) => void
  onClose: () => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}) {
  const update = (key: keyof Order, value: string | boolean) => onChange({ ...order, [key]: value } as Order)
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><div className="modal-heading"><div><p className="eyebrow">ORDRE #{order.id}</p><h2 id="edit-title">Redigér ordre</h2></div><button className="icon-button" onClick={onClose} aria-label="Luk"><X size={19} /></button></div><form onSubmit={onSave} className="order-form"><div className="field-grid"><label className="field field-full"><span>Kundens navn</span><input value={order.customer_name} onChange={(e) => update('customer_name', e.target.value)} maxLength={100} required /></label><label className="field field-full"><span>Telefonnummer</span><input value={order.phone_number} onChange={(e) => update('phone_number', e.target.value)} maxLength={30} required /></label><label className="field"><span>Varenummer</span><select value={order.product_number} onChange={(e) => update('product_number', e.target.value)} required>{products.map((p) => <option key={p.product_number} value={p.product_number}>{p.product_number}</option>)}{!products.some((p) => p.product_number === order.product_number) && <option value={order.product_number}>{order.product_number} (tidligere varenr.)</option>}</select></label><label className="field"><span>Størrelse</span><select value={order.shirt_size} onChange={(e) => update('shirt_size', e.target.value)}>{SHIRT_SIZES.map((s) => <option key={s}>{s}</option>)}</select></label><label className="field field-full"><span>Tryk (maks. 9 tegn)</span><input value={order.print_text} onChange={(e) => update('print_text', e.target.value)} maxLength={9} required /></label></div><label className="toggle-line"><input type="checkbox" checked={order.prepaid} onChange={(e) => update('prepaid', e.target.checked)} /><span>Betalt på forhånd</span></label><div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Annullér</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Gemmer…' : 'Gem ændringer'}</button></div></form></section></div>
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: 'neutral' | 'amber' | 'green' }) {
  return <div className={`stat-card stat-${tone}`}><div className="stat-icon">{icon}</div><span className="stat-value">{value.toLocaleString('da-DK')}</span><span className="stat-label">{label}</span></div>
}

function StatusPill({ good, children }: { good: boolean; children: ReactNode }) {
  return <span className={`status-pill ${good ? 'status-good' : 'status-pending'}`}><i />{children}</span>
}

function LoadingScreen({ text, inline = false }: { text: string; inline?: boolean }) {
  return <div className={inline ? 'loading-inline' : 'loading-page'}><RefreshCw className="spin" size={19} /><span>{text}</span></div>
}

export default App
