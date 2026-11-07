'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package, Barcode, Users, MapPin, Download, ScanLine, UserPlus, Search,
  Filter, Edit3, Trash2, Check, X, ShieldCheck, Activity, Layers, Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AppUser } from './lib/supabase';
import ReactBarcode from 'react-barcode';

interface InventoryLog {
  id: string;
  tenant_id: string;
  barcode: string;
  product_name: string;
  counted_quantity: number;
  location: string;
  counted_by_name: string;
  counted_at: string;
}

interface Product {
  id: string;
  tenant_id: string;
  barcode: string;
  name: string;
  category: string | null;
  default_location: string | null;
  system_quantity: number;
  purchase_price: number;
  sale_price: number;
}

interface Tenant {
  id: string;
  name: string;
  code: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  // Data
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  // State
  const [loading, setLoading] = useState(true);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState<'logs' | 'discrepancy' | 'management' | 'products'>('logs');

  // Pagination for products
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');

  // Inline Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editLocation, setEditLocation] = useState('');

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [userMsg, setUserMsg] = useState('');

  const [showTenantModal, setShowTenantModal] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantCode, setNewTenantCode] = useState('');
  const [tenantAdminUsername, setTenantAdminUsername] = useState('');
  const [tenantMsg, setTenantMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('stocki_user');
    if (!userStr) {
      router.push('/login');
      return;
    }
    const user = JSON.parse(userStr);
    setCurrentUser(user);

    if (user.role === 'auditor') {
      router.push('/scan');
      return;
    }

    if (user.role === 'admin') {
      setActiveTenantId(user.tenant_id);
    } else if (user.role === 'master') {
      fetchTenants();
    }
  }, [router]);

  const fetchTenants = async () => {
    const { data, error } = await supabase.from('tenants').select('*');
    if (!error && data) {
      setTenants(data);
      if (data.length > 0 && !activeTenantId) {
        setActiveTenantId(data[0].id);
      }
    }
  };

  const fetchData = async () => {
    if (!activeTenantId) return;

    setLoading(true);
    const [logsRes, productsRes] = await Promise.all([
      supabase.from('inventory_logs').select('*').eq('tenant_id', activeTenantId).order('counted_at', { ascending: false }),
      supabase.from('products').select('*').eq('tenant_id', activeTenantId)
    ]);

    if (!logsRes.error && logsRes.data) setLogs(logsRes.data);
    if (!productsRes.error && productsRes.data) setProducts(productsRes.data);

    setLoading(false);
  };

  useEffect(() => {
    if (activeTenantId) {
      fetchData();

      const channelLogs = supabase
        .channel('inventory_logs_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_logs', filter: `tenant_id=eq.${activeTenantId}` }, () => {
          fetchData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channelLogs);
      };
    }
  }, [activeTenantId]);

  // Download Template
  const handleDownloadTemplate = () => {
    const headers = ["الباركود", "اسم المنتج", "التصنيف", "الموقع الافتراضي", "الكمية الحالية", "سعر الشراء", "سعر البيع"];
    const data = [
      headers,
      ["123456789012", "منتج تجريبي 1", "أدوات", "A1", 10, 50, 100],
      ["987654321098", "منتج تجريبي 2", "أدوات", "B2", 20, 30, 60]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Stocki_Inventory_Template.xlsx");
  };

  // Import Excel
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTenantId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as Array<Array<string | number>>;

      if (data.length <= 1) return;

      const rows = data.slice(1).filter(row => row[0]); // Skip header, require barcode

      const upsertData = rows.map(row => ({
        tenant_id: activeTenantId,
        barcode: String(row[0]),
        name: row[1] || 'غير محدد',
        category: row[2] || null,
        default_location: row[3] || null,
        system_quantity: parseFloat(row[4]) || 0,
        purchase_price: parseFloat(row[5]) || 0,
        sale_price: parseFloat(row[6]) || 0,
      }));

      // Upsert to Supabase
      const { error } = await supabase.from('products').upsert(upsertData, { onConflict: 'tenant_id, barcode' });

      if (error) {
        alert("خطأ في الاستيراد: " + error.message);
      } else {
        alert(`تم استيراد ${upsertData.length} منتج بنجاح`);
        fetchData();
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg('');
    if (!newUsername || !newFullName || !activeTenantId) return;

    const { error } = await supabase.from('app_users').insert([
      {
        tenant_id: activeTenantId,
        username: newUsername.toLowerCase(),
        full_name: newFullName,
        must_set_password: true,
        role: 'auditor'
      }
    ]);

    if (error) {
      setUserMsg("خطأ: " + error.message);
    } else {
      setUserMsg("تم إضافة العامل بنجاح!");
      setNewUsername('');
      setNewFullName('');
      setTimeout(() => { setShowUserModal(false); setUserMsg(''); }, 1500);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setTenantMsg('');
    if (!newTenantName || !newTenantCode || !tenantAdminUsername) return;

    // First insert tenant
    const { data: tenantData, error: tenantErr } = await supabase.from('tenants').insert([
      { name: newTenantName, code: newTenantCode }
    ]).select().single();

    if (tenantErr || !tenantData) {
      setTenantMsg("خطأ في إنشاء المتجر: " + tenantErr?.message);
      return;
    }

    // Then insert admin user
    const { error: userErr } = await supabase.from('app_users').insert([
      {
        tenant_id: tenantData.id,
        username: tenantAdminUsername.toLowerCase(),
        full_name: `مدير ${newTenantName}`,
        must_set_password: true,
        role: 'admin'
      }
    ]);

    if (userErr) {
      setTenantMsg("تم إنشاء المتجر ولكن فشل إنشاء حساب المدير.");
    } else {
      setTenantMsg("تم إنشاء المتجر والمدير بنجاح!");
      setNewTenantName('');
      setNewTenantCode('');
      setTenantAdminUsername('');
      fetchTenants();
      setTimeout(() => { setShowTenantModal(false); setTenantMsg(''); }, 1500);
    }
  };

  // Discrepancy logic
  const discrepancyData = useMemo(() => {
    const grouped = new Map<string, { product: Product, counted: number }>();

    // Initialize with products
    products.forEach(p => {
      grouped.set(p.barcode, { product: p, counted: 0 });
    });

    // Add counts
    logs.forEach(l => {
      const existing = grouped.get(l.barcode);
      if (existing) {
        existing.counted += l.counted_quantity;
      } else {
        // Log without product
        grouped.set(l.barcode, {
          product: {
            id: 'temp', tenant_id: activeTenantId!, barcode: l.barcode, name: l.product_name,
            category: null, default_location: l.location, system_quantity: 0, purchase_price: 0, sale_price: 0
          },
          counted: l.counted_quantity
        });
      }
    });

    return Array.from(grouped.values()).map(item => {
      const diff = item.counted - item.product.system_quantity;
      return { ...item, diff };
    });
  }, [logs, products, activeTenantId]);

  if (!currentUser) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      {/* Top Navbar */}
      <header className="bg-indigo-600 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" /> Stocki Control
            </h1>

            {currentUser.role === 'master' && (
              <select
                value={activeTenantId || ''}
                onChange={(e) => setActiveTenantId(e.target.value)}
                className="bg-indigo-700 border border-indigo-500 rounded-lg px-3 py-1.5 text-sm outline-none"
              >
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{currentUser.full_name}</span>
            <Link href="/scan" className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm transition">
              الماسح 📱
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {currentUser.role === 'master' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-bold">إجمالي المتاجر</p>
                  <p className="text-2xl font-black text-slate-800">{tenants.length}</p>
                </div>
             </div>
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <button
                  onClick={() => setShowTenantModal(true)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-5 h-5" /> إضافة متجر جديد
                </button>
             </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 font-bold text-sm ${activeTab === 'logs' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>سجل الجرد</button>
          <button onClick={() => setActiveTab('discrepancy')} className={`px-4 py-2 font-bold text-sm ${activeTab === 'discrepancy' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>الفروقات (Écart)</button>
          <button onClick={() => setActiveTab('products')} className={`px-4 py-2 font-bold text-sm ${activeTab === 'products' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>قائمة المنتجات</button>
          <button onClick={() => setActiveTab('management')} className={`px-4 py-2 font-bold text-sm ${activeTab === 'management' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>الإدارة</button>
        </div>

        {activeTab === 'logs' && (
           <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="font-bold mb-4">سجل الجرد الميداني المباشر</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3">المنتج</th>
                      <th className="p-3">الباركود</th>
                      <th className="p-3">الكمية</th>
                      <th className="p-3">الموقع</th>
                      <th className="p-3">القائم بالجرد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-t border-slate-100">
                        <td className="p-3 font-bold">{log.product_name}</td>
                        <td className="p-3">{log.barcode}</td>
                        <td className="p-3"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-bold">{log.counted_quantity}</span></td>
                        <td className="p-3">{log.location}</td>
                        <td className="p-3">{log.counted_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        )}

        {activeTab === 'products' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="font-bold mb-4">قائمة المنتجات (Products List)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3">المنتج</th>
                    <th className="p-3">Code Article</th>
                    <th className="p-3">Code à barre</th>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3">الموقع</th>
                    <th className="p-3">كمية النظام</th>
                    <th className="p-3">سعر الشراء</th>
                    <th className="p-3">سعر البيع</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((product, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-3 font-bold">{product.name}</td>
                      <td className="p-3">{product.barcode}</td>
                      <td className="p-3">
                        <div className="bg-white p-2 inline-block rounded border border-slate-200">
                           <ReactBarcode value={product.barcode} width={1.5} height={40} displayValue={false} margin={0} />
                        </div>
                      </td>
                      <td className="p-3">{product.category || '-'}</td>
                      <td className="p-3">{product.default_location || '-'}</td>
                      <td className="p-3"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-bold">{product.system_quantity}</span></td>
                      <td className="p-3">{product.purchase_price}</td>
                      <td className="p-3">{product.sale_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {products.length > itemsPerPage && (
              <div className="flex justify-between items-center mt-4 border-t border-slate-100 pt-4">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg disabled:opacity-50 font-bold"
                >
                  السابق
                </button>
                <span className="text-sm font-bold text-slate-600">
                  صفحة {currentPage} من {Math.ceil(products.length / itemsPerPage)}
                </span>
                <button
                  disabled={currentPage === Math.ceil(products.length / itemsPerPage)}
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(products.length / itemsPerPage), p + 1))}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg disabled:opacity-50 font-bold"
                >
                  التالي
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'discrepancy' && (
           <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="font-bold mb-4">مقارنة المخزون (System vs Actual)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3">المنتج</th>
                      <th className="p-3">الباركود</th>
                      <th className="p-3">كمية النظام</th>
                      <th className="p-3">كمية الجرد</th>
                      <th className="p-3">الفرق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discrepancyData.map((d, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-3 font-bold">{d.product.name}</td>
                        <td className="p-3">{d.product.barcode}</td>
                        <td className="p-3">{d.product.system_quantity}</td>
                        <td className="p-3 font-bold">{d.counted}</td>
                        <td className="p-3">
                          {d.diff > 0 && <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-bold">+{d.diff} فائض</span>}
                          {d.diff < 0 && <span className="bg-red-100 text-red-700 px-2 py-1 rounded-lg font-bold">{d.diff} عجز</span>}
                          {d.diff === 0 && <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg font-bold">0 متطابق</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        )}

        {activeTab === 'management' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="font-bold mb-4">أدوات إكسيل (Excel)</h3>
              <div className="space-y-4">
                <button onClick={handleDownloadTemplate} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> تحميل القالب (Template)
                </button>
                <div className="border border-dashed border-slate-300 p-4 rounded-xl text-center relative hover:bg-slate-50 transition">
                  <Upload className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-bold text-slate-600">استيراد المنتجات من إكسيل</p>
                  <input
                    type="file"
                    accept=".xlsx, .csv"
                    onChange={handleImportExcel}
                    ref={fileInputRef}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="font-bold mb-4">إنشاء حساب عامل جرد</h3>
              <form onSubmit={handleCreateWorker} className="space-y-3">
                <input
                  type="text"
                  placeholder="اسم المستخدم (مثال: omar)"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full border px-3 py-2 rounded-xl outline-none"
                  required
                />
                <input
                  type="text"
                  placeholder="الاسم الكامل"
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  className="w-full border px-3 py-2 rounded-xl outline-none"
                  required
                />
                {userMsg && <p className="text-sm text-indigo-600 font-bold">{userMsg}</p>}
                <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold">
                  إنشاء الحساب
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Tenant Modal */}
      {showTenantModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">إضافة متجر جديد</h3>
            <form onSubmit={handleCreateTenant} className="space-y-3">
              <input type="text" placeholder="اسم المتجر" value={newTenantName} onChange={e => setNewTenantName(e.target.value)} className="w-full border px-3 py-2 rounded-xl" required />
              <input type="text" placeholder="كود المتجر (مثال: SH-01)" value={newTenantCode} onChange={e => setNewTenantCode(e.target.value)} className="w-full border px-3 py-2 rounded-xl" required />
              <input type="text" placeholder="اسم حساب مدير المتجر" value={tenantAdminUsername} onChange={e => setTenantAdminUsername(e.target.value)} className="w-full border px-3 py-2 rounded-xl" required />
              {tenantMsg && <p className="text-sm font-bold text-indigo-600">{tenantMsg}</p>}
              <div className="flex gap-2 mt-4">
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold">حفظ</button>
                <button type="button" onClick={() => setShowTenantModal(false)} className="flex-1 py-2 bg-slate-100 rounded-xl font-bold">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
