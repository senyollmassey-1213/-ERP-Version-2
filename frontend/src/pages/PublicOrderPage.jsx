import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, CheckCircle, Loader, X, Plus, Minus, ChefHat, Receipt } from 'lucide-react';

const API = 'https://api.drusshti.com/api/public';

// ── Food Court Picker ─────────────────────────────────────────────────────────
const FoodCourtPicker = ({ foodCourtName, members, tableNum }) => {
  const navigate = useNavigate();

  const handlePick = (slug) => {
    navigate(`/order/${slug}${tableNum ? `?table=${tableNum}` : ''}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#0b1628', padding: '24px 16px 20px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>{foodCourtName}</h1>
          {tableNum && <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 }}>Table {tableNum}</p>}
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 8 }}>Where would you like to order from?</p>
        </div>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {members.map(m => (
          <button key={m.slug} onClick={() => handlePick(m.slug)}
            style={{ width: '100%', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', textAlign: 'left' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: m.primary_color || '#0b1628', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
              {m.logo_url
                ? <img src={m.logo_url} alt={m.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                : m.name.charAt(0)}
            </div>
            <span style={{ fontWeight: 600, fontSize: 16, color: '#1e293b' }}>{m.name}</span>
            <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 20 }}>›</span>
          </button>
        ))}
      </div>
      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: '#cbd5e1' }}>
        Powered by <strong style={{ color: '#c75b39' }}>Drusshti</strong>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const PublicOrderPage = () => {
  const { hotelSlug } = useParams();
  const [searchParams] = useSearchParams();
  const tableNum = searchParams.get('table') || '';

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [existingOrder, setExistingOrder] = useState(null);
  const [guestName, setGuestName]   = useState('');
  const [phone, setPhone]           = useState('');
  const [table, setTable]           = useState(tableNum);
  const [order, setOrder]           = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [showCart, setShowCart]     = useState(false);
  const [step, setStep]             = useState('menu');
  const [placing, setPlacing]       = useState(false);
  const [paying, setPaying]         = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [orderReady, setOrderReady] = useState(false);

  // Food court state
  const [isFoodCourt, setIsFoodCourt] = useState(false);
  const [foodCourtData, setFoodCourtData] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        // First check if this is a food court
        const fcRes = await fetch(`${API}/${hotelSlug}/food-court`).then(r => r.json());
        if (fcRes.success) {
          setIsFoodCourt(true);
          setFoodCourtData(fcRes.data);
          setLoading(false);
          return;
        }

        // Normal restaurant flow
        const menuRes = await fetch(`${API}/${hotelSlug}/menu`).then(r => r.json());
        if (!menuRes.success) { setError(menuRes.message || 'Restaurant not found'); setLoading(false); return; }
        setRestaurant(menuRes.data.restaurant);
        setMenu(menuRes.data.menu);
        if (tableNum) {
          const tabRes = await fetch(`${API}/${hotelSlug}/order/${tableNum}`).then(r => r.json());
          if (tabRes.success && tabRes.data) {
            const tab = tabRes.data;
            setExistingOrder(tab);
            setGuestName(tab.guest_name || '');
            setPhone(tab.phone || '');
            setOrderReady(tab.ready || false);
            const qtyMap = {};
            (tab.items || []).forEach(item => { qtyMap[item.id] = item.qty; });
            setOrder(qtyMap);
            setOrderResult({ order_id: tab.order_id, id: tab.id, total: tab.total });
          }
        }
      } catch { setError('Could not load menu. Please try again.'); }
      setLoading(false);
    };
    load();
  }, [hotelSlug, tableNum]);

  const primary = restaurant?.qr_primary || '#0b1628';
  const accent  = restaurant?.qr_accent  || '#c75b39';
  const gstRate = restaurant?.gst_rates?.food || 5;

  const categories = ['all', ...new Set(menu.map(m => m.category).filter(Boolean))];
  const filtered   = activeCategory === 'all' ? menu : menu.filter(m => m.category === activeCategory);

  const setQty = (id, qty) => {
    if (orderReady) return;
    setOrder(prev => ({ ...prev, [id]: Math.max(0, qty) }));
  };

  const orderedItems = menu.filter(m => (order[m.id] || 0) > 0).map(m => ({
    id: m.id, name: m.name, price: m.price, qty: order[m.id],
  }));
  const subtotal   = orderedItems.reduce((s, i) => s + (i.price * i.qty), 0);
  const gstAmt     = subtotal * gstRate / 100;
  const total      = subtotal + gstAmt;
  const totalItems = Object.values(order).reduce((s, q) => s + (q || 0), 0);

  const CATEGORY_LABELS = {
    breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner',
    beverages: 'Beverages', snacks: 'Snacks', desserts: 'Desserts', room_service: 'Room Service',
  };

  const handlePlaceOrder = async () => {
    if (!guestName.trim()) { alert('Please enter your name'); return; }
    if (!phone.trim() || phone.replace(/\D/g,'').length < 10) { alert('Please enter a valid 10-digit phone number'); return; }
    if (!table.trim()) { alert('Please enter your table number'); return; }
    if (!orderedItems.length) { alert('Please add at least one item'); return; }
    setPlacing(true);
    try {
      const res = await fetch(`${API}/${hotelSlug}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_name: guestName, phone, table_number: table, items: orderedItems }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderResult(data.data);
        setExistingOrder({ ...data.data, items: orderedItems, guest_name: guestName, phone, table_number: table });
        setShowCart(false);
        alert(existingOrder ? 'Order updated!' : 'Order placed! You can add more items anytime.');
      } else { alert(data.message || 'Failed to place order'); }
    } catch { alert('Network error. Please try again.'); }
    setPlacing(false);
  };

  const handleCloseOrder = () => {
    if (!orderedItems.length) { alert('No items in your order'); return; }
    setShowCart(false);
    setStep('bill');
  };

  const handlePayUPI = () => {
    const upiId = restaurant?.upi_id;
    const amount = total.toFixed(2);
    const ref = orderResult?.order_id || 'ORDER';
    const name = encodeURIComponent(restaurant?.name || 'Restaurant');
    if (upiId) {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${name}&am=${amount}&tn=${ref}&cu=INR`;
      window.location.href = upiUrl;
      setTimeout(() => setPaymentMethod('upi_confirm'), 2000);
    } else {
      alert('UPI not configured. Please pay cash or ask staff.');
    }
  };

  const handleConfirmPaid = async () => {
    if (!orderResult?.id) { alert('Order not found'); return; }
    setPaying(true);
    try {
      const res = await fetch(`${API}/${hotelSlug}/order/${orderResult.id}/paid`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) { setStep('success'); }
      else { alert(data.message || 'Failed to confirm payment'); }
    } catch { alert('Network error. Please try again.'); }
    setPaying(false);
  };

  const handleCashPaid = () => { setStep('success'); };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #c75b39', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // Food court picker screen
  if (isFoodCourt && foodCourtData) return (
    <FoodCourtPicker
      foodCourtName={foodCourtData.food_court_name}
      members={foodCourtData.members}
      tableNum={tableNum}
    />
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 16 }}>😕</div><h2 style={{ marginBottom: 8 }}>Oops!</h2><p style={{ color: '#64748b' }}>{error}</p></div>
    </div>
  );

  if (step === 'success') return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ width: 64, height: 64, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CheckCircle size={32} color="#16a34a" />
        </div>
        <h2 style={{ color: '#15803d', fontSize: 22, marginBottom: 8 }}>{paymentMethod === 'cash' ? 'Order Closed!' : 'Payment Confirmed!'}</h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
          {paymentMethod === 'cash' ? 'Please pay cash to the staff. Thank you!' : `Payment of ₹${Number(total).toLocaleString()} confirmed. Thank you!`}
        </p>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', fontSize: 13, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: '#64748b' }}>Order</span><span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{orderResult?.order_id}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: '#64748b' }}>Table</span><span style={{ fontWeight: 600 }}>Table {table}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Total</span><span style={{ fontWeight: 700, color: accent }}>₹{total.toFixed(2)}</span></div>
        </div>
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#cbd5e1' }}>Powered by <strong style={{ color: '#c75b39' }}>Drusshti</strong></div>
      </div>
    </div>
  );

  if (step === 'bill') return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <button onClick={() => setStep('menu')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>← Back</button>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Receipt size={18} style={{ color: primary }} />
            <h2 style={{ color: primary, fontSize: 18, margin: 0 }}>Your Bill</h2>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>{restaurant?.name} · Table {table} · {guestName}</p>
          {orderedItems.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>{item.name} × {item.qty}</span><span style={{ fontFamily: 'monospace' }}>₹{(item.price * item.qty).toLocaleString()}</span>
            </div>
          ))}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 4 }}><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 10 }}><span>GST ({gstRate}%)</span><span>₹{gstAmt.toFixed(2)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}><span>Total</span><span style={{ color: accent }}>₹{total.toFixed(2)}</span></div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <h3 style={{ color: primary, fontSize: 16, marginBottom: 16 }}>How would you like to pay?</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={handleCashPaid} style={{ width: '100%', padding: '16px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
              <span style={{ fontSize: 24 }}>💵</span>
              <div><div style={{ fontWeight: 700, color: '#1e293b' }}>Pay Cash</div><div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Staff will collect cash from you</div></div>
            </button>
            {paymentMethod !== 'upi_confirm' ? (
              <button onClick={handlePayUPI} style={{ width: '100%', padding: '16px', background: accent, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                <span style={{ fontSize: 24 }}>📱</span>
                <div><div>Pay ₹{total.toFixed(2)} via UPI</div><div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Opens GPay, PhonePe, Paytm</div></div>
              </button>
            ) : (
              <div style={{ padding: 16, background: '#fff7ed', borderRadius: 12, border: `1.5px solid ${accent}` }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#c2410c', marginBottom: 4 }}>Opened your UPI app?</p>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>Pay ₹{total.toFixed(2)} to <strong>{restaurant?.upi_id}</strong> and tap confirm below.</p>
                <button onClick={handleConfirmPaid} disabled={paying}
                  style={{ width: '100%', padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: paying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {paying ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={16} />}
                  {paying ? 'Confirming...' : "I've Paid"}
                </button>
                <button onClick={() => setPaymentMethod('cash')} style={{ width: '100%', marginTop: 8, padding: '10px', background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>← Try another way</button>
              </div>
            )}
            {restaurant?.upi_id && <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>UPI ID: <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{restaurant.upi_id}</span></p>}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:rgba(255,255,255,0.55)}`}</style>
      <div style={{ background: primary, padding: '20px 16px 16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {restaurant?.logo_url && <img src={restaurant.logo_url} alt="Logo" style={{ height: 32, objectFit: 'contain', marginBottom: 6, display: 'block' }} onError={e => e.target.style.display = 'none'} />}
              <h1 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: 0 }}>{restaurant?.name}</h1>
              {table && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: '2px 0 0' }}>Table {table}</p>}
            </div>
            {totalItems > 0 && (
              <button onClick={() => setShowCart(!showCart)} style={{ background: accent, border: 'none', borderRadius: 10, padding: '8px 14px', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <ShoppingCart size={16} />{totalItems} · ₹{total.toFixed(0)}
              </button>
            )}
          </div>
          {!existingOrder && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Your Name *" style={{ padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: 'white', outline: 'none' }} />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone *" type="tel" style={{ padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: 'white', outline: 'none' }} />
            </div>
          )}
          {existingOrder && <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 8 }}>Welcome back, {guestName}! {orderReady ? '✅ Your order is ready!' : 'Add more items or close your order.'}</p>}
          {!tableNum && !existingOrder && <input value={table} onChange={e => setTable(e.target.value)} placeholder="Table Number *" style={{ marginTop: 8, width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: 'white', outline: 'none', boxSizing: 'border-box' }} />}
          {orderReady && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: '#dcfce7', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChefHat size={16} color="#16a34a" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>Your order is ready! Please close your order to pay.</span>
            </div>
          )}
        </div>
      </div>

      {showCart && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderRadius: '16px 16px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', zIndex: 200, padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, color: primary }}>Your Order</h3>
            <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
          </div>
          {orderedItems.length === 0 ? <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, padding: '20px 0' }}>No items yet</p> : (
            orderedItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 14 }}>{item.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {!orderReady && (
                    <>
                      <button onClick={() => setQty(item.id, item.qty - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1.5px solid ${accent}`, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={12} /></button>
                      <span style={{ fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => setQty(item.id, item.qty + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: accent, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={12} /></button>
                    </>
                  )}
                  {orderReady && <span style={{ fontWeight: 600, minWidth: 20, textAlign: 'center' }}>× {item.qty}</span>}
                  <span style={{ fontFamily: 'monospace', fontSize: 13, minWidth: 60, textAlign: 'right' }}>₹{(item.price * item.qty).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '2px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 4 }}><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 14 }}><span>GST ({gstRate}%)</span><span>₹{gstAmt.toFixed(2)}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!orderReady && (
                <button onClick={() => { setShowCart(false); handlePlaceOrder(); }} disabled={placing || !orderedItems.length}
                  style={{ width: '100%', padding: 14, background: orderedItems.length ? primary : '#94a3b8', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: orderedItems.length ? 'pointer' : 'not-allowed' }}>
                  {placing ? 'Saving...' : existingOrder ? `Update Order · ₹${total.toFixed(2)}` : `Place Order · ₹${total.toFixed(2)}`}
                </button>
              )}
              {existingOrder && (
                <button onClick={handleCloseOrder} style={{ width: '100%', padding: 14, background: accent, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Receipt size={16} /> Close Order & Pay · ₹{total.toFixed(2)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 100px' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16, scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: activeCategory === cat ? accent : 'white', color: activeCategory === cat ? 'white' : '#475569', fontWeight: activeCategory === cat ? 700 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 }}>
              {cat === 'all' ? 'All Items' : (CATEGORY_LABELS[cat] || cat)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => {
            const qty = order[item.id] || 0;
            const isVeg = item.is_veg === 'veg' || item.is_veg === 'vegan';
            const isEgg = item.is_veg === 'egg';
            const dotColor = isVeg ? '#16a34a' : isEgg ? '#d97706' : '#dc2626';
            return (
              <div key={item.id} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1.5px solid ${qty > 0 ? accent : 'transparent'}` }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${dotColor}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'block' }} />
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>{item.name}</span>
                  </div>
                  {item.description && <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, paddingLeft: 21 }}>{item.description}</p>}
                  <p style={{ fontSize: 14, fontWeight: 700, color: accent, margin: '6px 0 0', paddingLeft: 21 }}>₹{item.price.toLocaleString()}</p>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {orderReady ? (qty > 0 ? <span style={{ fontSize: 13, color: '#64748b' }}>× {qty}</span> : null) :
                   qty === 0 ? (
                    <button onClick={() => setQty(item.id, 1)} style={{ padding: '8px 20px', background: accent, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>ADD</button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setQty(item.id, qty - 1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${accent}`, background: 'white', color: accent, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                      <span style={{ fontWeight: 700, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{qty}</span>
                      <button onClick={() => setQty(item.id, qty + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: accent, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!showCart && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'white', boxShadow: '0 -2px 12px rgba(0,0,0,0.08)', zIndex: 100 }}>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', gap: 10 }}>
            {totalItems > 0 && (
              <button onClick={() => setShowCart(true)} style={{ flex: 1, padding: 14, background: primary, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 20, paddingRight: 20 }}>
                <span>{totalItems} item{totalItems > 1 ? 's' : ''}</span>
                <span>{existingOrder ? 'View / Edit Order' : 'View Order'}</span>
                <span>₹{total.toFixed(2)}</span>
              </button>
            )}
            {existingOrder && totalItems === 0 && (
              <button onClick={handleCloseOrder} style={{ flex: 1, padding: 14, background: accent, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Close Order & Pay</button>
            )}
            {!existingOrder && totalItems === 0 && (
              <div style={{ flex: 1, textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '14px 0' }}>Add items to start your order</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicOrderPage;
