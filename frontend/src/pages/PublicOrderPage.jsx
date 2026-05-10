import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ShoppingCart, CheckCircle, Loader, X, Plus, Minus } from 'lucide-react';

const API = 'https://backend-production-4750.up.railway.app/api/public';

const PublicOrderPage = () => {
  const { hotelSlug } = useParams();
  const [searchParams] = useSearchParams();
  const tableNum = searchParams.get('table') || '';

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [guestName, setGuestName]   = useState('');
  const [phone, setPhone]           = useState('');
  const [table, setTable]           = useState(tableNum);
  const [order, setOrder]           = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [step, setStep]             = useState('menu'); // menu | payment | success
  const [placing, setPlacing]       = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showCart, setShowCart]     = useState(false);

  useEffect(() => {
    fetch(`${API}/${hotelSlug}/menu`)
      .then(r => r.json())
      .then(res => {
        if (res.success) { setRestaurant(res.data.restaurant); setMenu(res.data.menu); }
        else setError(res.message || 'Restaurant not found');
      })
      .catch(() => setError('Could not load menu. Please try again.'))
      .finally(() => setLoading(false));
  }, [hotelSlug]);

  const primary = restaurant?.qr_primary || '#0b1628';
  const accent  = restaurant?.qr_accent  || '#c75b39';
  const gstRate = restaurant?.gst_rates?.food || 5;

  const categories = ['all', ...new Set(menu.map(m => m.category).filter(Boolean))];
  const filtered   = activeCategory === 'all' ? menu : menu.filter(m => m.category === activeCategory);

  const setQty = (id, qty) => setOrder(prev => ({ ...prev, [id]: Math.max(0, qty) }));

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

  const handleSubmit = () => {
    if (!guestName.trim()) { alert('Please enter your name'); return; }
    if (!phone.trim() || phone.length < 10) { alert('Please enter a valid phone number'); return; }
    if (!table.trim()) { alert('Please enter your table number'); return; }
    if (!orderedItems.length) { alert('Please add items to your order'); return; }
    setShowCart(false);
    setStep('payment');
  };

  const handlePlaceOrder = async () => {
    setPlacing(true);
    try {
      const res = await fetch(`${API}/${hotelSlug}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guestName, phone, table_number: table,
          items: orderedItems, payment_method: paymentMethod,
        }),
      });
      const data = await res.json();
      if (data.success) { setOrderResult(data.data); setStep('success'); }
      else alert(data.message || 'Failed to place order');
    } catch { alert('Network error. Please try again.'); }
    setPlacing(false);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #c75b39', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading menu...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
        <h2 style={{ color: '#1e293b', marginBottom: 8 }}>Oops!</h2>
        <p style={{ color: '#64748b', fontSize: 14 }}>{error}</p>
      </div>
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────
  if (step === 'success') return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ width: 64, height: 64, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CheckCircle size={32} color="#16a34a" />
        </div>
        <h2 style={{ color: '#15803d', fontSize: 22, marginBottom: 8 }}>Order Placed!</h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
          Thank you {guestName}! Your order for Table {table} has been received.
        </p>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#64748b' }}>Order ID</span>
            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{orderResult?.order_id}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#64748b' }}>Table</span>
            <span style={{ fontWeight: 600 }}>Table {table}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Total</span>
            <span style={{ fontWeight: 700, color: accent }}>₹{Number(orderResult?.total).toLocaleString()}</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8' }}>
          {paymentMethod === 'cash' ? 'Please pay cash to the staff.' : 'Payment via UPI. Show confirmation to staff.'}
        </p>
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#cbd5e1' }}>
          Powered by <strong style={{ color: '#c75b39' }}>Drusshti</strong>
        </div>
      </div>
    </div>
  );

  // ── Payment ───────────────────────────────────────────────────────────────
  if (step === 'payment') return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <button onClick={() => setStep('menu')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>← Back to menu</button>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <h2 style={{ color: primary, fontSize: 18, marginBottom: 16 }}>Order Summary</h2>
          {orderedItems.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>{item.name} × {item.qty}</span>
              <span style={{ fontFamily: 'monospace' }}>₹{(item.price * item.qty).toLocaleString()}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 4 }}>
              <span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 8 }}>
              <span>GST ({gstRate}%)</span><span>₹{gstAmt.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
              <span>Total</span><span style={{ color: accent }}>₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <h3 style={{ color: primary, fontSize: 16, marginBottom: 16 }}>Payment Method</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[{ value: 'cash', label: '💵 Pay Cash', desc: 'Pay to staff at counter' },
              { value: 'upi',  label: '📱 Pay via UPI', desc: 'Google Pay, PhonePe, Paytm' }
            ].map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: `2px solid ${paymentMethod === opt.value ? accent : '#e2e8f0'}`, borderRadius: 12, cursor: 'pointer', background: paymentMethod === opt.value ? '#fff7ed' : 'white' }}>
                <input type="radio" name="payment" value={opt.value} checked={paymentMethod === opt.value} onChange={() => setPaymentMethod(opt.value)} style={{ accentColor: accent }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
          {paymentMethod === 'upi' && restaurant?.upi_qr_url && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Scan to pay ₹{total.toFixed(2)}</p>
              <img src={restaurant.upi_qr_url} alt="UPI QR"
                style={{ width: 200, height: 200, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 12, padding: 8 }}
                onError={e => e.target.style.display = 'none'} />
              {restaurant?.upi_id && <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, fontFamily: 'monospace' }}>UPI ID: {restaurant.upi_id}</p>}
            </div>
          )}
          {paymentMethod === 'upi' && !restaurant?.upi_qr_url && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef9c3', borderRadius: 10, fontSize: 13, color: '#854d0e' }}>
              Please ask staff for UPI QR or pay cash.
            </div>
          )}
        </div>

        <button onClick={handlePlaceOrder} disabled={placing}
          style={{ width: '100%', padding: 16, background: placing ? '#94a3b8' : accent, color: 'white', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: placing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {placing ? <><Loader size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Placing...</> : `Confirm Order · ₹${total.toFixed(2)}`}
        </button>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  // ── Menu ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:rgba(255,255,255,0.6)}`}</style>

      {/* Header */}
      <div style={{ background: primary, padding: '20px 16px 16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {restaurant?.logo_url && (
                <img src={restaurant.logo_url} alt="Logo" style={{ height: 32, objectFit: 'contain', marginBottom: 6, display: 'block' }} onError={e => e.target.style.display = 'none'} />
              )}
              <h1 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: 0 }}>{restaurant?.name}</h1>
              {table && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: '2px 0 0' }}>Table {table}</p>}
            </div>
            {totalItems > 0 && (
              <button onClick={() => setShowCart(!showCart)}
                style={{ background: accent, border: 'none', borderRadius: 10, padding: '8px 14px', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <ShoppingCart size={16} />{totalItems} · ₹{total.toFixed(0)}
              </button>
            )}
          </div>
          {/* Guest Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Your Name *"
              style={{ padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: 'white', outline: 'none' }} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number *" type="tel"
              style={{ padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: 'white', outline: 'none' }} />
          </div>
          {!tableNum && (
            <input value={table} onChange={e => setTable(e.target.value)} placeholder="Table Number *"
              style={{ marginTop: 8, width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: 'white', outline: 'none', boxSizing: 'border-box' }} />
          )}
        </div>
      </div>

      {/* Cart Drawer */}
      {showCart && totalItems > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderRadius: '16px 16px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', zIndex: 200, padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, color: primary }}>Your Order</h3>
            <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
          </div>
          {orderedItems.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 14 }}>{item.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setQty(item.id, item.qty - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1.5px solid ${accent}`, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={12} /></button>
                <span style={{ fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                <button onClick={() => setQty(item.id, item.qty + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: accent, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={12} /></button>
                <span style={{ fontFamily: 'monospace', fontSize: 13, minWidth: 60, textAlign: 'right' }}>₹{(item.price * item.qty).toLocaleString()}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '2px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 4 }}><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 10 }}><span>GST ({gstRate}%)</span><span>₹{gstAmt.toFixed(2)}</span></div>
            <button onClick={handleSubmit} style={{ width: '100%', padding: 14, background: accent, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Place Order · ₹{total.toFixed(2)}
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 100px' }}>
        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16, scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: activeCategory === cat ? accent : 'white', color: activeCategory === cat ? 'white' : '#475569', fontWeight: activeCategory === cat ? 700 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 }}>
              {cat === 'all' ? 'All Items' : (CATEGORY_LABELS[cat] || cat)}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => {
            const qty      = order[item.id] || 0;
            const isVeg    = item.is_veg === 'veg' || item.is_veg === 'vegan';
            const isEgg    = item.is_veg === 'egg';
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {qty === 0 ? (
                    <button onClick={() => setQty(item.id, 1)} style={{ padding: '8px 20px', background: accent, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>ADD</button>
                  ) : (
                    <>
                      <button onClick={() => setQty(item.id, qty - 1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${accent}`, background: 'white', color: accent, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                      <span style={{ fontWeight: 700, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{qty}</span>
                      <button onClick={() => setQty(item.id, qty + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: accent, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky bottom CTA */}
      {totalItems > 0 && !showCart && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'white', boxShadow: '0 -2px 12px rgba(0,0,0,0.08)', zIndex: 100 }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <button onClick={handleSubmit} style={{ width: '100%', padding: 14, background: accent, color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 20, paddingRight: 20 }}>
              <span>{totalItems} item{totalItems > 1 ? 's' : ''}</span>
              <span>Place Order</span>
              <span>₹{total.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicOrderPage;
