import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { useAuth } from '../App';

const emptyForm = { email: '', username: '', displayName: '', password: '', canManageAdmins: false };

export default function AdminAccounts() {
  const { profile } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAdmins = useCallback(async () => {
    try {
      const { admins: list } = await apiFetch('/admin/accounts');
      setAdmins(list ?? []);
    } catch (err) {
      setError(err.message || 'Hindi ma-load ang mga account ng admin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.can_manage_admins) loadAdmins();
    else setLoading(false);
  }, [profile?.can_manage_admins, loadAdmins]);

  async function createAdmin(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await apiFetch('/admin/accounts', { method: 'POST', body: form });
      setForm(emptyForm);
      setNotice('Nagawa na ang account ng admin. Ibahagi sa may-ari ang panimulang password sa ligtas na paraan.');
      await loadAdmins();
    } catch (err) {
      setError(err.message || 'Hindi magawa ang account ng admin.');
    } finally {
      setSaving(false);
    }
  }

  if (!profile?.can_manage_admins) {
    return <div className="panel"><h1>Mga account ng admin</h1><p>Wala kang pahintulot na mamahala ng mga account ng admin.</p></div>;
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Mga account ng admin</h1>
          <p className="muted">Gumawa ng account ng admin at magbigay ng superadmin access kung kailangan.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <section className="panel stack">
        <h2>Gumawa ng account ng admin</h2>
        <form className="stack" onSubmit={createAdmin}>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
          </label>
          <label className="field">
            <span>Username</span>
            <input className="input" autoComplete="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_.-]+" value={form.username} onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))} />
          </label>
          <label className="field">
            <span>Ipinapakitang pangalan</span>
            <input className="input" required maxLength={60} value={form.displayName} onChange={(e) => setForm((v) => ({ ...v, displayName: e.target.value }))} />
          </label>
          <label className="field">
            <span>Panimulang password (hindi bababa sa 12 character)</span>
            <input className="input" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} />
          </label>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={form.canManageAdmins} onChange={(e) => setForm((v) => ({ ...v, canManageAdmins: e.target.checked }))} />
            <span>Bigyan ng superadmin access para gumawa at magpahintulot ng iba pang admin</span>
          </label>
          <div><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Gumawa ng account ng admin'}</button></div>
        </form>
      </section>

      <section className="panel stack">
        <h2>Mga admin</h2>
        {loading ? <p>Loading accounts…</p> : admins.length === 0 ? <p>Walang nahanap na account ng admin.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Pahintulot</th><th>Created</th></tr></thead>
              <tbody>{admins.map((admin) => (
                <tr key={admin.id}>
                  <td>{admin.display_name}</td>
                  <td>{admin.username}</td>
                  <td>{admin.email}</td>
                  <td>{admin.can_manage_admins ? 'Superadmin' : 'Admin'}</td>
                  <td>{new Date(admin.created_at).toLocaleDateString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
