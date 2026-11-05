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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 w-full max-w-md p-8">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md text-white font-bold text-2xl">
            🛡️
          </div>
        </div>

        {step === 'username' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">تسجيل الدخول - Stocki</h2>
              <p className="text-slate-500 text-sm mt-1">أدخل اسم الحساب الخاص بك للمتابعة</p>
            </div>
            <form onSubmit={handleCheckUsername} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم المستخدم (Username):</label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: omar أو mohamed"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer"
              >
                {loading ? 'جاري التحقق...' : 'متابعة'}
              </button>
            </form>
          </>
        )}

        {step === 'first_login' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Première connexion</h2>
              <p className="text-slate-500 text-sm mt-1">
                مرحباً <span className="font-bold text-slate-800">{userRecord?.full_name}</span>، قم بإنشاء كلمة المرور لتأمين حسابك.
              </p>
            </div>

            <div className="bg-sky-50 border border-sky-300 text-sky-900 rounded-xl p-3.5 mb-6 text-xs leading-relaxed">
              <p className="font-bold">تم إنشاء حسابك بدون كلمة مرور (Sans mot de passe).</p>
              <p className="text-sky-800 mt-0.5">يرجى تعيين كلمة مرور خاصة بك الآن قبل البدء في الجرد.</p>
            </div>

            <form onSubmit={handleCreateFirstPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">كلمة المرور الجديدة:</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">تأكيد كلمة المرور:</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer"
              >
                {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور والدخول'}
              </button>
            </form>
          </>
        )}

        {step === 'password' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">مرحباً {userRecord?.full_name}</h2>
              <p className="text-slate-500 text-xs mt-1">أدخل كلمة المرور الخاصة بك</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">كلمة المرور:</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer"
              >
                دخول
              </button>
              <button
                type="button"
                onClick={() => { setStep('username'); setPassword(''); setError(''); }}
                className="w-full py-2 text-xs text-slate-500 hover:underline cursor-pointer"
              >
                تغيير الحساب
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
