'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from './lib/supabase';
import Link from 'next/link';
import {
  Package,
  Barcode,
  Users,
  MapPin,
  Download,
  ScanLine,
  UserPlus,
  Search,
  Filter,
  Edit3,
  Trash2,
  Check,
  X,
  ShieldCheck,
  Activity,
  Layers,
} from 'lucide-react';

interface InventoryLog {
  id: string;
  barcode: string;
  product_name: string;
  counted_quantity: number;
  location: string;
  counted_by_name: string;
  counted_at: string;
}

export default function Dashboard() {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  // الفلاتر والبحث
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');

  // التعديل المباشر
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editLocation, setEditLocation] = useState('');

  // إضافة عامل جديد
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [userMsg, setUserMsg] = useState('');

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('inventory_logs')
      .select('*')
      .order('counted_at', { ascending: false });

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('inventory_logs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_logs' },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const workersList = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.counted_by_name).filter(Boolean)));
  }, [logs]);

  const locationsList = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.location || 'غير محدد')));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.barcode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesWorker = selectedWorker === 'all' || log.counted_by_name === selectedWorker;
      const matchesLocation =
        selectedLocation === 'all' || (log.location || 'غير محدد') === selectedLocation;

      return matchesSearch && matchesWorker && matchesLocation;
    });
  }, [logs, searchQuery, selectedWorker, selectedLocation]);

  const totalItems = filteredLogs.length;
  const totalQuantity = filteredLogs.reduce((sum, item) => sum + Number(item.counted_quantity || 0), 0);

  const startEdit = (log: InventoryLog) => {
    setEditingId(log.id);
    setEditName(log.product_name);
    setEditQty(String(log.counted_quantity));
    setEditLocation(log.location || '');
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from('inventory_logs')
      .update({
        product_name: editName,
        counted_quantity: parseFloat(editQty),
        location: editLocation,
      })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      fetchLogs();
    } else {
      alert('خطأ في التعديل: ' + error.message);
    }
  };

  const deleteLog = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف "${name}" من سجل الجرد؟`)) return;
    const { error } = await supabase.from('inventory_logs').delete().eq('id', id);
    if (!error) fetchLogs();
  };

  const exportToExcel = () => {
    if (filteredLogs.length === 0) {
      alert('لا توجد بيانات لتصديرها');
      return;
    }

    const headers = ['الباركود', 'اسم المنتج', 'الكمية المحسوبة', 'الموقع', 'القائم بالجرد', 'التاريخ والوقت'];
    const rows = filteredLogs.map((log) => [
      `"${log.barcode}"`,
      `"${log.product_name}"`,
      log.counted_quantity,
      `"${log.location || 'غير محدد'}"`,
      `"${log.counted_by_name}"`,
      `"${new Date(log.counted_at).toLocaleString('fr-FR')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventaire_stocki_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newFullName) return;

    const { error } = await supabase.from('app_users').insert([
      {
        username: newUsername.trim().toLowerCase(),
        full_name: newFullName.trim(),
        password: null,
        must_set_password: true,
      },
    ]);

    if (error) {
      alert('خطأ أو اسم الحساب موجود مسبقاً: ' + error.message);
    } else {
      setUserMsg(`تم إنشاء حساب "${newFullName}" بنجاح! سيُطلب منه تعيين كلمة المرور عند أول دخول.`);
      setNewUsername('');
      setNewFullName('');
      setTimeout(() => setUserMsg(''), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Stocki
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  مباشر
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">المنصة الذكية للجرد الميداني ومراقبة المخزون</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowUserModal(!showUserModal)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">إضافة عامل</span>
            </button>

            <button
              onClick={exportToExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">تصدير Excel</span>
            </button>

            <Link
              href="/scan"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition"
            >
              <ScanLine className="w-4 h-4" />
              <span>شاشة السكان</span>
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              <span className="hidden md:inline">دخول العمال</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* نافذة إضافة عامل جديد */}
        {showUserModal && (
          <div className="bg-white rounded-2xl p-6 shadow-md border border-indigo-100 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">إنشاء حساب عامل جرد (Première connexion)</h2>
                  <p className="text-xs text-slate-500">يتم إنشاء الحساب بدون كلمة مرور، ويعينها العامل بنفسه عند أول دخول</p>
                </div>
              </div>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">اسم المستخدم (Username)</label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: mohamed"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">الاسم الكامل للعامل</label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: محمد أمين"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition cursor-pointer"
              >
                + تفعيل وإنشاء الحساب
              </button>
            </form>
            {userMsg && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                {userMsg}
              </div>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500">إجمالي السلع المجرودة</p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">{totalItems}</p>
              <span className="text-[11px] text-slate-400 font-medium">سطر جرد مسجل</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500">مجموع الكميات المحسوبة</p>
              <p className="text-3xl font-extrabold text-indigo-600 mt-1">{totalQuantity}</p>
              <span className="text-[11px] text-slate-400 font-medium">إجمالي القطع في المخزن</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500">القائمون بالجرد</p>
              <p className="text-3xl font-extrabold text-emerald-600 mt-1">{workersList.length}</p>
              <span className="text-[11px] text-slate-400 font-medium">أعضاء الفريق النشطين</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500">المواقع والرفوف</p>
              <p className="text-3xl font-extrabold text-amber-600 mt-1">{locationsList.length}</p>
              <span className="text-[11px] text-slate-400 font-medium">مناطق التخزين المجرودة</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث باسم السلعة أو رقم الباركود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">كل العمال ({workersList.length})</option>
              {workersList.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">كل المواقع ({locationsList.length})</option>
              {locationsList.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-base">سجل الجرد الميداني المباشر</h3>
            <span className="text-xs text-slate-400 font-medium">يتحدث تلقائياً عند كل عملية سكان</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 text-xs font-bold uppercase border-b border-slate-200/80">
                  <th className="py-3.5 px-6">المنتج (Article)</th>
                  <th className="py-3.5 px-6">الباركود</th>
                  <th className="py-3.5 px-6">الكمية</th>
                  <th className="py-3.5 px-6">الموقع (Emplacement)</th>
                  <th className="py-3.5 px-6">القائم بالجرد</th>
                  <th className="py-3.5 px-6">التوقيت</th>
                  <th className="py-3.5 px-6 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                      جاري مزامنة بيانات الجرد...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400">
                      لا توجد سجلات مطابقة حالياً.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const dateObj = new Date(log.counted_at);
                    const isEditing = editingId === log.id;

                    return (
                      <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="py-4 px-6 font-bold text-slate-900">
                          {isEditing ? (
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="border border-indigo-300 px-3 py-1.5 rounded-xl w-full text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          ) : (
                            log.product_name
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            {log.barcode}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              className="border border-indigo-300 px-2 py-1.5 rounded-xl w-20 text-center font-bold outline-none"
                            />
                          ) : (
                            <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 font-extrabold px-3.5 py-1 rounded-xl text-sm border border-indigo-100">
                              {log.counted_quantity}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {isEditing ? (
                            <input
                              value={editLocation}
                              onChange={(e) => setEditLocation(e.target.value)}
                              className="border border-indigo-300 px-3 py-1.5 rounded-xl w-full text-sm outline-none"
                            />
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-50/80 text-amber-800 border border-amber-200/80 px-2.5 py-1 rounded-lg text-xs font-bold">
                              <MapPin className="w-3 h-3 text-amber-600" />
                              {log.location || 'غير محدد'}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                              {log.counted_by_name ? log.counted_by_name.charAt(0) : '؟'}
                            </div>
                            <span className="font-bold text-slate-700">{log.counted_by_name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-500 font-mono text-xs">
                          <div>{dateObj.toLocaleDateString('fr-FR')}</div>
                          <div className="text-[11px] text-slate-400">{dateObj.toLocaleTimeString('fr-FR')}</div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => saveEdit(log.id)}
                                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                                title="حفظ"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 cursor-pointer"
                                title="إلغاء"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => startEdit(log)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="تعديل"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteLog(log.id, log.product_name)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
