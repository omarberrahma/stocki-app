'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function MobileScanPage() {
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [counterName, setCounterName] = useState('');
  const [previousLog, setPreviousLog] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('stocki_counter_name');
    if (savedName) setCounterName(savedName);

    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 250, height: 150 }, rememberLastUsedCamera: true },
      false
    );

    scanner.render(
      (decodedText) => {
        setBarcode(decodedText);
        if (navigator.vibrate) navigator.vibrate(100);
      },
      () => {}
    );

    scannerRef.current = scanner;
    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  useEffect(() => {
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
  }, [barcode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBarcode = barcode.trim();
    const cleanProductName = productName.trim();
    const cleanLocation = location.trim() || 'غير محدد';

    if (!cleanBarcode || !cleanProductName || !counterName || !quantity) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage('');

    await supabase.from('products').upsert(
      [{ barcode: cleanBarcode, name: cleanProductName, default_location: cleanLocation }],
      { onConflict: 'barcode' }
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
        .eq('id', previousLog.id);
      error = updateErr;
    } else {
      const { error: insertErr } = await supabase.from('inventory_logs').insert([
        {
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
    <main className="min-h-screen bg-slate-50 p-4 pb-12 font-sans" dir="rtl">
      <div className="max-w-lg mx-auto space-y-6 mt-2">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-5 rounded-3xl shadow-lg shadow-indigo-500/30 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Stocki Scanner 📱</h1>
            <p className="text-indigo-100 text-sm font-medium mt-1">الجرد الذكي وتحديد المواقع</p>
          </div>
          <Link href="/login" className="bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/20 text-sm px-4 py-2 rounded-xl font-bold transition-all">
            حسابي 🔐
          </Link>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <label className="block text-sm font-bold text-slate-700 mb-2">القائم بالجرد الحالي:</label>
          <input
            type="text"
            placeholder="اكتب اسمك أو سجل الدخول"
            value={counterName}
            onChange={(e) => {
              setCounterName(e.target.value);
              localStorage.setItem('stocki_counter_name', e.target.value);
            }}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>

        <div className="bg-slate-900 p-5 rounded-3xl shadow-xl shadow-slate-900/20 overflow-hidden text-center border border-slate-800">
          <p className="text-sm font-medium text-slate-300 mb-3 flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            وجه الكاميرا نحو الباركود
          </p>
          <div className="p-1 rounded-2xl bg-white/5 ring-1 ring-white/10">
            <div id="reader" className="w-full rounded-xl overflow-hidden [&_video]:rounded-xl [&_video]:object-cover"></div>
          </div>
        </div>

        {previousLog && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-5 rounded-3xl shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-base flex items-center gap-2">
                <span className="text-xl">⚠️</span> تنبيه: تم جرده مسبقاً!
              </span>
              <span className="text-xs bg-amber-200/80 text-amber-900 px-3 py-1 rounded-lg font-bold border border-amber-300/50">
                مسجل
              </span>
            </div>
            <div className="text-sm space-y-2 bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-amber-100">
              <p className="flex justify-between border-b border-amber-100 pb-2">
                <span className="text-slate-500">📦 الاسم:</span>
                <span className="font-bold">{previousLog.product_name}</span>
              </p>
              <p className="flex justify-between border-b border-amber-100 pb-2">
                <span className="text-slate-500">🔢 الكمية السابقة:</span>
                <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{previousLog.counted_quantity}</span>
              </p>
              <p className="flex justify-between border-b border-amber-100 pb-2">
                <span className="text-slate-500">📍 الموقع:</span>
                <span className="font-bold">{previousLog.location || 'غير محدد'}</span>
              </p>
              <p className="flex justify-between border-b border-amber-100 pb-2">
                <span className="text-slate-500">👤 أدخله:</span>
                <span className="font-bold">{previousLog.counted_by_name}</span>
              </p>
              <p className="flex justify-between pt-1">
                <span className="text-slate-500">🕒 الوقت:</span>
                <span className="font-mono text-xs font-semibold">{new Date(previousLog.counted_at).toLocaleString('fr-FR')}</span>
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                  editMode ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20' : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
                }`}
              >
                ✏️ تعديل
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                  !editMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                ➕ سطر جديد
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5 relative">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold text-slate-700">الباركود المقروء:</label>
              {searching && <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md animate-pulse">جاري الفحص...</span>}
            </div>
            <input
              type="text"
              required
              placeholder="امسح بالكاميرا أو اكتب الكود"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl font-mono text-indigo-700 font-bold text-base focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">اسم المنتج (Article):</label>
            <input
              type="text"
              required
              placeholder="اسم السلعة"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 text-base font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">موقع السلعة (Emplacement):</label>
            <input
              type="text"
              required
              placeholder="مثلاً: المخزن 1 - الرف B2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 text-base font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {editMode ? 'الكمية الجديدة (تعديل):' : 'الكمية المحسوبة:'}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((prev) => Math.max(0, (parseFloat(prev) || 1) - 1).toString())}
                className="w-14 h-14 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-2xl transition-colors cursor-pointer active:scale-95"
              >
                -
              </button>
              <input
                type="number"
                required
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1 px-4 py-3 bg-white border-2 border-indigo-100 rounded-2xl text-center text-2xl font-extrabold text-indigo-700 focus:border-indigo-500 outline-none shadow-inner"
              />
              <button
                type="button"
                onClick={() => setQuantity((prev) => ((parseFloat(prev) || 0) + 1).toString())}
                className="w-14 h-14 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 font-bold rounded-2xl text-2xl transition-colors cursor-pointer active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {successMessage && (
            <div className="absolute -top-16 left-0 right-0 bg-emerald-600 text-white text-sm p-4 rounded-2xl text-center font-bold shadow-lg shadow-emerald-500/30 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 text-white rounded-2xl font-bold text-lg shadow-lg transition-all cursor-pointer transform active:scale-[0.98] ${
              editMode
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                جاري الحفظ...
              </span>
            ) : editMode ? (
              'حفظ التعديلات ✏️'
            ) : (
              'تسجيل وإرسال 🚀'
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
