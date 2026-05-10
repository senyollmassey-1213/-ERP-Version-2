import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Plus, Search, Trash2, Edit, GitBranch, UtensilsCrossed, List, Receipt, X, CheckCircle, Loader, ChefHat, Clock, Smartphone, User } from 'lucide-react';
import { moduleAPI, recordAPI, tenantAPI } from 'services/api';
import { useAuth } from 'context/AuthContext';
import toast from 'react-hot-toast';
import RecordModal from 'components/modules/RecordModal';
import QRButton from 'components/qr/QRButton';

const MODULE_PRIMARY_FIELD = {
  crm:          'guest_name',
  bookings:     'guest_name',
  rooms:        null,
  billing:      'guest_name',
  housekeeping: 'room_number',
  transport:    'guest_name',
  menu:         'item_name',
  inventory:    'item_name',
};

const MODULE_COLUMNS = {
  bookings:     ['room_number', 'check_in_date', 'check_out_date', 'status'],
  rooms:        ['room_number', 'room_type', 'floor', 'capacity', 'status'],
  billing:      ['bill_type', 'total', 'payment_status'],
  crm:          ['phone', 'email', 'status'],
  housekeeping: ['task_type', 'assigned_to', 'scheduled_date', 'status'],
  transport:    ['transport_type', 'pickup_datetime', 'status'],
  menu:         ['category', 'price', 'is_veg', 'available'],
  inventory:    ['category', 'quantity', 'unit'],
};

const ModulePage = () => {
  const { moduleSlug } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const queryStatus = new URLSearchParams(location.search).get('status') || '';
  if (moduleSlug === 'menu') return <MenuModulePage />;
  return <StandardModulePage moduleSlug={moduleSlug} user={user} queryStatus={queryStatus} />;
};

