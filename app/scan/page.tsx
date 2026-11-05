'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { InventoryLog } from '../lib/supabase';

export default function MobileScanPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [counterName, setCounterName] = useState('');
  const [previousLog, setPreviousLog] = useState<InventoryLog | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [savedLocations, setSavedLocations] = useState<string[]>([]);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('stocki_user');
    if (!userStr) {
      router.push('/login');
      return;
    }
    const user = JSON.parse(userStr);
    if (!user.tenant_id) {
      // If master or no tenant, maybe redirect or allow? Let's just set it.
      setTenantId(user.tenant_id);
    } else {
      setTenantId(user.tenant_id);
    }

    if (user.full_name) {
      setCounterName(user.full_name);
    } else {
      const savedName = localStorage.getItem('stocki_counter_name');
      if (savedName) setCounterName(savedName);
    }
  }, [router]);

  useEffect(() => {
    if (!tenantId) return;

    const fetchLocations = async () => {
      const { data } = await supabase
        .from('inventory_logs')
        .select('location')
        .eq('tenant_id', tenantId)
        .limit(200);
      if (data) {
        const uniqueLocs = Array.from(new Set(data.map((item) => item.location).filter(Boolean)));
        setSavedLocations(uniqueLocs as string[]);
      }
    };
    fetchLocations();

    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 15, qrbox: { width: 220, height: 220 }, rememberLastUsedCamera: true },
      false
    );

    scanner.render(
      (decodedText) => {
        setBarcode(decodedText);
        if (navigator.vibrate) navigator.vibrate([200]);
      },
      () => {}
    );

    scannerRef.current = scanner;
    return () => {
      scanner.clear().catch(() => {});
    };
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;

    const checkBarcode = async () => {
      const cleanBarcode = barcode.trim();
      if (!cleanBarcode) {
        setProductName('');
        setLocation('');
        setPreviousLog(null);
        setEditMode(false);
        return;
      }

      setSearching(true);

      const { data: logData } = await supabase
        .from('inventory_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('barcode', cleanBarcode)
        .order('counted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logData) {
        setPreviousLog(logData);
        setProductName(logData.product_name);
        setLocation(logData.location || '');
        setQuantity(String(logData.counted_quantity));
        setEditMode(true);
      } else {
        setPreviousLog(null);
        setEditMode(false);
        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('barcode', cleanBarcode)
          .maybeSingle();

        if (prodData) {
          setProductName(prodData.name);
          setLocation(prodData.default_location || '');
        }
      }

      setSearching(false);
    };

    const timer = setTimeout(checkBarcode, 300);
    return () => clearTimeout(timer);
  }, [barcode, tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    const cleanBarcode = barcode.trim();
    const cleanProductName = productName.trim();
    const cleanLocation = location.trim() || 'غير محدد';

    if (!cleanBarcode || !cleanProductName || !counterName || !quantity) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage('');

    // Make sure we have a unique combination of tenant_id and barcode in upsert.
    // The previous implementation was: { onConflict: 'barcode' }, but with multi-tenant it is 'tenant_id, barcode'
    // Let's first check if product exists to update, or just insert/update using onConflict
    await supabase.from('products').upsert(
      [{
        tenant_id: tenantId,
        barcode: cleanBarcode,
        name: cleanProductName,
        default_location: cleanLocation,
        system_quantity: 0,
        purchase_price: 0,
        sale_price: 0
      }],
      { onConflict: 'tenant_id, barcode' }
    );

    let error = null;

    if (editMode && previousLog) {
      const { error: updateErr } = await supabase
        .from('inventory_logs')
        .update({
          product_name: cleanProductName,
          counted_quantity: parseFloat(quantity),
          location: cleanLocation,
          counted_by_name: counterName,
          counted_at: new Date().toISOString(),
        })
        .eq('id', previousLog.id)
        .eq('tenant_id', tenantId);
      error = updateErr;
    } else {
      const { error: insertErr } = await supabase.from('inventory_logs').insert([
        {
          tenant_id: tenantId,
          barcode: cleanBarcode,
          product_name: cleanProductName,
          counted_quantity: parseFloat(quantity),
          location: cleanLocation,
          counted_by_name: counterName,
        },
      ]);
      error = insertErr;
    }

    setIsSubmitting(false);

    if (error) {
      alert('خطأ في حفظ البيانات: ' + error.message);
    } else {
      setSuccessMessage(
        editMode
          ? `تم تعديل وتحديث "${cleanProductName}" بنجاح! ✏️✅`
          : `تم تسجيل "${cleanProductName}" (الكمية: ${quantity}) بنجاح! 🚀`
      );
      setBarcode('');
      setProductName('');
      setLocation('');
      setQuantity('1');
      setPreviousLog(null);
      setEditMode(false);
      setTimeout(() => setSuccessMessage(''), 3500);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 pb-12 font-sans" dir="rtl">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-sm flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold">Stocki Scanner 📱</h1>
            <p className="text-indigo-100 text-xs">الجرد الذكي وتحديد المواقع</p>
          </div>
          <Link href="/login" className="bg-indigo-700 hover:bg-indigo-800 text-xs px-3 py-1.5 rounded-xl font-bold">
            حسابي 🔐
          </Link>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <label className="block text-xs font-bold text-slate-600 mb-1">القائم بالجرد الحالي:</label>
          <input
            type="text"
            placeholder="اكتب اسمك أو سجل الدخول"
            value={counterName}
            onChange={(e) => {
              setCounterName(e.target.value);
              localStorage.setItem('stocki_counter_name', e.target.value);
            }}
            className="w-full px-3 py-2 border rounded-xl text-slate-800 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-center">
          <p className="text-xs text-slate-500 mb-2">وجه الكاميرا نحو الباركود:</p>
          <div className="w-full rounded-xl overflow-hidden flex justify-center items-center" style={{ maxHeight: '280px' }}>
            <div id="reader" className="w-full"></div>
          </div>
        </div>

        {previousLog && (
          <div className="bg-amber-50 border-2 border-amber-400 text-amber-900 p-4 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                تنبيه: هذا العنصر تم جرده من قبل!
              </span>
              <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                مسجل مسبقاً
              </span>
            </div>
            <div className="text-xs space-y-1 bg-white/80 p-3 rounded-xl border border-amber-200">
              <p>📦 <strong>الاسم:</strong> {previousLog.product_name}</p>
              <p>🔢 <strong>الكمية السابقة:</strong> <span className="font-bold text-indigo-700">{previousLog.counted_quantity}</span></p>
              <p>📍 <strong>الموقع:</strong> {previousLog.location || 'غير محدد'}</p>
              <p>👤 <strong>أدخله:</strong> {previousLog.counted_by_name}</p>
              <p>🕒 <strong>الوقت:</strong> {new Date(previousLog.counted_at).toLocaleString('fr-FR')}</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  editMode ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-800 border-amber-400'
                }`}
              >
                ✏️ تعديل الكمية/الموقع
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  !editMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                ➕ إضافة كسطر جديد
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-600">الباركود المقروء:</label>
              {searching && <span className="text-xs text-indigo-500">جاري الفحص...</span>}
            </div>
            <input
              type="text"
              required
              placeholder="امسح بالكاميرا أو اكتب الكود"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border rounded-xl font-mono text-indigo-700 font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">اسم المنتج (Article):</label>
            <input
              type="text"
              required
              placeholder="اسم السلعة"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-xl text-slate-800 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">موقع السلعة (Emplacement):</label>
            <input
              type="text"
              required
              list="locations-list"
              placeholder="مثلاً: المخزن 1 - الرف B2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-xl text-slate-800 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <datalist id="locations-list">
              {savedLocations.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              {editMode ? 'الكمية الجديدة (تعديل):' : 'الكمية المحسوبة:'}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((prev) => Math.max(0, (parseFloat(prev) || 1) - 1).toString())}
                className="w-12 h-11 bg-slate-200 text-slate-700 font-bold rounded-xl text-lg cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                required
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-center text-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((prev) => ((parseFloat(prev) || 0) + 1).toString())}
                className="w-12 h-11 bg-slate-200 text-slate-700 font-bold rounded-xl text-lg cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs p-3 rounded-xl text-center font-bold">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 text-white rounded-xl font-bold shadow-md transition text-base cursor-pointer ${
              editMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isSubmitting ? 'جاري الحفظ...' : editMode ? 'حفظ التعديلات على العنصر ✏️' : 'تسجيل وإرسال الجرد 🚀'}
          </button>
        </form>
      </div>
    </main>
  );
}
