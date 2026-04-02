import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    getGroup, getSummary, getExpenses, getMembers,
    addMember, removeMember, getEligibleFriends,
    createExpense, createDebits, resetGroup, deleteGroup
} from '../api';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'];

// ─── Modal Overlay ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px',
        }}>
            <div className="glass-card" style={{
                maxWidth: '520px', width: '100%', padding: '30px',
                maxHeight: '85vh', overflowY: 'auto',
            }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 10px' }}>✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}

export default function GroupUI() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [selectedMemberId, setSelectedMemberId] = useState(null);

    // Modal visibility
    const [showAddMember, setShowAddMember] = useState(false);
    const [showExpenseSplit, setShowExpenseSplit] = useState(false);
    const [showDeposit, setShowDeposit] = useState(false);
    const [showSummarize, setShowSummarize] = useState(false);

    // Add Member state
    const [eligibleFriends, setEligibleFriends] = useState([]);

    // Expense Split state
    const [expPayerId, setExpPayerId] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expDesc, setExpDesc] = useState('');
    const [splitMode, setSplitMode] = useState('equal');
    const [customShares, setCustomShares] = useState({});

    // Deposit state
    const [depMemberId, setDepMemberId] = useState('');
    const [depAmount, setDepAmount] = useState('');
    const [depNote, setDepNote] = useState('');
    const [depDate, setDepDate] = useState('');

    // Summarize state
    const [summaryData, setSummaryData] = useState(null);
    const [resetDone, setResetDone] = useState(false);

    const [actionError, setActionError] = useState('');

    useEffect(() => { loadData(); }, [id]);

    const loadData = async () => {
        try {
            const [gRes, eRes, mRes] = await Promise.all([
                getGroup(id), getExpenses(id), getMembers(id)
            ]);
            setGroup(gRes.data);
            setExpenses(eRes.data);
            setMembers(mRes.data.map(m => m.user));
        } catch (err) {
            console.error(err);
        }
    };

    if (!group) return <div className="container mt-4 text-center">Loading Group Data...</div>;

    const isOwner = group.created_by === user?.id;

    // ─── Stats per member ─────────────────────────────────────────────────────
    const getMemberStats = (memberId) => {
        const deposited = expenses
            .filter(e => e.paid_by === memberId)
            .reduce((sum, e) => sum + e.amount, 0);

        const debts = {};
        expenses.forEach(e => {
            if (e.paid_by !== memberId) {
                const myShare = e.shares.find(s => s.debtor_id === memberId);
                if (myShare) {
                    debts[e.paid_by_user.username] = (debts[e.paid_by_user.username] || 0) + myShare.share_amount;
                }
            }
        });
        const debtsList = Object.keys(debts).map(name => ({ name, amount: debts[name] }));
        return { deposited, debtsList };
    };

    // ─── Add Member ───────────────────────────────────────────────────────────
    const openAddMember = async () => {
        const res = await getEligibleFriends(id);
        setEligibleFriends(res.data);
        setShowAddMember(true);
    };

    const handleAddMember = async (userId) => {
        try {
            await addMember(id, { user_id: userId });
            setEligibleFriends(prev => prev.filter(f => f.id !== userId));
            await loadData();
        } catch (err) {
            setActionError(err.response?.data?.detail || 'Failed to add member');
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm('Remove this member from the group?')) return;
        try {
            await removeMember(id, userId);
            await loadData();
        } catch (err) {
            setActionError(err.response?.data?.detail || 'Failed to remove member');
        }
    };

    // ─── Expense Split ────────────────────────────────────────────────────────
    const openExpenseSplit = () => {
        setExpPayerId(String(user.id));
        setExpAmount('');
        setExpDesc('');
        setSplitMode('equal');
        setCustomShares({});
        setActionError('');
        setShowExpenseSplit(true);
    };

    const getCustomTotal = () =>
        Object.values(customShares).reduce((s, v) => s + (parseFloat(v) || 0), 0);

    const handleExpenseSubmit = async (e) => {
        e.preventDefault();
        setActionError('');
        const amount = parseFloat(expAmount);
        if (!amount || amount <= 0) { setActionError('Enter a valid amount'); return; }

        const payload = {
            paid_by: parseInt(expPayerId),
            amount,
            description: expDesc,
            split_mode: splitMode,
        };

        if (splitMode === 'custom') {
            const customTotal = getCustomTotal();
            if (customTotal > amount) {
                setActionError(`Assigned amounts (${customTotal.toFixed(2)}) exceed total (${amount.toFixed(2)})`);
                return;
            }
            const custom_shares = Object.entries(customShares)
                .filter(([, v]) => v !== '' && parseFloat(v) > 0)
                .map(([debtor_id, share_amount]) => ({
                    debtor_id: parseInt(debtor_id),
                    share_amount: parseFloat(share_amount),
                }));
            payload.custom_shares = custom_shares;
        }

        try {
            await createExpense(id, payload);
            setShowExpenseSplit(false);
            await loadData();
        } catch (err) {
            setActionError(err.response?.data?.detail || 'Failed to create expense');
        }
    };

    // ─── Deposit ──────────────────────────────────────────────────────────────
    const openDeposit = () => {
        setDepMemberId(String(user.id));
        setDepAmount('');
        setDepNote('');
        setDepDate('');
        setActionError('');
        setShowDeposit(true);
    };

    const handleDepositSubmit = async (e) => {
        e.preventDefault();
        setActionError('');
        const amount = parseFloat(depAmount);
        if (!amount || amount <= 0) { setActionError('Enter a valid deposit amount'); return; }
        try {
            const payload = {
                entries: [{ debtor_id: parseInt(depMemberId), amount }],
                reason: depNote || 'Deposit',
            };
            if (depDate) {
                payload.custom_date = new Date(depDate).toISOString();
            }
            await createDebits(id, payload);
            setShowDeposit(false);
            await loadData();
        } catch (err) {
            setActionError(err.response?.data?.detail || 'Failed to record deposit');
        }
    };

    // ─── Summarize & Reset ────────────────────────────────────────────────────
    const openSummarize = async () => {
        setSummaryData(null);
        setResetDone(false);
        setActionError('');
        try {
            // Call reset which returns final balances before clearing
            const res = await resetGroup(id);
            setSummaryData(res.data);
            setResetDone(true);
            await loadData();
        } catch (err) {
            setActionError(err.response?.data?.detail || 'Failed to summarize');
        }
        setShowSummarize(true);
    };

    const handleDeleteGroup = async () => {
        if (!window.confirm('Delete this group FOREVER? All expenses and tracking will be lost.')) return;
        try {
            await deleteGroup(id);
            navigate('/dashboard');
        } catch (err) {
            alert('Failed to delete group');
        }
    };

    // ─── Render member block (small card) ─────────────────────────────────────
    const renderMemberBlock = (member, index, isEnlarged = false) => {
        const color = COLORS[index % COLORS.length];
        const stats = getMemberStats(member.id);
        const isThisOwner = member.id === group.created_by;

        if (isEnlarged) {
            return (
                <div key={`enl-${member.id}`} className="glass-card" style={{ flex: 1, border: `3px solid ${color}`, padding: '30px', animation: 'fadeIn 0.3s' }}>
                    <div className="flex gap-4 items-center mb-4">
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff', fontWeight: 'bold' }}>
                            {member.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2>{member.username}</h2>
                            <h3 className="text-muted" style={{ margin: 0 }}>Paid: ${stats.deposited.toFixed(2)}</h3>
                        </div>
                        <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setSelectedMemberId(null)}>Close</button>
                    </div>

                    <h4>Owes:</h4>
                    {stats.debtsList.length === 0 ? <p className="text-muted">No debts! 🎉</p> : (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {stats.debtsList.map((d, i) => (
                                <li key={i} className="flex justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                    <span>Owes {d.name}</span>
                                    <span className="text-danger">${d.amount.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <h4 style={{ marginTop: '24px' }}>Balance Bar</h4>
                    <div style={{ width: '100%', height: '30px', borderRadius: '5px', display: 'flex', overflow: 'hidden', background: '#333' }}>
                        {stats.deposited === 0 && stats.debtsList.length === 0 ? (
                            <div style={{ width: '100%', background: '#444', textAlign: 'center', fontSize: '0.8rem', lineHeight: '30px', color: '#aaa' }}>No Activity</div>
                        ) : (
                            <>
                                <div style={{ width: `${Math.min(100, (stats.deposited / (stats.deposited + stats.debtsList.reduce((acc, d) => acc + d.amount, 0) || 1)) * 100)}%`, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'white' }}>
                                    {stats.deposited > 0 ? 'Paid' : ''}
                                </div>
                                <div style={{ flex: 1, background: '#ff4d4d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'white' }}>
                                    Owes
                                </div>
                            </>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div key={`blk-${member.id}`} style={{ position: 'relative' }}>
                {isOwner && !isThisOwner && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.id); }}
                        title="Remove member"
                        style={{
                            position: 'absolute', top: '8px', right: '8px',
                            background: 'rgba(255,77,77,0.8)', border: 'none',
                            borderRadius: '50%', width: '22px', height: '22px',
                            cursor: 'pointer', color: '#fff', fontSize: '0.8rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 10, lineHeight: 1,
                        }}
                    >✕</button>
                )}
                <div
                    onClick={() => setSelectedMemberId(member.id)}
                    style={{
                        background: 'var(--bg-card)',
                        borderTop: `5px solid ${color}`,
                        borderRadius: '10px',
                        padding: '20px',
                        width: '220px',
                        boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        textAlign: 'center',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: color, margin: '0 auto 10px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>
                        {member.username.charAt(0).toUpperCase()}
                    </div>
                    <h3>{member.username}</h3>
                    <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '10px' }}>
                        {isThisOwner ? <span className="role-badge role-badge--admin">Owner</span> : <span className="role-badge role-badge--user">Member</span>}
                    </p>
                    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: '10px' }}>
                        <strong style={{ display: 'block', fontSize: '1.2rem', color: 'var(--secondary)' }}>${stats.deposited.toFixed(2)}</strong>
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>Paid</span>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <strong style={{ fontSize: '0.85rem' }}>Owes:</strong>
                        {stats.debtsList.length === 0 ? <p className="text-muted" style={{ fontSize: '0.85rem', margin: '5px 0' }}>Nothing! 🎉</p> : (
                            <ul style={{ listStyle: 'none', padding: 0, margin: '5px 0', fontSize: '0.85rem' }}>
                                {stats.debtsList.map((d, i) => (
                                    <li key={i} className="flex justify-between text-danger">
                                        <span>{d.name.length > 8 ? d.name.substring(0, 8) + '..' : d.name}</span>
                                        <span>${d.amount.toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const selectedMember = members.find(m => m.id === selectedMemberId);
    const debtors = members.filter(m => m.id !== parseInt(expPayerId));

    return (
        <div className="container mt-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: 0 }}>
                        {group.name}
                        {isOwner && <span className="role-badge role-badge--admin" style={{ fontSize: '0.8rem' }}>Managed by you</span>}
                    </h1>
                    {group.description && <p className="text-muted" style={{ marginTop: '5px', marginBottom: 0 }}>{group.description}</p>}
                </div>
                <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>← Dashboard</button>
            </div>

            {/* Owner action bar */}
            {isOwner && (
                <div className="glass-card mb-4" style={{ padding: '16px 24px' }}>
                    <div className="flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 600, marginRight: '4px' }}>Owner Actions:</span>
                        <button className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.9rem' }} onClick={openAddMember}>
                            ➕ Add Member
                        </button>
                        <button className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.9rem', background: 'linear-gradient(135deg, #4ECDC4, #2eaf8f)' }} onClick={openExpenseSplit}>
                            💸 Expense Split
                        </button>
                        <button className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.9rem', background: 'linear-gradient(135deg, #45B7D1, #2980b9)' }} onClick={openDeposit}>
                            💰 Deposit
                        </button>
                        <button className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.9rem', background: 'linear-gradient(135deg, #9B59B6, #6c3483)' }} onClick={openSummarize}>
                            📊 Summarize
                        </button>
                        <button className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.9rem', background: 'linear-gradient(135deg, #E74C3C, #C0392B)', marginLeft: 'auto' }} onClick={handleDeleteGroup}>
                            🗑 Delete Group
                        </button>
                    </div>
                </div>
            )}

            {/* Member blocks */}
            {selectedMemberId ? (
                <div style={{ marginTop: '24px' }}>
                    {renderMemberBlock(selectedMember, members.indexOf(selectedMember), true)}
                </div>
            ) : (
                <div className="flex gap-4" style={{ flexWrap: 'wrap', marginTop: '24px' }}>
                    {members.map((m, idx) => renderMemberBlock(m, idx, false))}
                </div>
            )}

            {/* Recent expenses */}
            {expenses.length > 0 && (
                <div className="glass-card mt-4" style={{ marginTop: '30px' }}>
                    <h3>Recent Expenses</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 12px' }}>Paid By</th>
                                    <th style={{ padding: '8px 12px' }}>Amount</th>
                                    <th style={{ padding: '8px 12px' }}>Description</th>
                                    <th style={{ padding: '8px 12px' }}>Split</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.slice(0, 10).map(exp => (
                                    <tr key={exp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '8px 12px' }}>{exp.paid_by_user.username}</td>
                                        <td style={{ padding: '8px 12px', color: 'var(--secondary)' }}>${exp.amount.toFixed(2)}</td>
                                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{exp.description || '—'}</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <span className={`role-badge role-badge--${exp.split_mode === 'equal' ? 'user' : 'admin'}`}>
                                                {exp.split_mode}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── Modals ─────────────────────────────────────────────────── */}

            {/* Add Member Modal */}
            {showAddMember && (
                <Modal title="➕ Add Member" onClose={() => setShowAddMember(false)}>
                    {eligibleFriends.length === 0 ? (
                        <p className="text-muted">No eligible friends to add. Make friends first or they're all already here!</p>
                    ) : (
                        <div>
                            {eligibleFriends.map(f => (
                                <div key={f.id} className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                    <span><strong>{f.username}</strong></span>
                                    <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: '0.85rem' }} onClick={() => handleAddMember(f.id)}>
                                        Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {actionError && <p className="text-danger" style={{ marginTop: '12px' }}>{actionError}</p>}
                </Modal>
            )}

            {/* Expense Split Modal */}
            {showExpenseSplit && (
                <Modal title="💸 Expense Split" onClose={() => setShowExpenseSplit(false)}>
                    <form onSubmit={handleExpenseSubmit}>
                        <div className="form-group">
                            <label>Who Paid?</label>
                            <select className="form-control" value={expPayerId} onChange={e => { setExpPayerId(e.target.value); setCustomShares({}); }}>
                                {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Total Amount</label>
                            <input type="number" step="0.01" min="0.01" className="form-control" placeholder="e.g. 1000" value={expAmount} onChange={e => { setExpAmount(e.target.value); setCustomShares({}); }} required />
                        </div>
                        <div className="form-group">
                            <label>Description (optional)</label>
                            <input type="text" className="form-control" placeholder="e.g. Dinner at café" value={expDesc} onChange={e => setExpDesc(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Split Mode</label>
                            <div className="flex gap-4" style={{ marginTop: '6px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="radio" value="equal" checked={splitMode === 'equal'} onChange={() => { setSplitMode('equal'); setCustomShares({}); }} />
                                    Equal among all members
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="radio" value="custom" checked={splitMode === 'custom'} onChange={() => setSplitMode('custom')} />
                                    Custom
                                </label>
                            </div>
                        </div>

                        {splitMode === 'equal' && expAmount && (
                            <div className="glass-card" style={{ padding: '12px', marginBottom: '12px', background: 'rgba(78,205,196,0.1)' }}>
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                    Each of <strong>{members.length}</strong> members owes:{' '}
                                    <strong style={{ color: 'var(--secondary)' }}>${(parseFloat(expAmount) / members.length).toFixed(2)}</strong>
                                    {' '}(except the payer)
                                </p>
                            </div>
                        )}

                        {splitMode === 'custom' && (
                            <div>
                                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
                                    Set amounts for specific members. Leave blank = equal share of the remaining.
                                </p>
                                {debtors.map(m => (
                                    <div key={m.id} className="flex items-center gap-4" style={{ marginBottom: '10px' }}>
                                        <label style={{ flex: 1, fontWeight: 500 }}>{m.username}</label>
                                        <input
                                            type="number" step="0.01" min="0" placeholder="auto"
                                            className="form-control" style={{ maxWidth: '150px' }}
                                            value={customShares[m.id] ?? ''}
                                            onChange={e => setCustomShares(prev => ({ ...prev, [m.id]: e.target.value }))}
                                        />
                                    </div>
                                ))}
                                {expAmount && (
                                    <div style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', marginBottom: '12px' }}>
                                        <div className="flex justify-between" style={{ fontSize: '0.9rem' }}>
                                            <span>Total:</span><strong>${parseFloat(expAmount || 0).toFixed(2)}</strong>
                                        </div>
                                        <div className="flex justify-between" style={{ fontSize: '0.9rem' }}>
                                            <span>Manually assigned:</span><strong>${getCustomTotal().toFixed(2)}</strong>
                                        </div>
                                        <div className="flex justify-between" style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>
                                            <span>Remaining (auto-split):</span>
                                            <strong>${Math.max(0, parseFloat(expAmount || 0) - getCustomTotal()).toFixed(2)}</strong>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {actionError && <p className="text-danger">{actionError}</p>}
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                            Confirm Expense
                        </button>
                    </form>
                </Modal>
            )}

            {/* Deposit Modal */}
            {showDeposit && (
                <Modal title="💰 Record Deposit" onClose={() => setShowDeposit(false)}>
                    <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                        Record how much a member deposited / paid into the group pool.
                    </p>
                    <form onSubmit={handleDepositSubmit}>
                        <div className="form-group">
                            <label>Member</label>
                            <select className="form-control" value={depMemberId} onChange={e => setDepMemberId(e.target.value)}>
                                {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Amount</label>
                            <input type="number" step="0.01" min="0.01" className="form-control" placeholder="e.g. 500" value={depAmount} onChange={e => setDepAmount(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Note (optional)</label>
                            <input type="text" className="form-control" placeholder="e.g. Grocery run" value={depNote} onChange={e => setDepNote(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Date (optional, defaults to now)</label>
                            <input type="datetime-local" className="form-control" value={depDate} onChange={e => setDepDate(e.target.value)} />
                        </div>
                        {actionError && <p className="text-danger">{actionError}</p>}
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                            Record Deposit
                        </button>
                    </form>
                </Modal>
            )}

            {/* Summarize Modal */}
            {showSummarize && (
                <Modal title="📊 Group Summary" onClose={() => { setShowSummarize(false); setResetDone(false); setSummaryData(null); }}>
                    {!resetDone && !summaryData && (
                        <div style={{ textAlign: 'center', padding: '30px 0' }}>
                            <p>Loading final balances…</p>
                        </div>
                    )}
                    {actionError && <p className="text-danger">{actionError}</p>}
                    {summaryData && (
                        <div>
                            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(155,89,182,0.15)', marginBottom: '20px' }}>
                                <strong style={{ fontSize: '0.9rem' }}>All expenses have been reset to zero.</strong>
                                <p className="text-muted" style={{ fontSize: '0.85rem', margin: '4px 0 0' }}>Final balances before reset:</p>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 10px' }}>Member</th>
                                        <th style={{ padding: '8px 10px' }}>Total Paid</th>
                                        <th style={{ padding: '8px 10px' }}>Total Owed</th>
                                        <th style={{ padding: '8px 10px' }}>Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryData.final_balances.map((b, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{b.username}</td>
                                            <td style={{ padding: '8px 10px', color: 'var(--secondary)' }}>${b.total_to_receive.toFixed(2)}</td>
                                            <td style={{ padding: '8px 10px', color: '#ff6b6b' }}>${b.total_owed.toFixed(2)}</td>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, color: b.net_balance >= 0 ? '#4ECDC4' : '#ff6b6b' }}>
                                                {b.net_balance >= 0 ? '+' : ''}{b.net_balance.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={() => { setShowSummarize(false); setResetDone(false); setSummaryData(null); }}>
                                Close
                            </button>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}