// ── Menu Module ───────────────────────────────────────────────────────────────
const MenuModulePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab]   = useState('items');
  const [titleHeads, setTitleHeads] = useState([]);
  const [loaded, setLoaded]         = useState(false);
  const [openOrderCount, setOpenOrderCount] = useState(0);

  useEffect(() => {
    moduleAPI.titleHeads('menu').then(res => {
      if (res.success) { setTitleHeads(res.data); setLoaded(true); }
    }).catch(() => setLoaded(true));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 20 }}>Menu</h2>
      <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 4, width: 'fit-content' }}>
        <button className={`btn btn-sm ${activeTab === 'items' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('items')}>
          <List size={13} /> Menu Items
        </button>
        <button className={`btn btn-sm ${activeTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('orders')}>
          <UtensilsCrossed size={13} /> Place Order
        </button>
        <button className={`btn btn-sm ${activeTab === 'kitchen' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('kitchen')} style={{ position: 'relative' }}>
          <ChefHat size={13} /> Kitchen View
          {openOrderCount > 0 && (
            <span style={{ position: 'absolute', top: -6, right: -6, background: '#dc2626', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {openOrderCount}
            </span>
          )}
        </button>
      </div>
      {activeTab === 'items' && loaded && <StandardModulePage moduleSlug="menu" user={user} queryStatus="" titleHeadsOverride={titleHeads} />}
      {activeTab === 'items' && !loaded && <div className="page-loader"><div className="spinner" /></div>}
      {activeTab === 'orders'  && <MenuOrderPage />}
      {activeTab === 'kitchen' && <KitchenView onCountChange={setOpenOrderCount} />}
    </div>
  );
};

// ── Kitchen View ──────────────────────────────────────────────────────────────
const KitchenView = ({ onCountChange }) => {
  const [openOrders, setOpenOrders] = useState([]);
  const [doneOrders, setDoneOrders] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showDone, setShowDone]     = useState(false);
  const [marking, setMarking]       = useState(null);
  const prevOrderIds = useRef(new Set());
  const isFirstLoad  = useRef(true);
  const prevOpenOrders = useRef([]);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await recordAPI.list('billing', { limit: 200 });
      if (res.success) {
        const all = res.data.filter(r =>
          r.data?.bill_type === 'food_bill' &&
          (r.status === 'open_tab' || r.status === 'ready')
        );
        const open = all.filter(r => r.status === 'open_tab')
          .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
        const done = all.filter(r => r.status === 'ready')
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        if (!isFirstLoad.current) {
          const newOrders = open.filter(o => !prevOrderIds.current.has(o.id));
          newOrders.forEach(o => {
            toast.success(`New order — Table ${o.data?.table_number || '?'} · ${o.data?.guest_name}`, { duration: 6000, icon: '🍽' });
            if (Notification.permission === 'granted') {
              new Notification(`New Order — Table ${o.data?.table_number}`, {
                body: `${o.data?.guest_name} · ₹${o.data?.total}`,
                icon: '/favicon.ico',
              });
            }
          });
          const updatedOrders = open.filter(o => {
            if (!prevOrderIds.current.has(o.id)) return false;
            const prev = prevOpenOrders.current.find(p => p.id === o.id);
            return prev && new Date(o.updated_at) > new Date(prev.updated_at);
          });
          updatedOrders.forEach(o => {
            toast(`Order updated — Table ${o.data?.table_number || '?'}`, { duration: 4000, icon: '✏️' });
          });
        } else {
          isFirstLoad.current = false;
          if (Notification.permission === 'default') Notification.requestPermission();
        }

        prevOrderIds.current  = new Set(open.map(o => o.id));
        prevOpenOrders.current = open;
        setOpenOrders(open);
        setDoneOrders(done);
        onCountChange(open.length);
      }
    } catch {}
    if (!silent) setLoading(false);
  }, [onCountChange]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 8000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleMarkReady = async (order) => {
    setMarking(order.id);
    try {
      await recordAPI.update(order.id, { data: { ...order.data, status: 'ready', ready_at: new Date().toISOString() }, status: 'ready' });
      toast.success(`Table ${order.data?.table_number} marked ready`);
      fetchOrders(true);
    } catch (err) { toast.error(err.message); }
    setMarking(null);
  };

  const handleReopenOrder = async (order) => {
    try {
      await recordAPI.update(order.id, { data: { ...order.data, status: 'open_tab' }, status: 'open_tab' });
      fetchOrders(true);
    } catch (err) { toast.error(err.message); }
  };

  const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 15 }}>Kitchen View</h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>Auto-refreshes every 8s · {openOrders.length} open order{openOrders.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 12, color: '#16a34a' }}>Live</span>
        </div>
      </div>

      {openOrders.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <ChefHat size={36} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px', display: 'block' }} />
          <p style={{ color: 'var(--color-text-3)', fontSize: 14 }}>No open orders right now.</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 4 }}>New orders will appear here automatically.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {openOrders.map((order, idx) => {
            const items     = order.data?._food_items || [];
            const isQR      = order.data?._source === 'qr_order';
            const isUpdated = order.data?._new_items_added?.length > 0;
            const orderTime = order.data?.order_time || order.created_at;
            const waitMins  = Math.floor((Date.now() - new Date(orderTime)) / 60000);
            const isUrgent  = waitMins >= 15;
            return (
              <div key={order.id} style={{ background: 'white', borderRadius: 12, border: `2px solid ${isUrgent ? '#dc2626' : isUpdated ? '#d97706' : 'var(--color-border)'}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ background: isUrgent ? '#fef2f2' : isUpdated ? '#fffbeb' : 'var(--color-surface)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary)' }}>Table {order.data?.table_number || '?'}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: isQR ? '#dbeafe' : '#f3e8ff', color: isQR ? '#1d4ed8' : '#7c3aed', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {isQR ? <Smartphone size={9} /> : <User size={9} />}{isQR ? 'QR' : 'Staff'}
                      </span>
                      {isUpdated && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#fef9c3', color: '#854d0e' }}>UPDATED</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{order.data?.guest_name}{order.data?.phone ? ` · ${order.data.phone}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: isUrgent ? '#dc2626' : 'var(--color-text-3)', fontWeight: isUrgent ? 700 : 400 }}>
                      <Clock size={11} />{timeAgo(orderTime)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>#{idx + 1} in queue</div>
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)' }}>
                  {items.map((item, i) => {
                    const isNew = order.data?._new_items_added?.find(n => n.id === item.id);
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-secondary)', minWidth: 24 }}>{item.qty}×</span>
                          <span style={{ fontSize: 13 }}>{item.name}</span>
                          {isNew && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#fef9c3', color: '#854d0e' }}>NEW</span>}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>₹{(item.price * item.qty).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: '10px 14px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-secondary)' }}>₹{Number(order.data?.total || 0).toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-3)', marginLeft: 6 }}>{order.data?.payment_method === 'upi' ? '📱 UPI' : '💵 Cash'}</span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => handleMarkReady(order)} disabled={marking === order.id}>
                    {marking === order.id ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />} Mark Ready
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowDone(!showDone)} style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 10 }}>
          {showDone ? '▾' : '▸'} Completed Orders ({doneOrders.length})
        </button>
        {showDone && (
          doneOrders.length === 0 ? <p style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '8px 0' }}>No completed orders yet.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {doneOrders.map(order => {
                const items = order.data?._food_items || [];
                const isQR  = order.data?._source === 'qr_order';
                return (
                  <div key={order.id} className="card" style={{ padding: '12px 16px', opacity: 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle size={14} color="#16a34a" />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Table {order.data?.table_number}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{order.data?.guest_name}</span>
                        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: isQR ? '#dbeafe' : '#f3e8ff', color: isQR ? '#1d4ed8' : '#7c3aed' }}>{isQR ? 'QR' : 'Staff'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-secondary)' }}>₹{Number(order.data?.total || 0).toLocaleString()}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleReopenOrder(order)} style={{ fontSize: 11 }}>Reopen</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
};

// ── Menu Order Page ───────────────────────────────────────────────────────────
const MenuOrderPage = () => {
  const [menuItems, setMenuItems]     = useState([]);
  const [openTabs, setOpenTabs]       = useState([]);
  const [selectedTab, setSelectedTab] = useState(null);
  const [creating, setCreating]       = useState(false);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [closing, setClosing]         = useState(false);
  const [order, setOrder]             = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [guestName, setGuestName]     = useState('');
  const [tableNo, setTableNo]         = useState('');
  const [linkedBooking, setLinkedBooking] = useState('');
  const [bookings, setBookings]       = useState([]);
  const [hotelInfo, setHotelInfo]     = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [menuRes, bookRes, hotelRes, tabsRes] = await Promise.all([
        recordAPI.list('menu', { limit: 200 }),
        recordAPI.list('bookings', { limit: 100 }),
        tenantAPI.getMyInfo(),
        recordAPI.list('billing', { limit: 200, status: 'open_tab' }),
      ]);
      if (menuRes.success) setMenuItems(menuRes.data.filter(r => r.data?.available !== 'unavailable'));
      if (bookRes.success) setBookings(bookRes.data.filter(b => b.status === 'checked_in' || b.data?.status === 'checked_in'));
      if (hotelRes.success) setHotelInfo(hotelRes.data);
      if (tabsRes.success) setOpenTabs(tabsRes.data.filter(t => t.data?.bill_type === 'food_bill'));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const categories = ['all', ...new Set(menuItems.map(m => m.data?.category).filter(Boolean))];
  const filtered   = activeCategory === 'all' ? menuItems : menuItems.filter(m => m.data?.category === activeCategory);
  const setQty = (id, qty) => setOrder(prev => ({ ...prev, [id]: Math.max(0, qty) }));

  const orderedItems = menuItems.filter(m => (order[m.id] || 0) > 0).map(m => ({
    id: m.id, name: m.data?.item_name || m.title, price: parseFloat(m.data?.price) || 0, qty: order[m.id],
  }));
  const subtotal = orderedItems.reduce((s, i) => s + (i.price * i.qty), 0);
  const gstRate  = hotelInfo?.gst_rates?.food || 0;
  const gstAmt   = subtotal * gstRate / 100;
  const total    = subtotal + gstAmt;

  const openExistingTab = (tab) => {
    setSelectedTab(tab); setCreating(false);
    setGuestName(tab.data?.guest_name || '');
    setTableNo(tab.data?.table_number || '');
    setLinkedBooking(tab.data?.linked_booking || '');
    const existing = {};
    (tab.data?._food_items || []).forEach(item => { existing[item.id] = item.qty; });
    setOrder(existing); setActiveCategory('all');
  };

  const startNewTab = () => {
    setSelectedTab(null); setCreating(true);
    setGuestName(''); setTableNo(''); setLinkedBooking(''); setOrder({});
  };

  const cancelEdit = () => {
    setSelectedTab(null); setCreating(false);
    setOrder({}); setGuestName(''); setTableNo(''); setLinkedBooking('');
  };

  const handleSaveTab = async () => {
    if (!guestName && !linkedBooking) { toast.error('Enter guest name or link a booking'); return; }
    if (!orderedItems.length) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      let finalGuestName = guestName;
      if (linkedBooking && !finalGuestName) {
        const b = bookings.find(b => b.record_number === linkedBooking);
        if (b) finalGuestName = b.data?.guest_name || '';
      }
      const tabData = {
        guest_name: finalGuestName, bill_type: 'food_bill',
        linked_booking: linkedBooking || '', table_number: tableNo,
        amount: subtotal.toFixed(2), tax: gstRate, total: total.toFixed(2),
        payment_status: 'unpaid', _food_items: orderedItems, status: 'open_tab',
      };
      if (selectedTab) {
        await recordAPI.update(selectedTab.id, { title: `${finalGuestName} - Food Tab`, data: tabData, status: 'open_tab' });
        toast.success('Tab updated');
      } else {
        await recordAPI.create('billing', { title: `${finalGuestName} - Food Tab`, data: tabData, status: 'open_tab' });
        toast.success('Food tab opened');
      }
      cancelEdit(); loadAll();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleCloseTab = async (tab) => {
    if (!window.confirm('Close this tab and move to billing for payment?')) return;
    setClosing(true);
    try {
      const prefix   = hotelInfo?.invoice_prefix || 'INV';
      const countRes = await recordAPI.list('billing', { limit: 1000 });
      const count    = countRes.success ? (countRes.data?.length || 0) + 1 : 1;
      const invoiceNum = `${prefix}-${String(count).padStart(5, '0')}`;
      await recordAPI.update(tab.id, {
        data: { ...tab.data, status: 'unpaid', payment_status: 'unpaid', invoice_number: invoiceNum },
        status: 'unpaid',
      });
      toast.success('Tab closed — appears in Billing');
      loadAll();
    } catch (err) { toast.error(err.message); }
    setClosing(false);
  };

  const CATEGORY_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', beverages: 'Beverages', snacks: 'Snacks', desserts: 'Desserts', room_service: 'Room Service' };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  const isEditing = selectedTab || creating;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!isEditing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 15 }}>Open Food Tabs</h3>
              <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{openTabs.length > 0 ? `${openTabs.length} active tab(s)` : 'No open tabs'}</p>
            </div>
            <button className="btn btn-primary" onClick={startNewTab}><Plus size={14} /> New Tab</button>
          </div>
          {openTabs.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <UtensilsCrossed size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--color-text-3)', fontSize: 13 }}>No open tabs. Click "New Tab" to start an order.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {openTabs.map(tab => {
                const items    = tab.data?._food_items || [];
                const tabTotal = parseFloat(tab.data?.total) || 0;
                return (
                  <div key={tab.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{tab.data?.guest_name || 'Guest'}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
                          {tab.data?.table_number ? `Table ${tab.data.table_number}` : ''}
                          {tab.data?.linked_booking ? ` · ${tab.data.linked_booking}` : ''}
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--color-secondary)', fontSize: 14 }}>₹{tabTotal.toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)', lineHeight: 1.6 }}>
                      {items.slice(0, 3).map((item, i) => <div key={i}>{item.name} × {item.qty}</div>)}
                      {items.length > 3 && <div>+{items.length - 3} more items</div>}
                      {items.length === 0 && <div>No items yet</div>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{items.length} item{items.length !== 1 ? 's' : ''} · {new Date(tab.created_at).toLocaleDateString()}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openExistingTab(tab)}><Edit size={12} /> Add / Edit Items</button>
                      <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleCloseTab(tab)} disabled={closing}><Receipt size={12} /> Close & Bill</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isEditing && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15 }}>{selectedTab ? `Editing — ${selectedTab.data?.guest_name}` : 'New Food Tab'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit}><X size={14} /> Cancel</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <button key={cat} className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveCategory(cat)}>
                  {cat === 'all' ? 'All' : (CATEGORY_LABELS[cat] || cat)}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: 60 }}><p>No menu items. Add in Menu Items tab first.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(item => {
                  const qty   = order[item.id] || 0;
                  const isVeg = item.data?.is_veg === 'veg' || item.data?.is_veg === 'vegan';
                  return (
                    <div key={item.id} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1.5px solid ${qty > 0 ? 'var(--color-secondary)' : 'var(--color-border)'}`, background: qty > 0 ? '#fff7ed' : 'var(--color-surface)', transition: 'all 0.15s' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 12, height: 12, borderRadius: 2, border: `2px solid ${isVeg ? '#16a34a' : '#dc2626'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: isVeg ? '#16a34a' : '#dc2626', display: 'block' }} />
                          </span>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{item.data?.item_name || item.title}</span>
                        </div>
                        {item.data?.description && <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 3, marginLeft: 18 }}>{item.data.description}</p>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-secondary)', minWidth: 70, textAlign: 'right' }}>₹{Number(item.data?.price || 0).toLocaleString()}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => setQty(item.id, qty - 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{qty}</span>
                          <button onClick={() => setQty(item.id, qty + 1)} style={{ width: 28, height: 28, borderRadius: 6, border: `1.5px solid var(--color-secondary)`, background: qty > 0 ? 'var(--color-secondary)' : 'var(--color-surface)', color: qty > 0 ? 'white' : 'inherit', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card" style={{ position: 'sticky', top: 16 }}>
            <h3 style={{ fontSize: 15, marginBottom: 14 }}>{selectedTab ? 'Update Tab' : 'New Tab'}</h3>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Link to Booking (optional)</label>
              <select className="form-select" value={linkedBooking} onChange={e => { setLinkedBooking(e.target.value); if (e.target.value) { const b = bookings.find(b => b.record_number === e.target.value); if (b && !guestName) setGuestName(b.data?.guest_name || ''); } }}>
                <option value="">Walk-in / No booking</option>
                {bookings.map(b => <option key={b.id} value={b.record_number}>{b.record_number} — {b.data?.guest_name} (Room {b.data?.room_number})</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Guest Name *</label>
              <input className="form-input" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Enter guest name" />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Table No. (optional)</label>
              <input className="form-input" value={tableNo} onChange={e => setTableNo(e.target.value)} placeholder="e.g. 05" />
            </div>
            {orderedItems.length > 0 ? (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginBottom: 12 }}>
                {orderedItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                    <span>{item.name} × {item.qty}</span>
                    <span style={{ fontFamily: 'monospace' }}>₹{(item.price * item.qty).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 14, textAlign: 'center' }}>No items selected</p>}
            {orderedItems.length > 0 && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-3)', marginBottom: 6 }}><span>GST ({gstRate}%)</span><span>₹{gstAmt.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}><span>Total</span><span style={{ color: 'var(--color-secondary)' }}>₹{total.toFixed(2)}</span></div>
              </div>
            )}
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSaveTab} disabled={saving || !orderedItems.length}>
              {saving ? <><Loader size={14} className="animate-spin" /> Saving...</> : selectedTab ? <><CheckCircle size={14} /> Update Tab</> : <><Plus size={14} /> Open Tab · ₹{total.toFixed(2)}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Standard Module Page ──────────────────────────────────────────────────────
const StandardModulePage = ({ moduleSlug, user, queryStatus, titleHeadsOverride }) => {
  const [titleHeads, setTitleHeads] = useState(titleHeadsOverride || []);
  const [records, setRecords]       = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState(queryStatus || '');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal]   = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  useEffect(() => {
    if (!titleHeadsOverride) {
      moduleAPI.titleHeads(moduleSlug).then(res => { if (res.success) setTitleHeads(res.data); }).catch(() => {});
    } else { setTitleHeads(titleHeadsOverride); }
  }, [moduleSlug, titleHeadsOverride]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, statRes] = await Promise.all([
        recordAPI.list(moduleSlug, { page, limit: 20, search, status: filterStatus || undefined }),
        recordAPI.stats(moduleSlug),
      ]);
      if (recRes.success) { setRecords(recRes.data); setTotalPages(recRes.pagination?.totalPages || 1); }
      if (statRes.success) setStats(statRes.data);
    } catch {}
    setLoading(false);
  }, [moduleSlug, page, search, filterStatus]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try { await recordAPI.delete(id); toast.success('Deleted'); fetchRecords(); }
    catch (err) { toast.error(err.message); }
  };

  const handleSave = () => { setShowModal(false); setEditRecord(null); fetchRecords(); };

  const statusField   = titleHeads.find(t => t.name === 'status');
  const statusOptions = statusField?.options || [];
  const preferredCols = MODULE_COLUMNS[moduleSlug];
  const visibleCols   = preferredCols
    ? titleHeads.filter(t => preferredCols.includes(t.name)).sort((a, b) => preferredCols.indexOf(a.name) - preferredCols.indexOf(b.name))
    : titleHeads.slice(0, 4);
  const primaryFieldName = MODULE_PRIMARY_FIELD[moduleSlug];
  const primaryFieldHead = primaryFieldName ? titleHeads.find(t => t.name === primaryFieldName) : null;
  const primaryLabel     = primaryFieldHead?.label || (moduleSlug === 'rooms' ? 'Room' : 'Name');
  const moduleName       = moduleSlug.charAt(0).toUpperCase() + moduleSlug.slice(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {moduleSlug !== 'menu' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>{moduleName}</h2>
            {stats && (
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-3)', flexWrap: 'wrap' }}>
                <span>{stats.summary?.total || 0} total</span><span>·</span>
                <span>{stats.summary?.this_month || 0} this month</span>
                {stats.byStatus?.map(s => <span key={s.status}>· {s.count} {s.status}</span>)}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => { setEditRecord(null); setShowModal(true); }}><Plus size={14} /> New Record</button>
        </div>
      )}
      {moduleSlug === 'menu' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {stats && <p style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{stats.summary?.total || 0} items</p>}
          <button className="btn btn-primary" onClick={() => { setEditRecord(null); setShowModal(true); }}><Plus size={14} /> Add Item</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 13px', background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
          <input style={{ border: 'none', outline: 'none', background: 'none', fontSize: 13, flex: 1, fontFamily: 'var(--font)' }}
            placeholder={`Search ${moduleName}...`} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {statusOptions.length > 0 && (
          <select className="form-select" style={{ width: 'auto' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>
      {loading ? <div className="page-loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {records.length === 0 ? (
            <div className="empty-state" style={{ padding: 60 }}><Plus size={36} /><h3>No {moduleName} records yet</h3><p>Click "New Record" to add your first entry</p></div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>#</th><th>{primaryLabel}</th>{visibleCols.map(c => <th key={c.id}>{c.label}</th>)}<th>Created</th><th></th></tr></thead>
                <tbody>
                  {records.map(r => {
                    const primaryValue = primaryFieldName ? (r.data?.[primaryFieldName] || r.title || '(No name)') : (r.title || '(No title)');
                    return (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {r.parent_record_id && <GitBranch size={11} style={{ color: 'var(--color-secondary)' }} title="Auto-created by workflow" />}
                            {r.record_number}
                          </div>
                        </td>
                        <td style={{ maxWidth: 200 }}>
                          <span style={{ fontWeight: 500, cursor: 'pointer', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => { setEditRecord(r); setShowModal(true); }}>{primaryValue}</span>
                          {r.data?._linked_from && <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>from {r.data._linked_from}</div>}
                        </td>
                        {visibleCols.map(c => (
                          <td key={c.id} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{renderValue(r.data?.[c.name], c)}</td>
                        ))}
                        <td style={{ fontSize: 11, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, opacity: 0 }} className="row-actions">
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditRecord(r); setShowModal(true); }}><Edit size={13} /></button>
                            {moduleSlug === 'inventory' && <QRButton recordId={r.id} moduleSlug={moduleSlug} canGenerate={user?.role === 'user_admin'} />}
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 13, color: 'var(--color-text-3)' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p-1)} disabled={page===1}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p+1)} disabled={page===totalPages}>Next</button>
        </div>
      )}
      <style>{`.row-actions{opacity:0}.table tr:hover .row-actions{opacity:1!important}`}</style>
      {showModal && (
        <RecordModal moduleSlug={moduleSlug} titleHeads={titleHeads} record={editRecord}
          onClose={() => { setShowModal(false); setEditRecord(null); }} onSave={handleSave} />
      )}
    </div>
  );
};

const STATUS_COLORS = {
  vacant: '#16a34a', occupied: '#dc2626', reserved: '#d97706', under_maintenance: '#6b7280', housekeeping: '#7c3aed',
  checked_in: '#2563eb', checked_out: '#6b7280', cancelled: '#dc2626', no_show: '#9a3412',
  paid: '#16a34a', unpaid: '#dc2626', partial: '#d97706', overdue: '#9a3412', open_tab: '#7c3aed', ready: '#16a34a',
  available: '#16a34a', unavailable: '#dc2626', seasonal: '#d97706',
  complete: '#16a34a', pending: '#d97706', in_progress: '#2563eb',
  converted: '#16a34a', new: '#6b7280', lost: '#dc2626', active: '#6b7280',
  scheduled: '#2563eb', en_route: '#d97706',
  room_bill: '#0b1628', food_bill: '#c75b39', transport_bill: '#7c3aed', combined: '#16a34a',
  veg: '#16a34a', non_veg: '#dc2626', vegan: '#16a34a', egg: '#d97706',
};

const renderValue = (value, field) => {
  if (value === undefined || value === null || value === '') return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  if (field.field_type === 'boolean') return value ? '✓' : '✗';
  if (field.field_type === 'date') { try { return new Date(value).toLocaleDateString(); } catch { return value; } }
  if (field.field_type === 'datetime') { try { return new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); } catch { return value; } }
  if (field.field_type === 'currency') return <span style={{ fontFamily: 'monospace' }}>₹{Number(value).toLocaleString()}</span>;
  if (['status','payment_status','available','bill_type','is_veg'].includes(field.name)) {
    const opt   = field.options?.find(o => o.value === value);
    const label = opt?.label || value;
    const color = STATUS_COLORS[value] || '#6b7280';
    return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: color + '18', color }}>{label}</span>;
  }
  const str = String(value);
  return <span title={str} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 150 }}>{str.length > 30 ? str.substring(0,30)+'…' : str}</span>;
};

export default ModulePage;
