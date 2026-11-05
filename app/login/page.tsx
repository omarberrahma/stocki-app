'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'username' | 'password' | 'first_login'>('username');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userRecord, setUserRecord] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheckUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUser = username.trim().toLowerCase();
    const { data, error: dbErr } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', cleanUser)
      .maybeSingle();

    setLoading(false);

    if (dbErr || !data) {
      setError('اسم الحساب غير موجود. اطلب من الأدمن إنشاء حسابك أولاً.');
      return;
    }

    setUserRecord(data);
    if (data.must_set_password || !data.password) {
      setStep('first_login');
    } else {
      setStep('password');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== userRecord.password) {
      setError('كلمة المرور غير صحيحة');
      return;
    }
    localStorage.setItem('stocki_user', JSON.stringify(userRecord));
    localStorage.setItem('stocki_counter_name', userRecord.full_name);
    router.push('/scan');
  };

  const handleCreateFirstPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setError('كلمة المرور يجب أن تكون 4 أحرف أو أرقام على الأقل');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setLoading(true);
    const { data, error: updateErr } = await supabase
      .from('app_users')
      .update({ password: password, must_set_password: false })
      .eq('id', userRecord.id)
      .select()
      .single();

    setLoading(false);

    if (updateErr) {
      setError('حدث خطأ أثناء حفظ كلمة المرور');
      return;
    }

    localStorage.setItem('stocki_user', JSON.stringify(data));
    localStorage.setItem('stocki_counter_name', data.full_name);
    router.push('/scan');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-slate-100 flex flex-col items-center justify-center p-6 font-sans" dir="rtl">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-slate-100/60 p-8 sm:p-10 backdrop-blur-xl">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white font-bold text-3xl transform transition-transform hover:scale-105">
              🛡️
            </div>
          </div>

          {step === 'username' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">تسجيل الدخول - Stocki</h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">أدخل اسم الحساب الخاص بك للمتابعة</p>
              </div>
              <form onSubmit={handleCheckUsername} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">اسم المستخدم (Username):</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="مثلاً: omar أو mohamed"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200"
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-red-600 font-bold bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>جاري التحقق...</span>
                    </>
                  ) : (
                    'متابعة'
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'first_login' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Première connexion</h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">
                  مرحباً <span className="font-bold text-indigo-600">{userRecord?.full_name}</span>، قم بإنشاء كلمة المرور لتأمين حسابك.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-4 mb-8 text-sm leading-relaxed shadow-sm">
                <p className="font-bold flex items-center gap-2">
                  <span className="text-blue-500">ℹ️</span>
                  تم إنشاء حسابك بدون كلمة مرور
                </p>
                <p className="text-blue-800 mt-1 pl-6">يرجى تعيين كلمة مرور خاصة بك الآن قبل البدء في الجرد.</p>
              </div>

              <form onSubmit={handleCreateFirstPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور الجديدة:</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">تأكيد كلمة المرور:</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200"
                  />
                </div>
                {error && <p className="text-sm text-red-600 font-bold bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-500/25 transition-all duration-200 cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    'حفظ كلمة المرور والدخول'
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'password' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 mb-4">
                  <span className="text-2xl font-bold text-indigo-600">
                    {userRecord?.full_name?.charAt(0) || '👤'}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">مرحباً {userRecord?.full_name}</h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">أدخل كلمة المرور الخاصة بك</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور:</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200"
                  />
                </div>
                {error && <p className="text-sm text-red-600 font-bold bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-500/25 transition-all duration-200 cursor-pointer"
                >
                  تسجيل الدخول
                </button>
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => { setStep('username'); setPassword(''); setError(''); }}
                    className="inline-flex items-center justify-center gap-1 py-2 px-4 text-sm font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    تغيير الحساب
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-400 font-medium">نظام الجرد والمخزون الذكي - Stocki © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
